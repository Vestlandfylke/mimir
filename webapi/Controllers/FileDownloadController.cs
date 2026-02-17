// Copyright (c) Microsoft. All rights reserved.

using System.Text;
using CopilotChat.WebApi.Auth;
using CopilotChat.WebApi.Services;
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
    private readonly DownloadTokenService _downloadTokenService;

    public FileDownloadController(
        ILogger<FileDownloadController> logger,
        GeneratedFileRepository fileRepository,
        IAuthInfo authInfo,
        DownloadTokenService downloadTokenService)
    {
        this._logger = logger;
        this._fileRepository = fileRepository;
        this._authInfo = authInfo;
        this._downloadTokenService = downloadTokenService;
    }

    /// <summary>
    /// Get all files for the authenticated user across all chats.
    /// Returns metadata only (not file content).
    /// </summary>
    [HttpGet]
    [Route("files/my")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMyFilesAsync()
    {
        try
        {
            var isAuthenticated = this.HttpContext?.User?.Identity?.IsAuthenticated == true;
            if (!isAuthenticated)
            {
                return this.StatusCode(StatusCodes.Status401Unauthorized, "Du må vere logga inn for å sjå filene dine");
            }

            var userId = this._authInfo.UserId;
            if (string.IsNullOrEmpty(userId))
            {
                return this.StatusCode(StatusCodes.Status401Unauthorized, "Kunne ikkje identifisere brukaren");
            }

            var files = await this._fileRepository.FindByUserIdAsync(userId);

            // Filter out expired files and clean them up
            var now = DateTimeOffset.UtcNow;
            var activeFiles = new List<object>();

            foreach (var file in files)
            {
                if (file.ExpiresOn.HasValue && file.ExpiresOn.Value < now)
                {
                    // Clean up expired file
                    await this._fileRepository.DeleteAsync(file);
                    continue;
                }

                activeFiles.Add(new
                {
                    file.Id,
                    file.FileName,
                    file.ContentType,
                    file.Size,
                    file.CreatedOn,
                    file.ExpiresOn,
                    file.ChatId,
                    DownloadUrl = $"/files/{file.Id}/{Uri.EscapeDataString(file.FileName)}?chatId={file.ChatId}"
                });
            }

            // Sort by CreatedOn descending (newest first)
            var sortedFiles = activeFiles.OrderByDescending(f => ((dynamic)f).CreatedOn);

            return this.Ok(sortedFiles);
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error getting files for user");
            return this.StatusCode(StatusCodes.Status500InternalServerError,
                "Ein feil oppstod ved henting av filene dine. Prøv igjen seinare.");
        }
    }

    /// <summary>
    /// Generate a short-lived download token for a file.
    /// This enables file downloads on mobile browsers and Teams WebViews
    /// where the standard blob + anchor click approach does not work.
    /// The returned token can be appended as ?dt=TOKEN to the download URL.
    /// </summary>
    [HttpPost]
    [Route("files/{fileId}/download-token")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult GenerateDownloadToken(string fileId)
    {
        var isAuthenticated = this.HttpContext?.User?.Identity?.IsAuthenticated == true;
        if (!isAuthenticated)
        {
            return this.StatusCode(StatusCodes.Status401Unauthorized, "Du må vere logga inn");
        }

        var userId = this._authInfo.UserId;
        if (string.IsNullOrEmpty(userId))
        {
            // Fall back to name for backward compatibility
            userId = this._authInfo.Name;
        }

        if (string.IsNullOrEmpty(userId))
        {
            return this.StatusCode(StatusCodes.Status401Unauthorized, "Kunne ikkje identifisere brukaren");
        }

        var token = this._downloadTokenService.GenerateToken(fileId, userId);

        return this.Ok(new { token });
    }

    /// <summary>
    /// Download a generated file.
    /// The optional {slug} segment allows the filename to appear in the URL path,
    /// so browsers use it as the default download name (e.g., /files/{id}/rapport.docx).
    /// </summary>
    /// <param name="fileId">The ID of the file to download</param>
    /// <param name="chatId">The chat ID (used as partition key in storage)</param>
    /// <returns>The file content</returns>
    [HttpGet]
    [Route("files/{fileId}/{slug?}")]
    // NOTE: We intentionally allow this endpoint to be hit directly from the browser without auth headers.
    // The UI performs authenticated fetch for downloads, and we return 401/403 for protected files.
    // For mobile/Teams, a short-lived download token (?dt=xxx) can be used instead of Bearer auth.
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DownloadFileAsync(string fileId, [FromQuery] string? chatId = null, [FromQuery] string? dt = null)
    {
        try
        {
            var isAuthenticated = this.HttpContext?.User?.Identity?.IsAuthenticated == true;
            var requestUserId = isAuthenticated ? this._authInfo.UserId : string.Empty;
            var requestUserName = isAuthenticated ? this._authInfo.Name : string.Empty;

            // Check for download token as alternative auth (for mobile/Teams)
            string? tokenUserId = null;
            if (!string.IsNullOrEmpty(dt))
            {
                tokenUserId = this._downloadTokenService.ValidateAndConsume(dt, fileId);
                if (tokenUserId != null)
                {
                    this._logger.LogInformation("File {FileId} download authorized via download token for user", fileId);
                    // Token is valid - use the token's user identity
                    requestUserId = tokenUserId;
                    isAuthenticated = true;
                }
                else
                {
                    this._logger.LogWarning("Invalid or expired download token for file {FileId}", fileId);
                }
            }

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
                DownloadUrl = $"/files/{f.Id}/{Uri.EscapeDataString(f.FileName)}"
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
