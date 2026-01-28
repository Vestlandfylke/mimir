// Copyright (c) Microsoft. All rights reserved.

using System.Globalization;
using CopilotChat.WebApi.Auth;
using CopilotChat.WebApi.Extensions;
using CopilotChat.WebApi.Hubs;
using CopilotChat.WebApi.Models.Request;
using CopilotChat.WebApi.Models.Response;
using CopilotChat.WebApi.Models.Storage;
using CopilotChat.WebApi.Options;
using CopilotChat.WebApi.Services;
using CopilotChat.WebApi.Storage;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using Microsoft.KernelMemory;

namespace CopilotChat.WebApi.Controllers;

/// <summary>
/// Controller for importing documents.
/// </summary>
/// <remarks>
/// This controller is responsible for contracts that are not possible to fulfill by kernel memory components.
/// </remarks>
[ApiController]
internal sealed class DocumentController : ControllerBase
{
    private const string GlobalDocumentUploadedClientCall = "GlobalDocumentUploaded";
    private const string ReceiveMessageClientCall = "ReceiveMessage";

    private readonly ILogger<DocumentController> _logger;
    private readonly PromptsOptions _promptOptions;
    private readonly DocumentMemoryOptions _options;
    private readonly ContentSafetyOptions _contentSafetyOptions;
    private readonly ChatSessionRepository _sessionRepository;
    private readonly ChatMemorySourceRepository _sourceRepository;
    private readonly ChatMessageRepository _messageRepository;
    private readonly ChatParticipantRepository _participantRepository;
    private readonly DocumentTypeProvider _documentTypeProvider;
    private readonly IAuthInfo _authInfo;
    private readonly IContentSafetyService _contentSafetyService;

    /// <summary>
    /// Initializes a new instance of the <see cref="DocumentImportController"/> class.
    /// </summary>
    public DocumentController(
        ILogger<DocumentController> logger,
        IAuthInfo authInfo,
        IOptions<DocumentMemoryOptions> documentMemoryOptions,
        IOptions<PromptsOptions> promptOptions,
        IOptions<ContentSafetyOptions> contentSafetyOptions,
        ChatSessionRepository sessionRepository,
        ChatMemorySourceRepository sourceRepository,
        ChatMessageRepository messageRepository,
        ChatParticipantRepository participantRepository,
        DocumentTypeProvider documentTypeProvider,
        IContentSafetyService contentSafetyService)
    {
        this._logger = logger;
        this._options = documentMemoryOptions.Value;
        this._promptOptions = promptOptions.Value;
        this._contentSafetyOptions = contentSafetyOptions.Value;
        this._sessionRepository = sessionRepository;
        this._sourceRepository = sourceRepository;
        this._messageRepository = messageRepository;
        this._participantRepository = participantRepository;
        this._documentTypeProvider = documentTypeProvider;
        this._authInfo = authInfo;
        this._contentSafetyService = contentSafetyService;
    }

    /// <summary>
    /// Service API for importing a document.
    /// Documents imported through this route will be considered as global documents.
    /// </summary>
    [Route("documents")]
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public Task<IActionResult> DocumentImportAsync(
        [FromServices] IKernelMemory memoryClient,
        [FromServices] IHubContext<MessageRelayHub> messageRelayHubContext,
        [FromForm] DocumentImportForm documentImportForm)
    {
        return this.DocumentImportAsync(
            memoryClient,
            messageRelayHubContext,
            DocumentScopes.Global,
            DocumentMemoryOptions.GlobalDocumentChatId,
            documentImportForm
        );
    }

    /// <summary>
    /// Service API for importing a document.
    /// </summary>
    [Route("chats/{chatId}/documents")]
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public Task<IActionResult> DocumentImportAsync(
        [FromServices] IKernelMemory memoryClient,
        [FromServices] IHubContext<MessageRelayHub> messageRelayHubContext,
        [FromRoute] Guid chatId,
        [FromForm] DocumentImportForm documentImportForm)
    {
        return this.DocumentImportAsync(
            memoryClient,
            messageRelayHubContext,
            DocumentScopes.Chat,
            chatId,
            documentImportForm);
    }

