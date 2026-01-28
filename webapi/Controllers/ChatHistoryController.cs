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
    private const string GetChatRoute = "GetChatRoute";

    private readonly ILogger<ChatHistoryController> _logger;
    private readonly IKernelMemory _memoryClient;
    private readonly ChatSessionRepository _sessionRepository;
    private readonly ChatMessageRepository _messageRepository;
    private readonly ChatParticipantRepository _participantRepository;
    private readonly ChatMemorySourceRepository _sourceRepository;
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

                // Validate that the user has access to this template (user ID or group membership check)
                // Skip this check in dev mode for easier testing
                if (!isDevMode && !template.IsUserAllowed(this._authInfo.UserId, this._authInfo.Groups))
                {
                    this._logger.LogWarning(
                        "User {UserId} attempted to create chat with template '{Template}' but does not have access. User groups: [{UserGroups}], Required groups: [{AllowedGroups}], Required users: [{AllowedUsers}]",
                        this._authInfo.UserId,
                        chatParameters.Template,
                        string.Join(", ", this._authInfo.Groups),
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
    /// Delete a chat session.
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
        ChatSession? chatToDelete = null;
        try
        {
            // Make sure the chat session exists
            chatToDelete = await this._sessionRepository.FindByIdAsync(chatIdString);
        }
        catch (KeyNotFoundException)
        {
            return this.NotFound($"No chat session found for chat id '{chatId}'.");
        }

        // Delete any resources associated with the chat session.
        try
        {
            await this.DeleteChatResourcesAsync(chatIdString, cancellationToken);
        }
        catch (AggregateException)
        {
            return this.StatusCode(500, $"Failed to delete resources for chat id '{chatId}'.");
        }

        // Delete chat session and broadcast update to all participants.
        await this._sessionRepository.DeleteAsync(chatToDelete);
        await messageRelayHubContext.Clients.Group(chatIdString).SendAsync(ChatDeletedClientCall, chatIdString, this._authInfo.UserId, cancellationToken: cancellationToken);

        return this.NoContent();
    }

    /// <summary>
    /// Deletes all associated resources (messages, memories, participants) associated with a chat session.
    /// </summary>
    /// <param name="chatId">The chat id.</param>
    private async Task DeleteChatResourcesAsync(string chatId, CancellationToken cancellationToken)
    {
        var cleanupTasks = new List<Task>();

        // Create and store the tasks for deleting all users tied to the chat.
        var participants = await this._participantRepository.FindByChatIdAsync(chatId);
        foreach (var participant in participants)
        {
            cleanupTasks.Add(this._participantRepository.DeleteAsync(participant));
        }

        // Create and store the tasks for deleting chat messages.
        var messages = await this._messageRepository.FindByChatIdAsync(chatId);
        foreach (var message in messages)
        {
            cleanupTasks.Add(this._messageRepository.DeleteAsync(message));
        }

        // Create and store the tasks for deleting memory sources.
        var sources = await this._sourceRepository.FindByChatIdAsync(chatId, false);
        foreach (var source in sources)
        {
            cleanupTasks.Add(this._sourceRepository.DeleteAsync(source));
        }

        // Create and store the tasks for deleting semantic memories.
        cleanupTasks.Add(this._memoryClient.RemoveChatMemoriesAsync(this._promptOptions.MemoryIndexName, chatId, cancellationToken));

        // Create a task that represents the completion of all cleanupTasks
        Task aggregationTask = Task.WhenAll(cleanupTasks);
        try
        {
            // Await the completion of all tasks in parallel
            await aggregationTask;
        }
        catch (Exception ex)
        {
            // Handle any exceptions that occurred during the tasks
            if (aggregationTask?.Exception?.InnerExceptions != null && aggregationTask.Exception.InnerExceptions.Count != 0)
            {
                foreach (var innerEx in aggregationTask.Exception.InnerExceptions)
                {
                    this._logger.LogInformation("Failed to delete an entity of chat {0}: {1}", chatId, innerEx.Message);
                }

                throw aggregationTask.Exception;
            }

            throw new AggregateException($"Resource deletion failed for chat {chatId}.", ex);
        }
    }
}
