// Copyright (c) Microsoft. All rights reserved.

using System.Text;
using CopilotChat.WebApi.Auth;
using CopilotChat.WebApi.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CopilotChat.WebApi.Controllers;

/// <summary>
/// Controller for downloading generated files.
/// </summary>
[ApiController]
internal sealed class FileDownloadController : ControllerBase
{
    private readonly ILogger<FileDownloadController> _logger;
    private readonly GeneratedFileRepository _fileRepository;
    private readonly IAuthInfo _authInfo;

    public FileDownloadController(
        ILogger<FileDownloadController> logger,
        GeneratedFileRepository fileRepository,
        IAuthInfo authInfo)
    {
        this._logger = logger;
        this._fileRepository = fileRepository;
        this._authInfo = authInfo;
    }

    /// <summary>
    /// Download a generated file.
    /// </summary>
    /// <param name="fileId">The ID of the file to download</param>
    /// <param name="chatId">The chat ID (used as partition key in storage)</param>
    /// <returns>The file content</returns>
    [HttpGet]
    [Route("files/{fileId}")]
    // NOTE: We intentionally allow this endpoint to be hit directly from the browser without auth headers.
    // The UI performs authenticated fetch for downloads, and we return 401/403 for protected files.
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DownloadFileAsync(string fileId, [FromQuery] string? chatId = null)
    {
        try
        {
            var isAuthenticated = this.HttpContext?.User?.Identity?.IsAuthenticated == true;
            var requestUserId = isAuthenticated ? this._authInfo.UserId : string.Empty;
            var requestUserName = isAuthenticated ? this._authInfo.Name : string.Empty;

            this._logger.LogInformation(
                "Downloading file {FileId} for user {UserId} (chatId: {ChatId})",
                fileId,
                string.IsNullOrEmpty(requestUserId) ? "<anonymous>" : requestUserId,
                chatId ?? "<not provided>");

            // Get the file from storage - use chatId as partition key if provided
            Models.Storage.GeneratedFile? file = null;

            if (!string.IsNullOrEmpty(chatId))
            {
                // ChatId provided - use it as partition key (fast lookup)
                file = await this._fileRepository.FindByIdAsync(fileId, chatId);
            }

            if (file == null)
            {
                // Fallback: search across all partitions (for backward compatibility with old URLs)
                // This is a cross-partition query and slower, but handles URLs generated before v2.0
                this._logger.LogInformation("File {FileId} not found with chatId, trying cross-partition search", fileId);
                file = await this._fileRepository.FindByFileIdAcrossPartitionsAsync(fileId);
            }

            if (file == null)
            {
                this._logger.LogWarning("File {FileId} not found (chatId: {ChatId})", fileId, chatId ?? "<not provided>");
                return this.NotFound($"Fil med ID {fileId} finst ikkje");
            }

            // Check if file has expired
            if (file.ExpiresOn.HasValue && file.ExpiresOn.Value < DateTimeOffset.UtcNow)
            {
                this._logger.LogWarning("File {FileId} has expired", fileId);
                await this._fileRepository.DeleteAsync(file);
                return this.NotFound("Fila har gått ut på dato og er sletta");
            }

            // Verify user has access (must be the creator or have access to the chat)
            // If file has an owner (UserId set), verify the requesting user matches
            if (!string.IsNullOrEmpty(file.UserId))
            {
                // File has an owner - must be authenticated and match
                if (!isAuthenticated || (string.IsNullOrEmpty(requestUserId) && string.IsNullOrEmpty(requestUserName)))
                {
                    this._logger.LogWarning("Anonymous user attempted to access protected file {FileId}", fileId);
                    return this.StatusCode(StatusCodes.Status401Unauthorized, "Du må vere logga inn for å laste ned denne fila");
                }

                // Backward compatibility:
                // Older deployments stored display name in GeneratedFile.UserId. Prefer stable user id, but allow name match.
                if (file.UserId != requestUserId && file.UserId != requestUserName)
                {
                    this._logger.LogWarning("User {UserId} attempted to access file {FileId} belonging to {FileOwnerId}",
                        string.IsNullOrEmpty(requestUserId) ? requestUserName : requestUserId, fileId, file.UserId);
                    return this.StatusCode(StatusCodes.Status403Forbidden, "Du har ikkje tilgang til denne fila");
                }
            }
            // If file has no owner (UserId empty), allow access for local testing

            // Convert content to bytes
            byte[] fileBytes;
            if (IsTextFile(file.ContentType, file.FileName))
            {
                // Text file - convert from string
                fileBytes = Encoding.UTF8.GetBytes(file.Content);
            }
            else
            {
                // Binary file - decode from base64
                fileBytes = Convert.FromBase64String(file.Content);
            }

            // Return file
            return this.File(fileBytes, file.ContentType, file.FileName);
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error downloading file {FileId}", fileId);
            return this.StatusCode(StatusCodes.Status500InternalServerError,
                "Ein feil oppstod ved nedlasting av fila. Prøv igjen seinare.");
        }
    }