    /// <summary>
    /// Service API for deleting a document from a chat session.
    /// This removes the document from both the memory store and the source repository.
    /// </summary>
    [Route("chats/{chatId}/documents/{documentId}")]
    [HttpDelete]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteDocumentAsync(
        [FromServices] IKernelMemory memoryClient,
        [FromServices] IHubContext<MessageRelayHub> messageRelayHubContext,
        [FromRoute] Guid chatId,
        [FromRoute] string documentId)
    {
        this._logger.LogInformation("Deleting document {DocumentId} from chat {ChatId}", documentId, chatId);

        // Verify user has access to the chat
        if (!await this.UserHasAccessToChatAsync(this._authInfo.UserId, chatId))
        {
            return this.Forbid("User does not have access to this chat session.");
        }

        try
        {
            // Find the memory source by document ID
            var memorySources = await this._sourceRepository.FindByChatIdAsync(chatId.ToString());
            var memorySource = memorySources.FirstOrDefault(s => s.Id == documentId);

            if (memorySource == null)
            {
                this._logger.LogWarning("Document {DocumentId} not found in chat {ChatId}", documentId, chatId);
                return this.NotFound($"Document with ID {documentId} not found.");
            }

            // Delete from Kernel Memory (vector store)
            try
            {
                await memoryClient.DeleteDocumentAsync(documentId, this._promptOptions.MemoryIndexName);
                this._logger.LogInformation("Deleted document {DocumentId} from memory index", documentId);
            }
            catch (Exception ex)
            {
                this._logger.LogWarning(ex, "Failed to delete document {DocumentId} from memory index. It may not exist.", documentId);
                // Continue even if memory deletion fails - the source record should still be removed
            }

            // Delete the memory source record
            await this._sourceRepository.DeleteAsync(memorySource);
            this._logger.LogInformation("Deleted memory source record for document {DocumentId}", documentId);

            // Notify other clients about the deletion
            await messageRelayHubContext.Clients.Group(chatId.ToString())
                .SendAsync("DocumentDeleted", chatId.ToString(), documentId, memorySource.Name);

            return this.Ok(new { message = $"Document '{memorySource.Name}' deleted successfully.", documentId });
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error deleting document {DocumentId} from chat {ChatId}", documentId, chatId);
            return this.BadRequest($"Failed to delete document: {ex.Message}");
        }
    }

    /// <summary>
    /// Service API for getting all documents in a chat session.
    /// </summary>
    [Route("chats/{chatId}/documents")]
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetDocumentsAsync(
        [FromRoute] Guid chatId)
    {
        // Verify user has access to the chat
        if (!await this.UserHasAccessToChatAsync(this._authInfo.UserId, chatId))
        {
            return this.Forbid("User does not have access to this chat session.");
        }

        var memorySources = await this._sourceRepository.FindByChatIdAsync(chatId.ToString());

        var documents = memorySources.Select(s => new
        {
            s.Id,
            s.Name,
            s.Size,
            s.CreatedOn,
            s.IsPinned,
            Type = s.SourceType.ToString()
        });

        return this.Ok(documents);
    }

    /// <summary>
    /// Pin a document to always include it in chat context.
    /// </summary>
    [Route("chats/{chatId}/documents/{documentId}/pin")]
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> PinDocumentAsync(
        [FromRoute] Guid chatId,
        [FromRoute] string documentId)
    {
        try
        {
            // Verify user has access to the chat
            if (!await this.UserHasAccessToChatAsync(this._authInfo.UserId, chatId))
            {
                return this.Forbid("User does not have access to this chat session.");
            }

            var memorySource = await this._sourceRepository.FindByIdAsync(documentId);
            if (memorySource == null)
            {
                return this.NotFound($"Document med ID {documentId} finst ikkje");
            }

            if (memorySource.ChatId != chatId.ToString())
            {
                return this.Forbid("Document belongs to a different chat");
            }

            memorySource.IsPinned = true;
            await this._sourceRepository.UpsertAsync(memorySource);

            this._logger.LogInformation("Document {DocumentId} pinned in chat {ChatId}", documentId, chatId);

            return this.Ok(new { message = "Dokument er festa", isPinned = true });
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error pinning document {DocumentId}", documentId);
            return this.StatusCode(StatusCodes.Status500InternalServerError,
                "Ein feil oppstod ved festing av dokument. Prøv igjen seinare.");
        }
    }

