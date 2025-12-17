// Copyright (c) Microsoft. All rights reserved.

using System.ComponentModel;
using System.Text;
using CopilotChat.WebApi.Auth;
using CopilotChat.WebApi.Models.Storage;
using CopilotChat.WebApi.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.SemanticKernel;

namespace CopilotChat.WebApi.Plugins.FileGeneration;

/// <summary>
/// Plugin for generating downloadable files from AI responses.
/// </summary>
public class FileGenerationPlugin
{
  private readonly GeneratedFileRepository _fileRepository;
  private readonly ILogger<FileGenerationPlugin> _logger;
  private readonly IHttpContextAccessor _httpContextAccessor;
  private readonly IAuthInfo _authInfo;

  public FileGenerationPlugin(
      GeneratedFileRepository fileRepository,
      ILogger<FileGenerationPlugin> logger,
      IHttpContextAccessor httpContextAccessor,
      IAuthInfo authInfo)
  {
    this._fileRepository = fileRepository;
    this._logger = logger;
    this._httpContextAccessor = httpContextAccessor;
    this._authInfo = authInfo;
  }

  /// <summary>
  /// Creates a downloadable text file (markdown, plain text, etc.).
  /// </summary>
  /// <param name="fileName">The name of the file (e.g., "dokument.md")</param>
  /// <param name="content">The text content of the file</param>
  /// <param name="chatId">The chat ID</param>
  /// <returns>A download URL for the file</returns>
  [KernelFunction, Description("Lag ei nedlastbar tekstfil (markdown, txt, osv.) som brukaren kan laste ned")]
  public async Task<string> CreateTextFile(
      [Description("Filnamn (t.d. 'dokument.md', 'rapport.txt')")] string fileName,
      [Description("Innhaldet i fila")] string content,
      [Description("Chat ID")] string chatId)
  {
    try
    {
      var fileId = Guid.NewGuid().ToString();
      var contentType = GetContentType(fileName);

      var file = new GeneratedFile
      {
        Id = fileId,
        ChatId = chatId,
        // Always use the authenticated user id from the request context (stable id),
        // instead of trusting the LLM to supply the correct value.
        UserId = this._authInfo.UserId,
        FileName = fileName,
        ContentType = contentType,
        Content = content,
        Size = Encoding.UTF8.GetByteCount(content),
        CreatedOn = DateTimeOffset.UtcNow,
        ExpiresOn = DateTimeOffset.UtcNow.AddDays(7) // Expire after 7 days
      };

      await this._fileRepository.CreateAsync(file);

      var downloadUrl = this.GetDownloadUrl(fileId);
      this._logger.LogInformation("Created downloadable file {FileName} with ID {FileId}", fileName, fileId);

      return downloadUrl;
    }
    catch (Exception ex)
    {
      this._logger.LogError(ex, "Error creating downloadable file {FileName}", fileName);
      throw;
    }
  }

  /// <summary>
  /// Creates a downloadable binary file (e.g., PDF, Word document).
  /// </summary>
  /// <param name="fileName">The name of the file</param>
  /// <param name="contentBase64">The base64-encoded content of the file</param>
  /// <param name="chatId">The chat ID</param>
  /// <returns>A download URL for the file</returns>
  [KernelFunction, Description("Lag ei nedlastbar binærfil (PDF, Word, osv.) som brukaren kan laste ned")]
  public async Task<string> CreateBinaryFile(
      [Description("Filnamn (t.d. 'dokument.pdf', 'rapport.docx')")] string fileName,
      [Description("Base64-enkoda innhald")] string contentBase64,
      [Description("Chat ID")] string chatId)
  {
    try
    {
      var fileId = Guid.NewGuid().ToString();
      var contentType = GetContentType(fileName);

      // Decode base64 to get actual size
      byte[] bytes = Convert.FromBase64String(contentBase64);

      var file = new GeneratedFile
      {
        Id = fileId,
        ChatId = chatId,
        // Always use the authenticated user id from the request context (stable id),
        // instead of trusting the LLM to supply the correct value.
        UserId = this._authInfo.UserId,
        FileName = fileName,
        ContentType = contentType,
        Content = contentBase64,
        Size = bytes.Length,
        CreatedOn = DateTimeOffset.UtcNow,
        ExpiresOn = DateTimeOffset.UtcNow.AddDays(7)
      };

      await this._fileRepository.CreateAsync(file);

      var downloadUrl = this.GetDownloadUrl(fileId);
      this._logger.LogInformation("Created binary file {FileName} with ID {FileId}", fileName, fileId);

      return downloadUrl;
    }
    catch (Exception ex)
    {
      this._logger.LogError(ex, "Error creating binary file {FileName}", fileName);
      throw;
    }
  }

  private static string GetContentType(string fileName)
  {
    var extension = Path.GetExtension(fileName).ToLowerInvariant();
    return extension switch
    {
      ".md" => "text/markdown",
      ".txt" => "text/plain",
      ".html" => "text/html",
      ".json" => "application/json",
      ".xml" => "application/xml",
      ".pdf" => "application/pdf",
      ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".doc" => "application/msword",
      ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".xls" => "application/vnd.ms-excel",
      ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".ppt" => "application/vnd.ms-powerpoint",
      ".csv" => "text/csv",
      ".zip" => "application/zip",
      _ => "application/octet-stream"
    };
  }

  /// <summary>
  /// Gets the full download URL for a file based on the current request context.
  /// </summary>
  private string GetDownloadUrl(string fileId)
  {
    var httpContext = this._httpContextAccessor.HttpContext;
    if (httpContext != null)
    {
      var request = httpContext.Request;
      var baseUrl = $"{request.Scheme}://{request.Host}{request.PathBase}";
      return $"{baseUrl}/files/{fileId}";
    }

    // Fallback to relative URL if HttpContext is not available
    return $"/files/{fileId}";
  }
}

