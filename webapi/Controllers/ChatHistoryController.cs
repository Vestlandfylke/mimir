// Copyright (c) Microsoft. All rights reserved.

using CopilotChat.WebApi.Auth;
using CopilotChat.WebApi.Extensions;
using CopilotChat.WebApi.Hubs;
using CopilotChat.WebApi.Models.Request;
using CopilotChat.WebApi.Models.Response;
using CopilotChat.WebApi.Models.Storage;
using CopilotChat.WebApi.Options;
using CopilotChat.WebApi.Plugins.Utils;
using CopilotChat.WebApi.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using Microsoft.KernelMemory;

namespace CopilotChat.WebApi.Controllers;

/// <summary>
/// Controller for chat history.
/// This controller is responsible for creating new chat sessions, retrieving chat sessions,
/// retrieving chat messages, and editing chat sessions.
/// </summary>
[ApiController]
internal sealed class ChatHistoryController : ControllerBase
{
    private const string ChatEditedClientCall = "ChatEdited";
    private const string ChatDeletedClientCall = "ChatDeleted";
    private const string ChatArchivedClientCall = "ChatArchived";
    private const string ChatRestoredClientCall = "ChatRestored";
    private const string GetChatRoute = "GetChatRoute";

    private readonly ILogger<ChatHistoryController> _logger;
    private readonly IKernelMemory _memoryClient;
    private readonly ChatSessionRepository _sessionRepository;
    private readonly ChatMessageRepository _messageRepository;
    private readonly ChatParticipantRepository _participantRepository;
    private readonly ChatMemorySourceRepository _sourceRepository;
    private readonly ArchivedChatSessionRepository _archivedSessionRepository;
    private readonly ArchivedChatMessageRepository _archivedMessageRepository;
    private readonly ArchivedChatParticipantRepository _archivedParticipantRepository;
    private readonly ArchivedMemorySourceRepository _archivedSourceRepository;
    private readonly PromptsOptions _promptOptions;
    private readonly ChatAuthenticationOptions _authOptions;
    private readonly IAuthInfo _authInfo;

    /// <summary>
    /// Initializes a new instance of the <see cref="ChatHistoryController"/> class.
    /// </summary>
    /// <param name="logger">The logger.</param>
    /// <param name="memoryClient">Memory client.</param>
    /// <param name="sessionRepository">The chat session repository.</param>
    /// <param name="messageRepository">The chat message repository.</param>
    /// <param name="participantRepository">The chat participant repository.</param>
    /// <param name="sourceRepository">The chat memory resource repository.</param>
    /// <param name="archivedSessionRepository">The archived chat session repository.</param>
    /// <param name="archivedMessageRepository">The archived chat message repository.</param>
    /// <param name="archivedParticipantRepository">The archived chat participant repository.</param>
    /// <param name="archivedSourceRepository">The archived memory source repository.</param>
    /// <param name="promptsOptions">The prompts options.</param>
    /// <param name="authOptions">The authentication options.</param>
    /// <param name="authInfo">The auth info for the current request.</param>
    public ChatHistoryController(
        ILogger<ChatHistoryController> logger,
        IKernelMemory memoryClient,
        ChatSessionRepository sessionRepository,
        ChatMessageRepository messageRepository,
        ChatParticipantRepository participantRepository,
        ChatMemorySourceRepository sourceRepository,
        ArchivedChatSessionRepository archivedSessionRepository,
        ArchivedChatMessageRepository archivedMessageRepository,
        ArchivedChatParticipantRepository archivedParticipantRepository,
        ArchivedMemorySourceRepository archivedSourceRepository,
        IOptions<PromptsOptions> promptsOptions,
        IOptions<ChatAuthenticationOptions> authOptions,
        IAuthInfo authInfo)
    {
        this._logger = logger;
        this._memoryClient = memoryClient;
        this._sessionRepository = sessionRepository;
        this._messageRepository = messageRepository;
        this._participantRepository = participantRepository;
        this._sourceRepository = sourceRepository;
        this._archivedSessionRepository = archivedSessionRepository;
        this._archivedMessageRepository = archivedMessageRepository;
        this._archivedParticipantRepository = archivedParticipantRepository;
        this._archivedSourceRepository = archivedSourceRepository;
        this._promptOptions = promptsOptions.Value;
        this._authOptions = authOptions.Value;
        this._authInfo = authInfo;
    }