    /// <summary>
    /// Unpin a document to remove it from always being included in context.
    /// </summary>
    [Route("chats/{chatId}/documents/{documentId}/unpin")]
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UnpinDocumentAsync(
        [FromRoute] Guid chatId,
        [FromRoute] string documentId)
    {
        try
        {
            // Verify user has access to the chat
            if (!await this.UserHasAccessToChatAsync(this._authInfo.UserId, chatId))
            {
                return this.Forbid("User does not have access to this chat session.");
            }

            var memorySource = await this._sourceRepository.FindByIdAsync(documentId);
            if (memorySource == null)
            {
                return this.NotFound($"Document med ID {documentId} finst ikkje");
            }

            if (memorySource.ChatId != chatId.ToString())
            {
                return this.Forbid("Document belongs to a different chat");
            }

            memorySource.IsPinned = false;
            await this._sourceRepository.UpsertAsync(memorySource);

            this._logger.LogInformation("Document {DocumentId} unpinned in chat {ChatId}", documentId, chatId);

            return this.Ok(new { message = "Dokument er løyst", isPinned = false });
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error unpinning document {DocumentId}", documentId);
            return this.StatusCode(StatusCodes.Status500InternalServerError,
                "Ein feil oppstod ved løysing av dokument. Prøv igjen seinare.");
        }
    }

    private async Task<IActionResult> DocumentImportAsync(
        IKernelMemory memoryClient,
        IHubContext<MessageRelayHub> messageRelayHubContext,
        DocumentScopes documentScope,
        Guid chatId,
        DocumentImportForm documentImportForm)
    {
        try
        {
            await this.ValidateDocumentImportFormAsync(chatId, documentScope, documentImportForm);
        }
        catch (ArgumentException ex)
        {
            return this.BadRequest(ex.Message);
        }

        this._logger.LogInformation("Importing {0} document(s)...", documentImportForm.FormFiles.Count());

        // Pre-create chat-message
        DocumentMessageContent documentMessageContent = new();

        var importResults = await this.ImportDocumentsAsync(memoryClient, chatId, documentImportForm, documentMessageContent);

        var chatMessage = await this.TryCreateDocumentUploadMessageAsync(chatId, documentMessageContent);

        if (chatMessage == null)
        {
            this._logger.LogWarning("Failed to create document upload message - {Content}", documentMessageContent.ToString());
            return this.BadRequest();
        }

        // Broadcast the document uploaded event to other users.
        if (documentScope == DocumentScopes.Chat)
        {
            // If chat message isn't created, it is still broadcast and visible in the documents tab.
            // The chat message won't, however, be displayed when the chat is freshly rendered.

            var userId = this._authInfo.UserId;
            await messageRelayHubContext.Clients.Group(chatId.ToString())
                .SendAsync(ReceiveMessageClientCall, chatId, userId, chatMessage);

            this._logger.LogInformation("Local upload chat message: {0}", chatMessage.ToString());

            return this.Ok(chatMessage);
        }

        await messageRelayHubContext.Clients.All.SendAsync(
            GlobalDocumentUploadedClientCall,
            documentMessageContent.ToFormattedStringNamesOnly(),
            this._authInfo.Name
        );

        this._logger.LogInformation("Global upload chat message: {0}", chatMessage.ToString());

        return this.Ok(chatMessage);
    }

    private async Task<IList<ImportResult>> ImportDocumentsAsync(IKernelMemory memoryClient, Guid chatId, DocumentImportForm documentImportForm, DocumentMessageContent messageContent)
    {
        IEnumerable<ImportResult> importResults = new List<ImportResult>();

        await Task.WhenAll(
            documentImportForm.FormFiles.Select(
                async formFile =>
                    await this.ImportDocumentAsync(formFile, memoryClient, chatId).ContinueWith(
                        task =>
                        {
                            var importResult = task.Result;
                            if (importResult != null)
                            {
                                messageContent.AddDocument(
                                    formFile.FileName,
                                    this.GetReadableByteString(formFile.Length),
                                    importResult.IsSuccessful);

                                importResults = importResults.Append(importResult);
                            }
                        },
                        TaskScheduler.Default)));

        return importResults.ToArray();
    }

    private async Task<ImportResult> ImportDocumentAsync(IFormFile formFile, IKernelMemory memoryClient, Guid chatId)
    {
        this._logger.LogInformation("Importing document {0}", formFile.FileName);

        // Create memory source
        MemorySource memorySource = new(
            chatId.ToString(),
            formFile.FileName,
            this._authInfo.UserId,
            MemorySourceType.File,
            formFile.Length,
            hyperlink: null
        );

        if (!(await this.TryUpsertMemorySourceAsync(memorySource)))
        {
            this._logger.LogDebug("Failed to upsert memory source for file {0}.", formFile.FileName);

            return ImportResult.Fail;
        }

        if (!(await TryStoreMemoryAsync()))
        {
            await this.TryRemoveMemoryAsync(memorySource);
        }

        return new ImportResult(memorySource.Id);

        async Task<bool> TryStoreMemoryAsync()
        {
            try
            {
                using var stream = formFile.OpenReadStream();
                await memoryClient.StoreDocumentAsync(
                    this._promptOptions.MemoryIndexName,
                    memorySource.Id,
                    chatId.ToString(),
                    this._promptOptions.DocumentMemoryName,
                    formFile.FileName,
                    stream);

                return true;
            }
            catch (Exception ex) when (ex is not SystemException)
            {
                return false;
            }
        }
    }