    /// <summary>
    /// Delete a generated file.
    /// </summary>
    /// <param name="fileId">The ID of the file to delete</param>
    /// <param name="chatId">The chat ID (used as partition key in storage)</param>
    [HttpDelete]
    [Route("files/{fileId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteFileAsync(string fileId, [FromQuery] string? chatId = null)
    {
        try
        {
            var isAuthenticated = this.HttpContext?.User?.Identity?.IsAuthenticated == true;
            var requestUserId = isAuthenticated ? this._authInfo.UserId : string.Empty;
            var requestUserName = isAuthenticated ? this._authInfo.Name : string.Empty;

            var file = await this._fileRepository.FindByIdAsync(fileId, chatId);
            if (file == null)
            {
                return this.NotFound($"Fil med ID {fileId} finst ikkje");
            }

            // Verify user has access
            // Skip check if either userId is empty (for local testing without auth)
            if (!string.IsNullOrEmpty(file.UserId))
            {
                if (!isAuthenticated || (string.IsNullOrEmpty(requestUserId) && string.IsNullOrEmpty(requestUserName)))
                {
                    return this.StatusCode(StatusCodes.Status401Unauthorized, "Du må vere logga inn for å slette denne fila");
                }

                if (file.UserId != requestUserId && file.UserId != requestUserName)
                {
                    return this.StatusCode(StatusCodes.Status403Forbidden, "Du har ikkje tilgang til å slette denne fila");
                }
            }

            await this._fileRepository.DeleteAsync(file);
            return this.Ok(new { message = "Fila vart sletta" });
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error deleting file {FileId}", fileId);
            return this.StatusCode(StatusCodes.Status500InternalServerError,
                "Ein feil oppstod ved sletting av fila. Prøv igjen seinare.");
        }
    }

    /// <summary>
    /// Get all files for a chat.
    /// </summary>
    /// <param name="chatId">The chat ID</param>
    [HttpGet]
    [Route("chats/{chatId}/files")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetChatFilesAsync(Guid chatId)
    {
        try
        {
            var files = await this._fileRepository.FindByChatIdAsync(chatId.ToString());

            var fileList = files.Select(f => new
            {
                f.Id,
                f.FileName,
                f.ContentType,
                f.Size,
                f.CreatedOn,
                f.ExpiresOn,
                DownloadUrl = $"/files/{f.Id}"
            });

            return this.Ok(fileList);
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error getting files for chat {ChatId}", chatId);
            return this.StatusCode(StatusCodes.Status500InternalServerError,
                "Ein feil oppstod ved henting av filer. Prøv igjen seinare.");
        }
    }

    private static bool IsTextFile(string contentType, string fileName)
    {
        // Prefer file extension as source of truth, since some clients may have stored
        // a mismatched ContentType historically (e.g., .docx stored as text/plain).
        var ext = Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant();
        if (!string.IsNullOrEmpty(ext))
        {
            return ext is ".md" or ".txt" or ".html" or ".json" or ".xml" or ".csv";
        }

        // Fallback to content type
        return contentType.StartsWith("text/", StringComparison.OrdinalIgnoreCase) ||
               contentType.Contains("json", StringComparison.OrdinalIgnoreCase) ||
               contentType.Contains("xml", StringComparison.OrdinalIgnoreCase) ||
               contentType.Equals("application/markdown", StringComparison.OrdinalIgnoreCase);
    }
}