    /// <summary>
    /// Create a new chat session and populate the session with the initial bot message.
    /// </summary>
    /// <param name="chatParameter">Contains the title of the chat.</param>
    /// <returns>The HTTP action result.</returns>
    [HttpPost]
    [Route("chats")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateChatSessionAsync(
        [FromBody] CreateChatParameters chatParameters)
    {
        if (chatParameters.Title == null)
        {
            return this.BadRequest("Chat session parameters cannot be null.");
        }

        // Determine system description and initial message based on template
        string systemDescription = this._promptOptions.SystemDescription;
        string initialBotMessage = this._promptOptions.InitialBotMessage;

        if (!string.IsNullOrEmpty(chatParameters.Template) && this._promptOptions.Templates != null)
        {
            if (this._promptOptions.Templates.TryGetValue(chatParameters.Template, out var template))
            {
                // Validate that the template is enabled
                if (!template.Enabled)
                {
                    this._logger.LogWarning(
                        "User {UserId} attempted to create chat with disabled template '{Template}'.",
                        this._authInfo.UserId,
                        chatParameters.Template);
                    return this.BadRequest($"Template '{chatParameters.Template}' is not available.");
                }

                // Check if we're in dev mode (no authentication) - skip access check
                bool isDevMode = this._authOptions.Type == ChatAuthenticationOptions.AuthenticationType.None;

                // Validate that the user has access to this template (App Role, user ID, or group membership check)
                // Skip this check in dev mode for easier testing
                if (!isDevMode && !template.IsUserAllowed(this._authInfo.UserId, this._authInfo.Groups, this._authInfo.Roles))
                {
                    this._logger.LogWarning(
                        "User {UserId} attempted to create chat with template '{Template}' but does not have access. User roles: [{UserRoles}], User groups: [{UserGroups}], Required roles: [{RequiredRoles}], Allowed groups: [{AllowedGroups}], Allowed users: [{AllowedUsers}]",
                        this._authInfo.UserId,
                        chatParameters.Template,
                        string.Join(", ", this._authInfo.Roles),
                        string.Join(", ", this._authInfo.Groups),
                        string.Join(", ", template.RequiredRoles ?? new List<string>()),
                        string.Join(", ", template.AllowedGroups ?? new List<string>()),
                        string.Join(", ", template.AllowedUsers ?? new List<string>()));
                    return this.StatusCode(StatusCodes.Status403Forbidden, $"You do not have access to the '{chatParameters.Template}' assistant.");
                }

                if (isDevMode)
                {
                    this._logger.LogDebug("Dev mode: Skipping access check for template '{Template}'.", chatParameters.Template);
                }

                systemDescription = template.SystemDescription;
                initialBotMessage = template.InitialBotMessage;
                this._logger.LogDebug("Using template '{0}' for new chat session.", chatParameters.Template);
            }
            else
            {
                this._logger.LogWarning("Template '{0}' not found. Using default prompts.", chatParameters.Template);
            }
        }

        // Create a new chat session with template info
        var newChat = new ChatSession(chatParameters.Title, systemDescription)
        {
            Template = chatParameters.Template  // Store the template for MCP filtering
        };
        await this._sessionRepository.CreateAsync(newChat);

        // Create initial bot message
        var chatMessage = CopilotChatMessage.CreateBotResponseMessage(
            newChat.Id,
            initialBotMessage,
            string.Empty, // The initial bot message doesn't need a prompt.
            null,
            TokenUtils.EmptyTokenUsages());
        await this._messageRepository.CreateAsync(chatMessage);

        // Add the user to the chat session
        await this._participantRepository.CreateAsync(new ChatParticipant(this._authInfo.UserId, newChat.Id));

        this._logger.LogDebug("Created chat session with id {0}.", newChat.Id);

        return this.CreatedAtRoute(GetChatRoute, new { chatId = newChat.Id }, new CreateChatResponse(newChat, chatMessage));
    }

    /// <summary>
    /// Get a chat session by id.
    /// </summary>
    /// <param name="chatId">The chat id.</param>
    [HttpGet]
    [Route("chats/{chatId:guid}", Name = GetChatRoute)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [Authorize(Policy = AuthPolicyName.RequireChatParticipant)]
    public async Task<IActionResult> GetChatSessionByIdAsync(Guid chatId)
    {
        ChatSession? chat = null;
        if (await this._sessionRepository.TryFindByIdAsync(chatId.ToString(), callback: v => chat = v))
        {
            return this.Ok(chat);
        }

        return this.NotFound($"No chat session found for chat id '{chatId}'.");
    }

    /// <summary>
    /// Get all chat sessions associated with the logged in user. Return an empty list if no chats are found.
    /// </summary>
    /// <param name="userId">The user id.</param>
    /// <returns>A list of chat sessions. An empty list if the user is not in any chat session.</returns>
    [HttpGet]
    [Route("chats")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAllChatSessionsAsync()
    {
        // Get all participants that belong to the user.
        // Then get all the chats from the list of participants.
        var chatParticipants = await this._participantRepository.FindByUserIdAsync(this._authInfo.UserId);

        var chats = new List<ChatSession>();
        foreach (var chatParticipant in chatParticipants)
        {
            ChatSession? chat = null;
            if (await this._sessionRepository.TryFindByIdAsync(chatParticipant.ChatId, callback: v => chat = v))
            {
                chats.Add(chat!);
            }
            else
            {
                this._logger.LogDebug("Failed to find chat session with id {0}", chatParticipant.ChatId);
            }
        }

        return this.Ok(chats);
    }

    /// <summary>
    /// Get chat messages for a chat session.
    /// Messages are returned ordered from most recent to oldest.
    /// </summary>
    /// <param name="chatId">The chat id.</param>
    /// <param name="skip">Number of messages to skip before starting to return messages.</param>
    /// <param name="count">The number of messages to return. -1 returns all messages.</param>
    [HttpGet]
    [Route("chats/{chatId:guid}/messages")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [Authorize(Policy = AuthPolicyName.RequireChatParticipant)]
    public async Task<IActionResult> GetChatMessagesAsync(
        [FromRoute] Guid chatId,
        [FromQuery] int skip = 0,
        [FromQuery] int count = -1)
    {
        var chatMessages = await this._messageRepository.FindByChatIdAsync(chatId.ToString(), skip, count);
        if (!chatMessages.Any())
        {
            return this.NotFound($"No messages found for chat id '{chatId}'.");
        }

        return this.Ok(chatMessages);
    }

    /// <summary>
    /// Edit a chat session.
    /// </summary>
    /// <param name="chatParameters">Object that contains the parameters to edit the chat.</param>
    [HttpPatch]
    [Route("chats/{chatId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [Authorize(Policy = AuthPolicyName.RequireChatParticipant)]
    public async Task<IActionResult> EditChatSessionAsync(
        [FromServices] IHubContext<MessageRelayHub> messageRelayHubContext,
        [FromBody] EditChatParameters chatParameters,
        [FromRoute] Guid chatId)
    {
        ChatSession? chat = null;
        if (await this._sessionRepository.TryFindByIdAsync(chatId.ToString(), callback: v => chat = v))
        {
            chat!.Title = chatParameters.Title ?? chat!.Title;
            chat!.SystemDescription = chatParameters.SystemDescription ?? chat!.SafeSystemDescription;
            chat!.MemoryBalance = chatParameters.MemoryBalance ?? chat!.MemoryBalance;
            await this._sessionRepository.UpsertAsync(chat);
            await messageRelayHubContext.Clients.Group(chatId.ToString()).SendAsync(ChatEditedClientCall, chat);

            return this.Ok(chat);
        }

        return this.NotFound($"No chat session found for chat id '{chatId}'.");
    }

    /// <summary>
    /// Gets list of imported documents for a given chat.
    /// </summary>
    [Route("chats/{chatId:guid}/documents")]
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [Authorize(Policy = AuthPolicyName.RequireChatParticipant)]
    public async Task<ActionResult<IEnumerable<MemorySource>>> GetSourcesAsync(Guid chatId)
    {
        this._logger.LogInformation("Get imported sources of chat session {0}", chatId);

        if (await this._sessionRepository.TryFindByIdAsync(chatId.ToString()))
        {
            IEnumerable<MemorySource> sources = await this._sourceRepository.FindByChatIdAsync(chatId.ToString());

            return this.Ok(sources);
        }

        return this.NotFound($"No chat session found for chat id '{chatId}'.");
    }

    /// <summary>
    /// Update a chat message (e.g., to update plan state).
    /// </summary>
    /// <param name="chatId">The chat id.</param>
    /// <param name="messageId">The message id.</param>
    /// <param name="updateRequest">The update request containing new content.</param>
    [HttpPatch]
    [Route("chats/{chatId:guid}/messages/{messageId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [Authorize(Policy = AuthPolicyName.RequireChatParticipant)]
    public async Task<IActionResult> UpdateChatMessageAsync(
        [FromRoute] Guid chatId,
        [FromRoute] Guid messageId,
        [FromBody] UpdateMessageRequest updateRequest)
    {
        if (string.IsNullOrWhiteSpace(updateRequest.Content))
        {
            return this.BadRequest("Content cannot be empty.");
        }

        CopilotChatMessage? message = null;
        if (!await this._messageRepository.TryFindByIdAsync(messageId.ToString(), chatId.ToString(), callback: v => message = v))
        {
            return this.NotFound($"No message found for message id '{messageId}' in chat '{chatId}'.");
        }

        // Update message content (which may contain updated plan state JSON)
        message!.Content = updateRequest.Content;
        await this._messageRepository.UpsertAsync(message);

        this._logger.LogDebug("Updated message {0} in chat {1}.", messageId, chatId);

        return this.Ok(message);
    }

    /// <summary>
    /// Delete a single chat message.
    /// </summary>
    /// <param name="chatId">The chat id.</param>
    /// <param name="messageId">The message id to delete.</param>
    [HttpDelete]
    [Route("chats/{chatId:guid}/messages/{messageId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [Authorize(Policy = AuthPolicyName.RequireChatParticipant)]
    public async Task<IActionResult> DeleteChatMessageAsync(
        [FromServices] IHubContext<MessageRelayHub> messageRelayHubContext,
        [FromRoute] Guid chatId,
        [FromRoute] Guid messageId)
    {
        CopilotChatMessage? message = null;
        if (!await this._messageRepository.TryFindByIdAsync(messageId.ToString(), chatId.ToString(), callback: v => message = v))
        {
            return this.NotFound($"No message found for message id '{messageId}' in chat '{chatId}'.");
        }

        await this._messageRepository.DeleteAsync(message!);

        // Notify clients about the deleted message
        await messageRelayHubContext.Clients.Group(chatId.ToString()).SendAsync("MessageDeleted", chatId.ToString(), messageId.ToString());

        this._logger.LogDebug("Deleted message {0} from chat {1}.", messageId, chatId);

        return this.NoContent();
    }

    /// <summary>
    /// Delete (archive) a chat session. The chat is moved to the trash and can be restored within the retention period.
    /// </summary>
    /// <param name="chatId">The chat id.</param>
    [HttpDelete]
    [Route("chats/{chatId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    [Authorize(Policy = AuthPolicyName.RequireChatParticipant)]
    public async Task<IActionResult> DeleteChatSessionAsync(
        [FromServices] IHubContext<MessageRelayHub> messageRelayHubContext,
        Guid chatId,
        CancellationToken cancellationToken)
    {
        var chatIdString = chatId.ToString();
        ChatSession? chatToArchive = null;
        try
        {
            // Make sure the chat session exists
            chatToArchive = await this._sessionRepository.FindByIdAsync(chatIdString);
        }
        catch (KeyNotFoundException)
        {
            return this.NotFound($"No chat session found for chat id '{chatId}'.");
        }

        // Archive the chat and all its resources instead of deleting them
        try
        {
            await this.ArchiveChatResourcesAsync(chatToArchive, this._authInfo.UserId, cancellationToken);
        }
        catch (AggregateException)
        {
            return this.StatusCode(500, $"Failed to archive resources for chat id '{chatId}'.");
        }

        // Broadcast archive notification to all participants
        await messageRelayHubContext.Clients.Group(chatIdString).SendAsync(ChatArchivedClientCall, chatIdString, this._authInfo.UserId, cancellationToken: cancellationToken);

        this._logger.LogInformation("Chat {ChatId} archived by user {UserId}", chatIdString, this._authInfo.UserId);

        return this.NoContent();
    }

    /// <summary>
    /// Archives all resources (session, messages, participants, memory sources) associated with a chat session.
    /// This moves them to archive storage instead of deleting them permanently.
    /// </summary>
    /// <param name="chatSession">The chat session to archive.</param>
    /// <param name="deletedBy">The user ID who is deleting the chat.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    private async Task ArchiveChatResourcesAsync(ChatSession chatSession, string deletedBy, CancellationToken cancellationToken)
    {
        var chatId = chatSession.Id;
        var archiveTasks = new List<Task>();

        // Archive the chat session
        var archivedSession = ArchivedChatSession.FromChatSession(chatSession, deletedBy);
        archiveTasks.Add(this._archivedSessionRepository.CreateAsync(archivedSession));

        // Archive all participants
        var participants = await this._participantRepository.FindByChatIdAsync(chatId);
        foreach (var participant in participants)
        {
            var archivedParticipant = ArchivedChatParticipant.FromChatParticipant(participant, deletedBy);
            archiveTasks.Add(this._archivedParticipantRepository.CreateAsync(archivedParticipant));
        }

        // Archive all messages
        var messages = await this._messageRepository.FindByChatIdAsync(chatId);
        foreach (var message in messages)
        {
            var archivedMessage = ArchivedChatMessage.FromCopilotChatMessage(message, deletedBy);
            archiveTasks.Add(this._archivedMessageRepository.CreateAsync(archivedMessage));
        }

        // Archive all memory sources
        var sources = await this._sourceRepository.FindByChatIdAsync(chatId, false);
        foreach (var source in sources)
        {
            var archivedSource = ArchivedMemorySource.FromMemorySource(source, deletedBy);
            archiveTasks.Add(this._archivedSourceRepository.CreateAsync(archivedSource));
        }

        // Wait for all archive operations to complete
        Task archiveTask = Task.WhenAll(archiveTasks);
        try
        {
            await archiveTask;
        }
        catch (Exception ex)
        {
            if (archiveTask?.Exception?.InnerExceptions != null && archiveTask.Exception.InnerExceptions.Count != 0)
            {
                foreach (var innerEx in archiveTask.Exception.InnerExceptions)
                {
                    this._logger.LogError("Failed to archive entity for chat {ChatId}: {Error}", chatId, innerEx.Message);
                }
                throw archiveTask.Exception;
            }
            throw new AggregateException($"Archive failed for chat {chatId}.", ex);
        }

        // Now delete the original resources after successful archiving
        var deleteTasks = new List<Task>();

        foreach (var participant in participants)
        {
            deleteTasks.Add(this._participantRepository.DeleteAsync(participant));
        }

        foreach (var message in messages)
        {
            deleteTasks.Add(this._messageRepository.DeleteAsync(message));
        }

        foreach (var source in sources)
        {
            deleteTasks.Add(this._sourceRepository.DeleteAsync(source));
        }

        // Note: We keep semantic memories in the archive but remove them from the active index
        // They can be re-indexed on restore if needed
        deleteTasks.Add(this._memoryClient.RemoveChatMemoriesAsync(this._promptOptions.MemoryIndexName, chatId, cancellationToken));

        // Delete the original chat session
        deleteTasks.Add(this._sessionRepository.DeleteAsync(chatSession));

        Task deleteTask = Task.WhenAll(deleteTasks);
        try
        {
            await deleteTask;
        }
        catch (Exception ex)
        {
            // Log but don't throw - archiving succeeded, cleanup can be retried
            this._logger.LogWarning(ex, "Some cleanup tasks failed after archiving chat {ChatId}", chatId);
        }
    }

    /// <summary>
    /// Get all archived (deleted) chat sessions for the current user with summary counts.
    /// </summary>
    /// <returns>A list of archived chat session summaries.</returns>
    [HttpGet]
    [Route("chats/trash")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetArchivedChatsAsync()
    {
        var archivedChats = await this._archivedSessionRepository.FindByDeletedByAsync(this._authInfo.UserId);
        var orderedChats = archivedChats.OrderByDescending(c => c.DeletedAt).ToList();

        // Build summaries with counts
        var summaries = new List<ArchivedChatSummary>();
        foreach (var chat in orderedChats)
        {
            var messages = await this._archivedMessageRepository.FindByOriginalChatIdAsync(chat.OriginalChatId);
            var documents = await this._archivedSourceRepository.FindByOriginalChatIdAsync(chat.OriginalChatId);
            var participants = await this._archivedParticipantRepository.FindByOriginalChatIdAsync(chat.OriginalChatId);

            summaries.Add(new ArchivedChatSummary
            {
                Id = chat.Id,
                OriginalChatId = chat.OriginalChatId,
                Title = chat.Title,
                CreatedOn = chat.CreatedOn,
                DeletedAt = chat.DeletedAt,
                DeletedBy = chat.DeletedBy,
                SystemDescription = chat.SystemDescription,
                MemoryBalance = chat.MemoryBalance,
                EnabledPlugins = chat.EnabledPlugins,
                Version = chat.Version,
                Template = chat.Template,
                ModelId = chat.ModelId,
                MessageCount = messages.Count(),
                DocumentCount = documents.Count(),
                ParticipantCount = participants.Count()
            });
        }

        return this.Ok(summaries);
    }

    /// <summary>
    /// Get details of a specific archived chat.
    /// </summary>
    /// <param name="chatId">The original chat id.</param>
    [HttpGet]
    [Route("chats/trash/{chatId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetArchivedChatByIdAsync(Guid chatId)
    {
        var archivedChat = await this._archivedSessionRepository.FindByOriginalChatIdAsync(chatId.ToString());
        if (archivedChat == null)
        {
            return this.NotFound($"No archived chat found for chat id '{chatId}'.");
        }

        // Verify the current user deleted this chat
        if (archivedChat.DeletedBy != this._authInfo.UserId)
        {
            return this.Forbid();
        }

        return this.Ok(archivedChat);
    }

    /// <summary>
    /// Get messages from an archived chat.
    /// </summary>
    /// <param name="chatId">The original chat id.</param>
    [HttpGet]
    [Route("chats/trash/{chatId:guid}/messages")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetArchivedChatMessagesAsync(Guid chatId)
    {
        var archivedChat = await this._archivedSessionRepository.FindByOriginalChatIdAsync(chatId.ToString());
        if (archivedChat == null)
        {
            return this.NotFound($"No archived chat found for chat id '{chatId}'.");
        }

        // Verify the current user deleted this chat
        if (archivedChat.DeletedBy != this._authInfo.UserId)
        {
            return this.Forbid();
        }

        var archivedMessages = await this._archivedMessageRepository.FindByOriginalChatIdAsync(chatId.ToString());
        return this.Ok(archivedMessages.OrderByDescending(m => m.Timestamp));
    }

    /// <summary>
    /// Restore an archived chat session.
    /// </summary>
    /// <param name="chatId">The original chat id.</param>
    [HttpPost]
    [Route("chats/{chatId:guid}/restore")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> RestoreChatSessionAsync(
        [FromServices] IHubContext<MessageRelayHub> messageRelayHubContext,
        Guid chatId,
        CancellationToken cancellationToken)
    {
        var chatIdString = chatId.ToString();
        var archivedChat = await this._archivedSessionRepository.FindByOriginalChatIdAsync(chatIdString);
        if (archivedChat == null)
        {
            return this.NotFound($"No archived chat found for chat id '{chatId}'.");
        }

        // Verify the current user deleted this chat (only they can restore it)
        if (archivedChat.DeletedBy != this._authInfo.UserId)
        {
            return this.Forbid();
        }

        try
        {
            await this.RestoreChatResourcesAsync(archivedChat, cancellationToken);
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Failed to restore chat {ChatId}. Exception: {ExceptionType} - {Message}",
                chatIdString, ex.GetType().Name, ex.Message);

            // Include inner exception details if available
            var innerMessage = ex.InnerException?.Message ?? "No inner exception";
            return this.StatusCode(500, $"Failed to restore chat id '{chatId}'. Error: {ex.Message} (Inner: {innerMessage})");
        }

        // Broadcast restore notification
        await messageRelayHubContext.Clients.Group(chatIdString).SendAsync(ChatRestoredClientCall, chatIdString, this._authInfo.UserId, cancellationToken: cancellationToken);

        this._logger.LogInformation("Chat {ChatId} restored by user {UserId}", chatIdString, this._authInfo.UserId);

        // Return the restored chat session
        var restoredChat = await this._sessionRepository.FindByIdAsync(chatIdString);
        return this.Ok(restoredChat);
    }

    /// <summary>
    /// Restores all resources from archive to active storage.
    /// Uses Upsert to handle cases where partial restore data may already exist.
    /// </summary>
    private async Task RestoreChatResourcesAsync(ArchivedChatSession archivedSession, CancellationToken cancellationToken)
    {
        var chatId = archivedSession.OriginalChatId;
        var restoreTasks = new List<Task>();

        // Restore the chat session (upsert in case of partial previous restore)
        var chatSession = archivedSession.ToChatSession();
        restoreTasks.Add(this._sessionRepository.UpsertAsync(chatSession));

        // Restore all participants
        var archivedParticipants = await this._archivedParticipantRepository.FindByOriginalChatIdAsync(chatId);
        foreach (var archivedParticipant in archivedParticipants)
        {
            var participant = archivedParticipant.ToChatParticipant();
            restoreTasks.Add(this._participantRepository.UpsertAsync(participant));
        }

        // Restore all messages
        var archivedMessages = await this._archivedMessageRepository.FindByOriginalChatIdAsync(chatId);
        foreach (var archivedMessage in archivedMessages)
        {
            var message = archivedMessage.ToCopilotChatMessage();
            restoreTasks.Add(this._messageRepository.UpsertAsync(message));
        }

        // Restore all memory sources
        var archivedSources = await this._archivedSourceRepository.FindByOriginalChatIdAsync(chatId);
        foreach (var archivedSource in archivedSources)
        {
            var source = archivedSource.ToMemorySource();
            restoreTasks.Add(this._sourceRepository.UpsertAsync(source));
        }

        // Wait for all restore operations to complete
        await Task.WhenAll(restoreTasks);

        // Now clean up the archive
        var cleanupTasks = new List<Task>
        {
            this._archivedSessionRepository.DeleteAsync(archivedSession)
        };

        foreach (var participant in archivedParticipants)
        {
            cleanupTasks.Add(this._archivedParticipantRepository.DeleteAsync(participant));
        }

        foreach (var message in archivedMessages)
        {
            cleanupTasks.Add(this._archivedMessageRepository.DeleteAsync(message));
        }

        foreach (var source in archivedSources)
        {
            cleanupTasks.Add(this._archivedSourceRepository.DeleteAsync(source));
        }

        await Task.WhenAll(cleanupTasks);

        // Note: Semantic memories would need to be re-indexed if they were important
        // This could be done as a background job if needed
    }

    /// <summary>
    /// Permanently delete an archived chat session. This cannot be undone.
    /// </summary>
    /// <param name="chatId">The original chat id.</param>
    [HttpDelete]
    [Route("chats/{chatId:guid}/permanent")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> PermanentlyDeleteChatSessionAsync(Guid chatId)
    {
        var chatIdString = chatId.ToString();
        var archivedChat = await this._archivedSessionRepository.FindByOriginalChatIdAsync(chatIdString);
        if (archivedChat == null)
        {
            return this.NotFound($"No archived chat found for chat id '{chatId}'.");
        }

        // Verify the current user deleted this chat (only they can permanently delete it)
        if (archivedChat.DeletedBy != this._authInfo.UserId)
        {
            return this.Forbid();
        }

        try
        {
            await this.PermanentlyDeleteArchivedChatAsync(archivedChat);
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Failed to permanently delete chat {ChatId}", chatIdString);
            return this.StatusCode(500, $"Failed to permanently delete chat id '{chatId}'.");
        }

        this._logger.LogInformation("Chat {ChatId} permanently deleted by user {UserId}", chatIdString, this._authInfo.UserId);

        return this.NoContent();
    }

    /// <summary>
    /// Permanently deletes all archived resources for a chat.
    /// </summary>
    private async Task PermanentlyDeleteArchivedChatAsync(ArchivedChatSession archivedSession)
    {
        var chatId = archivedSession.OriginalChatId;
        var deleteTasks = new List<Task>();

        // Delete all archived messages
        await this._archivedMessageRepository.DeleteByOriginalChatIdAsync(chatId);

        // Delete all archived participants
        await this._archivedParticipantRepository.DeleteByOriginalChatIdAsync(chatId);

        // Delete all archived memory sources
        await this._archivedSourceRepository.DeleteByOriginalChatIdAsync(chatId);

        // Delete the archived session itself
        await this._archivedSessionRepository.DeleteAsync(archivedSession);
    }
}