    #region Private

    /// <summary>
    /// A class to store a document import results.
    /// </summary>
    private sealed class ImportResult
    {
        /// <summary>
        /// A boolean indicating whether the import is successful.
        /// </summary>
        public bool IsSuccessful => !string.IsNullOrWhiteSpace(this.CollectionName);

        /// <summary>
        /// The name of the collection that the document is inserted to.
        /// </summary>
        public string CollectionName { get; set; }

        /// <summary>
        /// Create a new instance of the <see cref="ImportResult"/> class.
        /// </summary>
        /// <param name="collectionName">The name of the collection that the document is inserted to.</param>
        public ImportResult(string collectionName)
        {
            this.CollectionName = collectionName;
        }

        /// <summary>
        /// Create a new instance of the <see cref="ImportResult"/> class representing a failed import.
        /// </summary>
        public static ImportResult Fail { get; } = new(string.Empty);
    }

    /// <summary>
    /// Validates the document import form.
    /// </summary>
    /// <param name="documentImportForm">The document import form.</param>
    /// <returns></returns>
    /// <exception cref="ArgumentException">Throws ArgumentException if validation fails.</exception>
    private async Task ValidateDocumentImportFormAsync(Guid chatId, DocumentScopes scope, DocumentImportForm documentImportForm)
    {
        // Make sure the user has access to the chat session if the document is uploaded to a chat session.
        if (scope == DocumentScopes.Chat
            && !(await this.UserHasAccessToChatAsync(this._authInfo.UserId, chatId)))
        {
            throw new ArgumentException("User does not have access to the chat session.");
        }

        var formFiles = documentImportForm.FormFiles;

        if (!formFiles.Any())
        {
            throw new ArgumentException("No files were uploaded.");
        }
        else if (formFiles.Count() > this._options.FileCountLimit)
        {
            throw new ArgumentException($"Too many files uploaded. Max file count is {this._options.FileCountLimit}.");
        }

        // Loop through the uploaded files and validate them before importing.
        foreach (var formFile in formFiles)
        {
            if (formFile.Length == 0)
            {
                throw new ArgumentException($"File {formFile.FileName} is empty.");
            }

            if (formFile.Length > this._options.FileSizeLimit)
            {
                throw new ArgumentException($"File {formFile.FileName} size exceeds the limit.");
            }

            // Make sure the file type is supported.
            var fileType = Path.GetExtension(formFile.FileName);
            if (!this._documentTypeProvider.IsSupported(fileType, out bool isSafetyTarget))
            {
                throw new ArgumentException($"Unsupported file type: {fileType}");
            }

            if (isSafetyTarget && documentImportForm.UseContentSafety)
            {
                if (!this._contentSafetyOptions.Enabled)
                {
                    throw new ArgumentException("Unable to analyze image. Content Safety is currently disabled in the backend.");
                }

                var violations = new List<string>();
                try
                {
                    // Call the content safety controller to analyze the image
                    var imageAnalysisResponse = await this._contentSafetyService.ImageAnalysisAsync(formFile, default);
                    violations = this._contentSafetyService.ParseViolatedCategories(imageAnalysisResponse, this._contentSafetyOptions.ViolationThreshold);
                }
                catch (Exception ex) when (!ex.IsCriticalException())
                {
                    this._logger.LogError(ex, "Failed to analyze image {0} with Content Safety. Details: {{1}}", formFile.FileName, ex.Message);
                    throw new AggregateException($"Failed to analyze image {formFile.FileName} with Content Safety.", ex);
                }

                if (violations.Count > 0)
                {
                    throw new ArgumentException($"Unable to upload image {formFile.FileName}. Detected undesirable content with potential risk: {string.Join(", ", violations)}");
                }
            }
        }
    }

    /// <summary>
    /// Validates the document import form.
    /// </summary>
    /// <param name="documentStatusForm">The document import form.</param>
    /// <returns></returns>
    /// <exception cref="ArgumentException">Throws ArgumentException if validation fails.</exception>
    private async Task ValidateDocumentStatusFormAsync(DocumentStatusForm documentStatusForm)
    {
        // Make sure the user has access to the chat session if the document is uploaded to a chat session.
        if (documentStatusForm.DocumentScope == DocumentScopes.Chat
            && !(await this.UserHasAccessToChatAsync(documentStatusForm.UserId, documentStatusForm.ChatId)))
        {
            throw new ArgumentException("User does not have access to the chat session.");
        }

        var fileReferences = documentStatusForm.FileReferences;

        if (!fileReferences.Any())
        {
            throw new ArgumentException("No files identified.");
        }
        else if (fileReferences.Count() > this._options.FileCountLimit)
        {
            throw new ArgumentException($"Too many files requested. Max file count is {this._options.FileCountLimit}.");
        }

        // Loop through the uploaded files and validate them before importing.
        foreach (var fileReference in fileReferences)
        {
            if (string.IsNullOrWhiteSpace(fileReference))
            {
                throw new ArgumentException($"File {fileReference} is empty.");
            }
        }
    }

    /// <summary>
    /// Try to upsert a memory source.
    /// </summary>
    /// <param name="memorySource">The memory source to be uploaded</param>
    /// <returns>True if upsert is successful. False otherwise.</returns>
    private async Task<bool> TryUpsertMemorySourceAsync(MemorySource memorySource)
    {
        try
        {
            await this._sourceRepository.UpsertAsync(memorySource);
            return true;
        }
        catch (Exception ex) when (ex is not SystemException)
        {
            return false;
        }
    }

    /// <summary>
    /// Try to upsert a memory source.
    /// </summary>
    /// <param name="memorySource">The memory source to be uploaded</param>
    /// <returns>True if upsert is successful. False otherwise.</returns>
    private async Task<bool> TryRemoveMemoryAsync(MemorySource memorySource)
    {
        try
        {
            await this._sourceRepository.DeleteAsync(memorySource);
            return true;
        }
        catch (Exception ex) when (ex is ArgumentOutOfRangeException)
        {
            return false;
        }
    }

    /// <summary>
    /// Try to upsert a memory source.
    /// </summary>
    /// <param name="memorySource">The memory source to be uploaded</param>
    /// <returns>True if upsert is successful. False otherwise.</returns>
    private async Task<bool> TryStoreMemoryAsync(MemorySource memorySource)
    {
        try
        {
            await this._sourceRepository.UpsertAsync(memorySource);
            return true;
        }
        catch (Exception ex) when (ex is ArgumentOutOfRangeException)
        {
            return false;
        }
    }

    /// <summary>
    /// Try to create a chat message that represents document upload.
    /// </summary>
    /// <param name="chatId">The target chat-id</param>
    /// <param name="messageContent">The document message content</param>
    /// <returns>A ChatMessage object if successful, null otherwise</returns>
    private async Task<CopilotChatMessage?> TryCreateDocumentUploadMessageAsync(
        Guid chatId,
        DocumentMessageContent messageContent)
    {
        var chatMessage = CopilotChatMessage.CreateDocumentMessage(
            this._authInfo.UserId,
            this._authInfo.Name, // User name
            chatId.ToString(),
            messageContent);

        try
        {
            await this._messageRepository.CreateAsync(chatMessage);
            return chatMessage;
        }
        catch (Exception ex) when (ex is ArgumentOutOfRangeException)
        {
            return null;
        }
    }

    /// <summary>
    /// Converts a `long` byte count to a human-readable string.
    /// </summary>
    /// <param name="bytes">Byte count</param>
    /// <returns>Human-readable string of bytes</returns>
    private string GetReadableByteString(long bytes)
    {
        string[] sizes = { "B", "KB", "MB", "GB", "TB" };
        int i;
        double dblsBytes = bytes;
        for (i = 0; i < sizes.Length && bytes >= 1024; i++, bytes /= 1024)
        {
            dblsBytes = bytes / 1024.0;
        }

        return string.Format(CultureInfo.InvariantCulture, "{0:0.#}{1}", dblsBytes, sizes[i]);
    }

    /// <summary>
    /// Check if the user has access to the chat session.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <param name="chatId">The chat session ID.</param>
    /// <returns>A boolean indicating whether the user has access to the chat session.</returns>
    private async Task<bool> UserHasAccessToChatAsync(string userId, Guid chatId)
    {
        return await this._participantRepository.IsUserInChatAsync(userId, chatId.ToString());
    }

    #endregion
}
