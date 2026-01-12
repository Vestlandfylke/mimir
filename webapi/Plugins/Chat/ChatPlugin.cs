// Copyright (c) Microsoft. All rights reserved.

using System.ComponentModel;
using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using CopilotChat.WebApi.Auth;
using CopilotChat.WebApi.Hubs;
using CopilotChat.WebApi.Models.Response;
using CopilotChat.WebApi.Models.Storage;
using CopilotChat.WebApi.Options;
using CopilotChat.WebApi.Plugins.Utils;
using CopilotChat.WebApi.Services;
using CopilotChat.WebApi.Storage;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using Microsoft.KernelMemory;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.AzureOpenAI;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using CopilotChatMessage = CopilotChat.WebApi.Models.Storage.CopilotChatMessage;
using FunctionCallContent = Microsoft.SemanticKernel.FunctionCallContent;

namespace CopilotChat.WebApi.Plugins.Chat;

/// <summary>
/// ChatPlugin offers a more coherent chat experience by using memories
/// to extract conversation history and user intentions.
/// </summary>
public class ChatPlugin
{
    /// <summary>
    /// A kernel instance to create a completion function since each invocation
    /// of the <see cref="ChatAsync"/> function will generate a new prompt dynamically.
    /// </summary>
    private readonly Kernel _kernel;

    /// <summary>
    /// Client for the kernel memory service.
    /// </summary>
    private readonly IKernelMemory _memoryClient;

    /// <summary>
    /// A logger instance to log events.
    /// </summary>
    private ILogger _logger;

    /// <summary>
    /// A repository to save and retrieve chat messages.
    /// </summary>
    private readonly ChatMessageRepository _chatMessageRepository;

    /// <summary>
    /// A repository to save and retrieve chat sessions.
    /// </summary>
    private readonly ChatSessionRepository _chatSessionRepository;

    /// <summary>
    /// A SignalR hub context to broadcast updates of the execution.
    /// </summary>
    private readonly IHubContext<MessageRelayHub> _messageRelayHubContext;

    /// <summary>
    /// Settings containing prompt texts.
    /// </summary>
    private readonly PromptsOptions _promptOptions;

    /// <summary>
    /// A kernel memory retriever instance to query semantic memories.
    /// </summary>
    private readonly KernelMemoryRetriever _kernelMemoryRetriever;

    /// <summary>
    /// Azure content safety moderator.
    /// </summary>
    private readonly AzureContentSafety? _contentSafety = null;

    /// <summary>
    /// Service for handling MCP tool plan approval workflow.
    /// </summary>
    private readonly McpPlanService? _mcpPlanService;

    /// <summary>
    /// Telemetry service for tracking cache metrics and other events.
    /// </summary>
    private readonly ITelemetryService? _telemetryService;

    /// <summary>
    /// Factory for creating model-specific kernels and getting model configuration.
    /// </summary>
    private readonly ModelKernelFactory? _modelKernelFactory;

    /// <summary>
    /// Regex pattern to extract thinking/reasoning content from model responses.
    /// Matches content within &lt;thinking&gt;...&lt;/thinking&gt; tags.
    /// </summary>
    private static readonly Regex s_thinkingTagRegex = new(@"<thinking>(.*?)</thinking>", RegexOptions.Singleline | RegexOptions.Compiled);




    /// <summary>
    /// Create a new instance of <see cref="ChatPlugin"/>.
    /// </summary>
    public ChatPlugin(
        Kernel kernel,
        IKernelMemory memoryClient,
        ChatMessageRepository chatMessageRepository,
        ChatSessionRepository chatSessionRepository,
        ChatMemorySourceRepository sourceRepository,
        IHubContext<MessageRelayHub> messageRelayHubContext,
        IOptions<PromptsOptions> promptOptions,
        IOptions<DocumentMemoryOptions> documentImportOptions,
        ILogger logger,
        AzureContentSafety? contentSafety = null,
        McpPlanService? mcpPlanService = null,
        ITelemetryService? telemetryService = null,
        ModelKernelFactory? modelKernelFactory = null)
    {
        this._logger = logger;
        this._kernel = kernel;
        this._memoryClient = memoryClient;
        this._chatMessageRepository = chatMessageRepository;
        this._chatSessionRepository = chatSessionRepository;
        this._messageRelayHubContext = messageRelayHubContext;
        // Clone the prompt options to avoid modifying the original prompt options.
        this._promptOptions = promptOptions.Value.Copy();

        this._kernelMemoryRetriever = new KernelMemoryRetriever(promptOptions, chatSessionRepository, sourceRepository, memoryClient, logger);

        this._contentSafety = contentSafety;
        this._mcpPlanService = mcpPlanService;
        this._telemetryService = telemetryService;
        this._modelKernelFactory = modelKernelFactory;
    }

    /// <summary>
    /// Method that wraps GetAllowedChatHistoryAsync to get allotted history messages as one string.
    /// GetAllowedChatHistoryAsync optionally updates a ChatHistory object with the allotted messages,
    /// but the ChatHistory type is not supported when calling from a rendered prompt, so this wrapper bypasses the chatHistory parameter.
    /// </summary>
    /// <param name="cancellationToken">The cancellation token.</param>
    [KernelFunction, Description("Extract chat history")]
    public Task<string> ExtractChatHistory(
        [Description("Chat ID to extract history from")]
        string chatId,
        [Description("Maximum number of tokens")]
        int tokenLimit,
        CancellationToken cancellationToken = default)
    {
        return this.GetAllowedChatHistoryAsync(chatId, tokenLimit, cancellationToken: cancellationToken);
    }

    /// <summary>
    /// Extract chat history within token limit as a formatted string and optionally update the ChatHistory object with the allotted messages
    /// </summary>
    /// <param name="chatId">Chat ID to extract history from.</param>
    /// <param name="tokenLimit">Maximum number of tokens.</param>
    /// <param name="chatHistory">Optional ChatHistory object tracking allotted messages.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>Chat history as a string.</returns>
    private async Task<string> GetAllowedChatHistoryAsync(
        string chatId,
        int tokenLimit,
        ChatHistory? chatHistory = null,
        CancellationToken cancellationToken = default)
    {
        var sortedMessages = await this._chatMessageRepository.FindByChatIdAsync(chatId, 0, 100);

        ChatHistory allottedChatHistory = new();
        var remainingToken = tokenLimit;
        string historyText = string.Empty;

        foreach (var chatMessage in sortedMessages)
        {
            var formattedMessage = chatMessage.ToFormattedString();

            if (chatMessage.Type == CopilotChatMessage.ChatMessageType.Document)
            {
                continue;
            }

            var promptRole = chatMessage.AuthorRole == CopilotChatMessage.AuthorRoles.Bot ? AuthorRole.System : AuthorRole.User;
            int tokenCount = chatHistory is not null ? TokenUtils.GetContextMessageTokenCount(promptRole, formattedMessage) : TokenUtils.TokenCount(formattedMessage);

            if (remainingToken - tokenCount >= 0)
            {
                historyText = $"{formattedMessage}\n{historyText}";
                if (chatMessage.AuthorRole == CopilotChatMessage.AuthorRoles.Bot)
                {
                    // Message doesn't have to be formatted for bot. This helps with asserting a natural language response from the LLM (no date or author preamble).
                    allottedChatHistory.AddAssistantMessage(chatMessage.Content.Trim());
                }
                else
                {
                    // Omit user name if Auth is disabled.
                    var userMessage = PassThroughAuthenticationHandler.IsDefaultUser(chatMessage.UserId)
                        ? $"[{chatMessage.Timestamp.ToString("G", CultureInfo.CurrentCulture)}] {chatMessage.Content}"
                        : formattedMessage;
                    allottedChatHistory.AddUserMessage(userMessage.Trim());
                }

                remainingToken -= tokenCount;
            }
            else
            {
                break;
            }
        }

        chatHistory?.AddRange(allottedChatHistory.Reverse());

        return $"Chat history:\n{historyText.Trim()}";
    }

    /// <summary>
    /// This is the entry point for getting a chat response. It manages the token limit, saves
    /// messages to memory, and fills in the necessary context variables for completing the
    /// prompt that will be rendered by the template engine.
    /// </summary>
    /// <param name="cancellationToken">The cancellation token.</param>
    [KernelFunction, Description("Get chat response")]
    public async Task<KernelArguments> ChatAsync(
        [Description("The new message")] string message,
        [Description("Unique and persistent identifier for the user")]
        string userId,
        [Description("Name of the user")] string userName,
        [Description("Unique and persistent identifier for the chat")]
        string chatId,
        [Description("Type of the message")] string messageType,
        KernelArguments context,
        CancellationToken cancellationToken = default)
    {
        // Set the system description in the prompt options
        await this.SetSystemDescriptionAsync(chatId, cancellationToken);

        // Save this new message to memory such that subsequent chat responses can use it
        await this.UpdateBotResponseStatusOnClientAsync(chatId, "Lagrar brukarmelding i pratehistorikk", cancellationToken);
        var newUserMessage = await this.SaveNewMessageAsync(message, userId, userName, chatId, messageType, cancellationToken);

        // Clone the context to avoid modifying the original context variables.
        KernelArguments chatContext = new(context);
        chatContext["knowledgeCutoff"] = this._promptOptions.KnowledgeCutoffDate;

        CopilotChatMessage chatMessage = await this.GetChatResponseAsync(chatId, userId, chatContext, newUserMessage, cancellationToken);
        context["input"] = chatMessage.Content;

        if (chatMessage.TokenUsage != null)
        {
            context["tokenUsage"] = JsonSerializer.Serialize(chatMessage.TokenUsage);
        }
        else
        {
            this._logger.LogWarning("ChatPlugin.ChatAsync token usage unknown. Ensure token management has been implemented correctly.");
        }

        return context;
    }

    /// <summary>
    /// Generate the necessary chat context to create a prompt then invoke the model to get a response.
    /// </summary>
    /// <param name="chatId">The chat ID</param>
    /// <param name="userId">The user ID</param>
    /// <param name="chatContext">The KernelArguments.</param>
    /// <param name="userMessage">ChatMessage object representing new user message.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The created chat message containing the model-generated response.</returns>
    private async Task<CopilotChatMessage> GetChatResponseAsync(string chatId, string userId, KernelArguments chatContext, CopilotChatMessage userMessage, CancellationToken cancellationToken)
    {
        // Render system instruction components and create the meta-prompt template
        var systemInstructions = await AsyncUtils.SafeInvokeAsync(
            () => this.RenderSystemInstructionsAsync(chatId, chatContext, cancellationToken), nameof(this.RenderSystemInstructionsAsync));
        ChatHistory metaPrompt = new(systemInstructions);

        // Extract audience and user intent IN PARALLEL using the fast model
        // This significantly reduces latency by running both extractions simultaneously
        await this.UpdateBotResponseStatusOnClientAsync(chatId, "Analyserer melding (rask modell)", cancellationToken);

        var audience = string.Empty;
        string userIntent;

        // Check if we need to extract audience (only if Auth is enabled)
        bool needsAudience = !PassThroughAuthenticationHandler.IsDefaultUser(userId);

        if (needsAudience)
        {
            // Run both extractions in parallel using the fast kernel
            var audienceTask = AsyncUtils.SafeInvokeAsync(
                () => this.GetAudienceAsync(chatContext, cancellationToken), nameof(this.GetAudienceAsync));
            var intentTask = AsyncUtils.SafeInvokeAsync(
                () => this.GetUserIntentAsync(chatContext, cancellationToken), nameof(this.GetUserIntentAsync));

            // Wait for both to complete
            await Task.WhenAll(audienceTask, intentTask);

            audience = await audienceTask;
            userIntent = await intentTask;

            metaPrompt.AddSystemMessage(audience);
        }
        else
        {
            // Only extract user intent (no audience needed)
            userIntent = await AsyncUtils.SafeInvokeAsync(
                () => this.GetUserIntentAsync(chatContext, cancellationToken), nameof(this.GetUserIntentAsync));
        }

        metaPrompt.AddSystemMessage(userIntent);

        // Calculate max amount of tokens to use for memories
        int maxRequestTokenBudget = this.GetMaxRequestTokenBudget();
        // Calculate tokens used so far: system instructions, audience extraction and user intent
        int tokensUsed = TokenUtils.GetContextMessagesTokenCount(metaPrompt);
        int chatMemoryTokenBudget = maxRequestTokenBudget
                                    - tokensUsed
                                    - TokenUtils.GetContextMessageTokenCount(AuthorRole.User, userMessage.ToFormattedString());
        chatMemoryTokenBudget = (int)(chatMemoryTokenBudget * this._promptOptions.MemoriesResponseContextWeight);

        // Query relevant semantic and document memories
        await this.UpdateBotResponseStatusOnClientAsync(chatId, "Henter kontekst- og dokumentminne", cancellationToken);
        (var memoryText, var citationMap) = await this._kernelMemoryRetriever.QueryMemoriesAsync(userIntent, chatId, chatMemoryTokenBudget);
        if (!string.IsNullOrWhiteSpace(memoryText))
        {
            metaPrompt.AddSystemMessage(memoryText);
            tokensUsed += TokenUtils.GetContextMessageTokenCount(AuthorRole.System, memoryText);
        }

        // Add as many chat history messages to meta-prompt as the token budget will allow
        await this.UpdateBotResponseStatusOnClientAsync(chatId, "Henter historikken", cancellationToken);
        string allowedChatHistory = await this.GetAllowedChatHistoryAsync(chatId, maxRequestTokenBudget - tokensUsed, metaPrompt, cancellationToken);

        // Store token usage of prompt template
        chatContext[TokenUtils.GetFunctionKey("SystemMetaPrompt")] = TokenUtils.GetContextMessagesTokenCount(metaPrompt).ToString(CultureInfo.CurrentCulture);

        // Stream the response to the client
        var promptView = new BotResponsePrompt(systemInstructions, audience, userIntent, memoryText, allowedChatHistory, metaPrompt);

        return await this.HandleBotResponseAsync(chatId, userId, chatContext, promptView, citationMap.Values.AsEnumerable(), cancellationToken, userIntent);
    }

    /// <summary>
    /// Helper function to render system instruction components.
    /// Optimized for Azure OpenAI prompt caching by placing static content first.
    /// Azure OpenAI caches prompts where the first 1024+ tokens are identical,
    /// reducing input costs by 90% for cached tokens.
    /// </summary>
    /// <param name="chatId">The chat ID</param>
    /// <param name="context">The KernelArguments.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    private async Task<string> RenderSystemInstructionsAsync(string chatId, KernelArguments context, CancellationToken cancellationToken)
    {
        // Render system instruction components
        await this.UpdateBotResponseStatusOnClientAsync(chatId, "Førebur spørsmål", cancellationToken);

        var promptTemplateFactory = new KernelPromptTemplateFactory();

        // PROMPT CACHING OPTIMIZATION:
        // Structure the prompt with static content first to maximize cache hits.
        // Azure OpenAI automatically caches prompts where the first 1024+ tokens match.

        // 1. Static cache prefix (identical for all requests - maximizes caching)
        var cachePrefix = this._promptOptions.SystemCachePrefix;

        // 2. Session-specific system persona (same for all messages in a session)
        var promptTemplate = promptTemplateFactory.Create(new PromptTemplateConfig(this._promptOptions.SystemPersona));
        var systemPersona = await promptTemplate.RenderAsync(this._kernel, context, cancellationToken);

        // 3. Add reasoning instruction if model supports it
        // IMPORTANT: Place at the START of the prompt - models pay more attention to beginnings
        ChatSession? chatSession = null;
        await this._chatSessionRepository.TryFindByIdAsync(chatId, callback: v => chatSession = v);
        if (chatSession != null && this.IsReasoningEnabled(chatSession.ModelId))
        {
            var effort = this.GetReasoningEffort(chatSession.ModelId);
            this._logger.LogInformation("Reasoning mode enabled for chat {ChatId} with model {ModelId}, effort level: {Effort}",
                chatId, chatSession.ModelId, effort);
            // Prepend reasoning instruction at the very start for maximum visibility
            systemPersona = this.GetReasoningInstruction(effort) + "\n\n" + systemPersona;
        }

        // Combine: Static prefix first (for optimal caching), then session-specific content
        if (!string.IsNullOrWhiteSpace(cachePrefix))
        {
            return $"{cachePrefix}\n\n{systemPersona}";
        }

        return systemPersona;
    }

    /// <summary>
    /// Helper function to handle final steps of bot response generation, including streaming to client,
    /// generating semantic text memory, calculating final token usages, and saving to chat history.
    /// </summary>
    /// <param name="chatId">The chat ID</param>
    /// <param name="userId">The user ID</param>
    /// <param name="chatContext">Chat context.</param>
    /// <param name="promptView">The prompt view.</param>
    /// <param name="citations">Citation sources.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <param name="userIntent">The extracted user intent for plan creation.</param>
    private async Task<CopilotChatMessage> HandleBotResponseAsync(
        string chatId,
        string userId,
        KernelArguments chatContext,
        BotResponsePrompt promptView,
        IEnumerable<CitationSource>? citations,
        CancellationToken cancellationToken,
        string? userIntent = null)
    {
        // Get bot response and stream to client
        // Note: Status message is set inside StreamResponseToClientAsync based on model type
        CopilotChatMessage chatMessage = await AsyncUtils.SafeInvokeAsync(
            () => this.StreamResponseToClientAsync(chatId, userId, promptView, cancellationToken, citations, userIntent), nameof(this.StreamResponseToClientAsync));

        // Save the message into chat history
        await this.UpdateBotResponseStatusOnClientAsync(chatId, "Lagrar melding i historikken", cancellationToken);
        await this._chatMessageRepository.UpsertAsync(chatMessage);

        // Extract semantic chat memory
        await this.UpdateBotResponseStatusOnClientAsync(chatId, "Genererer kontekstminne", cancellationToken);
        await AsyncUtils.SafeInvokeAsync(
            () => SemanticChatMemoryExtractor.ExtractSemanticChatMemoryAsync(
                chatId,
                this._memoryClient,
                this._kernel,
                chatContext,
                this._promptOptions,
                this._logger,
                cancellationToken), nameof(SemanticChatMemoryExtractor.ExtractSemanticChatMemoryAsync));

        // Calculate total token usage for dependency functions and prompt template
        await this.UpdateBotResponseStatusOnClientAsync(chatId, "Lagrar tokenbruk", cancellationToken);
        chatMessage.TokenUsage = this.GetTokenUsages(chatContext, chatMessage.Content);

        // Update the message on client and in chat history with final completion token usage
        await this.UpdateMessageOnClient(chatMessage, cancellationToken);
        await this._chatMessageRepository.UpsertAsync(chatMessage);

        return chatMessage;
    }

    /// <summary>
    /// Extract the list of participants from the conversation history.
    /// Note that only those who have spoken will be included.
    /// </summary>
    /// <param name="context">Kernel context variables.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    private async Task<string> GetAudienceAsync(KernelArguments context, CancellationToken cancellationToken)
    {
        // Clone the context to avoid modifying the original context variables
        KernelArguments audienceContext = new(context);
        int historyTokenBudget =
            this._promptOptions.CompletionTokenLimit -
            this._promptOptions.ResponseTokenLimit -
            TokenUtils.TokenCount(string.Join("\n\n", new string[]
                {
                    this._promptOptions.SystemAudience,
                    this._promptOptions.SystemAudienceContinuation,
                })
            );

        audienceContext["tokenLimit"] = historyTokenBudget.ToString(new NumberFormatInfo());

        // Use fast model service for audience extraction (faster model like gpt-4o-mini)
        // If "fast" service is not available, Semantic Kernel will automatically use the default service
        var settings = this.CreateIntentCompletionSettings();
        settings.ServiceId = "fast";

        var completionFunction = this._kernel.CreateFunctionFromPrompt(
            this._promptOptions.SystemAudienceExtraction,
            settings,
            functionName: "SystemAudienceExtraction",
            description: "Extract audience");

        var result = await completionFunction.InvokeAsync(this._kernel, audienceContext, cancellationToken);

        // Get token usage from ChatCompletion result and add to original context
        string? tokenUsage = TokenUtils.GetFunctionTokenUsage(result, this._logger);
        if (tokenUsage is not null)
        {
            context[TokenUtils.GetFunctionKey("SystemAudienceExtraction")] = tokenUsage;
        }
        else
        {
            this._logger.LogError("Unable to determine token usage for audienceExtraction");
        }

        return $"List of participants: {result}";
    }

    /// <summary>
    /// Extract user intent from the conversation history.
    /// </summary>
    /// <param name="context">Kernel context.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    private async Task<string> GetUserIntentAsync(KernelArguments context, CancellationToken cancellationToken)
    {
        // Clone the context to avoid modifying the original context variables
        KernelArguments intentContext = new(context);

        int tokenBudget =
            this._promptOptions.CompletionTokenLimit -
            this._promptOptions.ResponseTokenLimit -
            TokenUtils.TokenCount(string.Join("\n", new string[]
                {
                    this._promptOptions.SystemPersona,
                    this._promptOptions.SystemIntent,
                    this._promptOptions.SystemIntentContinuation
                })
            );

        intentContext["tokenLimit"] = tokenBudget.ToString(new NumberFormatInfo());
        intentContext["knowledgeCutoff"] = this._promptOptions.KnowledgeCutoffDate;

        // Use fast model service for intent extraction (faster model like gpt-4o-mini)
        // If "fast" service is not available, Semantic Kernel will automatically use the default service
        var settings = this.CreateIntentCompletionSettings();
        settings.ServiceId = "fast";

        var completionFunction = this._kernel.CreateFunctionFromPrompt(
            this._promptOptions.SystemIntentExtraction,
            settings,
            functionName: "UserIntentExtraction",
            description: "Extract user intent");

        var result = await completionFunction.InvokeAsync(this._kernel, intentContext, cancellationToken);

        // Get token usage from ChatCompletion result and add to original context
        string? tokenUsage = TokenUtils.GetFunctionTokenUsage(result, this._logger);
        if (tokenUsage is not null)
        {
            context[TokenUtils.GetFunctionKey("SystemIntentExtraction")] = tokenUsage;
        }
        else
        {
            this._logger.LogError("Unable to determine token usage for userIntentExtraction");
        }

        return $"User intent: {result}";
    }

    /// <summary>
    /// Save a new message to the chat history.
    /// </summary>
    /// <param name="message">The message</param>
    /// <param name="userId">The user ID</param>
    /// <param name="userName"></param>
    /// <param name="chatId">The chat ID</param>
    /// <param name="type">Type of the message</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    private async Task<CopilotChatMessage> SaveNewMessageAsync(string message, string userId, string userName, string chatId, string type, CancellationToken cancellationToken)
    {
        // Make sure the chat exists.
        if (!await this._chatSessionRepository.TryFindByIdAsync(chatId))
        {
            throw new ArgumentException("Chat session does not exist.");
        }

        var chatMessage = new CopilotChatMessage(
            userId,
            userName,
            chatId,
            message,
            string.Empty,
            null,
            CopilotChatMessage.AuthorRoles.User,
            // Default to a standard message if the `type` is not recognized
            Enum.TryParse(type, out CopilotChatMessage.ChatMessageType typeAsEnum) && Enum.IsDefined(typeof(CopilotChatMessage.ChatMessageType), typeAsEnum)
                ? typeAsEnum
                : CopilotChatMessage.ChatMessageType.Message);

        await this._chatMessageRepository.CreateAsync(chatMessage);
        return chatMessage;
    }

    /// <summary>
    /// Save a new response to the chat history.
    /// </summary>
    /// <param name="response">Response from the chat.</param>
    /// <param name="prompt">Prompt used to generate the response.</param>
    /// <param name="chatId">The chat ID</param>
    /// <param name="userId">The user ID</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <param name="tokenUsage">Total token usage of response completion</param>
    /// <param name="citations">Citations for the message</param>
    /// <returns>The created chat message.</returns>
    private async Task<CopilotChatMessage> SaveNewResponseAsync(
        string response,
        string prompt,
        string chatId,
        string userId,
        CancellationToken cancellationToken,
        Dictionary<string, int>? tokenUsage = null,
        IEnumerable<CitationSource>? citations = null
    )
    {
        // Make sure the chat exists.
        if (!await this._chatSessionRepository.TryFindByIdAsync(chatId))
        {
            throw new ArgumentException("Chat session does not exist.");
        }

        // Save message to chat history
        var chatMessage = await this.CreateBotMessageOnClient(
            chatId,
            userId,
            prompt,
            response,
            cancellationToken,
            citations,
            tokenUsage
        );
        await this._chatMessageRepository.UpsertAsync(chatMessage);

        return chatMessage;
    }

    /// <summary>
    /// Updates previously saved response in the chat history.
    /// </summary>
    /// <param name="updatedResponse">Updated response from the chat.</param>
    /// <param name="messageId">The chat message ID.</param>
    /// <param name="chatId">The chat ID that's used as the partition Id.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    private async Task UpdateChatMessageContentAsync(string updatedResponse, string messageId, string chatId, CancellationToken cancellationToken)
    {
        CopilotChatMessage? chatMessage = null;
        if (!await this._chatMessageRepository.TryFindByIdAsync(messageId, chatId, callback: v => chatMessage = v))
        {
            throw new ArgumentException($"Chat message {messageId} does not exist.");
        }

        chatMessage!.Content = updatedResponse;
        await this._chatMessageRepository.UpsertAsync(chatMessage);
    }

    /// <summary>
    /// Create `AzureOpenAIPromptExecutionSettings` for chat response.
    /// GPT-5.x models require `max_completion_tokens` (not `max_tokens`), so we enable the SK flag.
    /// </summary>
    /// <param name="requireApproval">If true, enables kernel functions without auto-invoke to allow plan approval.</param>
    /// <param name="chatId">Optional chat ID used as the User parameter to improve cache routing.</param>
    /// <param name="modelId">Optional model ID to check for native reasoning support.</param>
    private AzureOpenAIPromptExecutionSettings CreateChatRequestSettings(bool requireApproval = false, string? chatId = null, string? modelId = null)
    {
        var settings = new AzureOpenAIPromptExecutionSettings
        {
#pragma warning disable SKEXP0010 // Experimental flag required for GPT-5.x max_completion_tokens support
            SetNewMaxCompletionTokensEnabled = true,
#pragma warning restore SKEXP0010
            MaxTokens = this._promptOptions.ResponseTokenLimit,
            // GPT-5.x currently only supports default temperature/top_p (1.0). Avoid non-default values.
            Temperature = 1.0,
            TopP = 1.0,
            // GPT-5.x does not support presence_penalty/frequency_penalty. Avoid sending these parameters.
            // When approval is required, enable functions but don't auto-invoke them
            // This allows us to intercept the function calls and show them to the user for approval
            ToolCallBehavior = requireApproval
                ? ToolCallBehavior.EnableKernelFunctions
                : ToolCallBehavior.AutoInvokeKernelFunctions,
            // PROMPT CACHING OPTIMIZATION:
            // The User parameter helps Azure route requests with similar prompts together,
            // improving cache hit rates. Using chatId ensures messages in the same conversation
            // are more likely to hit the cache for the shared system prompt prefix.
            User = chatId
        };

        // For native reasoning models, set the ReasoningEffort parameter
        // This is used by o3-mini, o1, o3, and similar models that have built-in reasoning
        // Note: Native reasoning models do NOT stream their thinking - they think internally first
        if (!string.IsNullOrEmpty(modelId) && this._modelKernelFactory != null)
        {
            var modelConfig = this._modelKernelFactory.GetModelConfig(modelId);
            if (modelConfig?.SupportsReasoning == true && !string.IsNullOrEmpty(modelConfig.ReasoningEffort))
            {
                // Map our config values to SK's expected format
                // SK expects: "low", "medium", "high" (case may vary by version)
#pragma warning disable SKEXP0010 // ReasoningEffort is experimental
                settings.ReasoningEffort = modelConfig.ReasoningEffort.ToLowerInvariant();
#pragma warning restore SKEXP0010
                this._logger.LogDebug("Set native ReasoningEffort={Effort} for model {ModelId}",
                    settings.ReasoningEffort, modelId);
            }
        }

        return settings;
    }

    /// <summary>
    /// Create `AzureOpenAIPromptExecutionSettings` for intent response.
    /// GPT-5.x models require `max_completion_tokens` (not `max_tokens`), so we enable the SK flag.
    /// </summary>
    private AzureOpenAIPromptExecutionSettings CreateIntentCompletionSettings()
    {
        return new AzureOpenAIPromptExecutionSettings
        {
#pragma warning disable SKEXP0010 // Experimental flag required for GPT-5.x max_completion_tokens support
            SetNewMaxCompletionTokensEnabled = true,
#pragma warning restore SKEXP0010
            MaxTokens = this._promptOptions.ResponseTokenLimit,
            // GPT-5.x currently only supports default temperature/top_p (1.0). Avoid non-default values.
            Temperature = 1.0,
            TopP = 1.0,
            // GPT-5.x does not support presence_penalty/frequency_penalty. Avoid sending these parameters.
            StopSequences = new string[] { "] bot:" }
        };
    }

    /// <summary>
    /// Calculate the maximum number of tokens that can be sent in a request
    /// </summary>
    private int GetMaxRequestTokenBudget()
    {
        // OpenAI inserts a message under the hood:
        // "content": "Assistant is a large language model.","role": "system"
        // This burns just under 20 tokens which need to be accounted for.
        const int ExtraOpenAiMessageTokens = 20;
        return this._promptOptions.CompletionTokenLimit // Total token limit
               - ExtraOpenAiMessageTokens
               // Token count reserved for model to generate a response
               - this._promptOptions.ResponseTokenLimit
               // Buffer for Tool Calls
               - this._promptOptions.FunctionCallingTokenLimit;
    }

    /// <summary>
    /// Gets token usage totals for each semantic function if not undefined.
    /// </summary>
    /// <param name="kernelArguments">Context maintained during response generation.</param>
    /// <param name="content">String representing bot response. If null, response is still being generated or was hardcoded.</param>
    /// <returns>Dictionary containing function to token usage mapping for each total that's defined.</returns>
    private Dictionary<string, int> GetTokenUsages(KernelArguments kernelArguments, string? content = null)
    {
        var tokenUsageDict = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        // Total token usage of each semantic function
        foreach (string function in TokenUtils.SemanticFunctions.Values)
        {
            if (kernelArguments.TryGetValue($"{function}TokenUsage", out object? tokenUsage))
            {
                if (tokenUsage is string tokenUsageString)
                {
                    tokenUsageDict.Add(function, int.Parse(tokenUsageString, CultureInfo.InvariantCulture));
                }
            }
        }

        if (content != null)
        {
            tokenUsageDict.Add(TokenUtils.SemanticFunctions["SystemCompletion"]!, TokenUtils.TokenCount(content));
        }

        return tokenUsageDict;
    }

    /// <summary>
    /// Stream the response to the client.
    /// </summary>
    /// <param name="chatId">The chat ID</param>
    /// <param name="userId">The user ID</param>
    /// <param name="prompt">Prompt used to generate the response</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <param name="citations">Citations for the message</param>
    /// <param name="userIntent">The extracted user intent for plan creation</param>
    /// <returns>The created chat message</returns>
    private async Task<CopilotChatMessage> StreamResponseToClientAsync(
        string chatId,
        string userId,
        BotResponsePrompt prompt,
        CancellationToken cancellationToken,
        IEnumerable<CitationSource>? citations = null,
        string? userIntent = null)
    {
        var chatCompletion = this._kernel.GetRequiredService<IChatCompletionService>();

        // Check if reasoning mode is enabled for the current model (check early, before any branching)
        ChatSession? chatSession = null;
        await this._chatSessionRepository.TryFindByIdAsync(chatId, callback: v => chatSession = v);
        bool isReasoningMode = this.IsReasoningEnabled(chatSession?.ModelId);

        // For reasoning models, show "thinking" status since they take time before responding
        if (isReasoningMode)
        {
            this._logger.LogWarning("🧠🧠🧠 REASONING MODE ENABLED - ModelId: {ModelId}", chatSession?.ModelId);
            await this.UpdateBotResponseStatusOnClientAsync(chatId, "Mimir tenkjer...", cancellationToken);
        }
        else
        {
            this._logger.LogDebug("📝 Standard mode (no reasoning) - ModelId: {ModelId}", chatSession?.ModelId);
        }

        // MCP plan approval is disabled for now - all models use streaming
        // TODO: Re-enable MCP plan approval when MCP tools are implemented
        // bool requireApproval = this._mcpPlanService?.AnyServerRequiresApproval() ?? false;
        // if (requireApproval)
        // {
        //     this._logger.LogDebug("MCP plan approval required - using non-streaming path");
        //     return await this.GetResponseWithPlanApprovalAsync(
        //         chatId, userId, prompt, chatCompletion, cancellationToken, citations, userIntent, isReasoningMode);
        // }

        // Standard streaming response (auto-invoke functions)
        // Pass chatId to improve prompt cache routing, and modelId for native reasoning support
        var stream = chatCompletion.GetStreamingChatMessageContentsAsync(
            prompt.MetaPromptTemplate,
            this.CreateChatRequestSettings(requireApproval: false, chatId: chatId, modelId: chatSession?.ModelId),
            this._kernel,
            cancellationToken);

        // Create message on client
        var chatMessage = await this.CreateBotMessageOnClient(
            chatId,
            userId,
            JsonSerializer.Serialize(prompt),
            string.Empty,
            cancellationToken,
            citations
        );

        // Collect full response (no streaming to client)
        var fullResponse = new System.Text.StringBuilder();
        await foreach (var contentPiece in stream)
        {
            fullResponse.Append(contentPiece);
        }

        var responseContent = fullResponse.ToString();

        // Extract reasoning if present
        if (isReasoningMode && responseContent.Contains("<thinking>", StringComparison.OrdinalIgnoreCase))
        {
            var (reasoning, cleanContent) = ParseReasoningFromResponse(responseContent);
            if (reasoning != null)
            {
                chatMessage.Reasoning = reasoning;
                chatMessage.Content = cleanContent;
                await this.UpdateReasoningOnClientAsync(chatId, chatMessage.Id, chatMessage.Reasoning, cancellationToken);
            }
            else
            {
                chatMessage.Content = responseContent;
            }
        }
        else
        {
            chatMessage.Content = responseContent;
        }

        await this.UpdateBotResponseStatusOnClientAsync(chatId, "Mimir skriv ei melding", cancellationToken);
        await this.UpdateMessageOnClient(chatMessage, cancellationToken);

        return chatMessage;
    }

    /// <summary>
    /// Get response with plan approval flow for MCP tools.
    /// When the LLM wants to call MCP tools, we intercept and create a plan for user approval.
    /// </summary>
    private async Task<CopilotChatMessage> GetResponseWithPlanApprovalAsync(
        string chatId,
        string userId,
        BotResponsePrompt prompt,
        IChatCompletionService chatCompletion,
        CancellationToken cancellationToken,
        IEnumerable<CitationSource>? citations = null,
        string? userIntent = null,
        bool isReasoningMode = false)
    {
        // Get response without auto-invoking functions
        // Pass chatId to improve prompt cache routing
        var settings = this.CreateChatRequestSettings(requireApproval: true, chatId: chatId);
        var result = await chatCompletion.GetChatMessageContentAsync(
            prompt.MetaPromptTemplate,
            settings,
            this._kernel,
            cancellationToken);

        // Log prompt cache metrics for cost optimization monitoring
        this.LogPromptCacheMetrics(result, chatId);

        // Check if the response contains function calls
        var functionCalls = result.Items
            .OfType<FunctionCallContent>()
            .ToList();

        if (functionCalls.Count > 0)
        {
            // Filter to only MCP tool calls that require approval
            var mcpFunctionCalls = functionCalls
                .Where(fc => this._mcpPlanService!.RequiresApproval(fc.PluginName ?? string.Empty))
                .ToList();

            if (mcpFunctionCalls.Count > 0)
            {
                this._logger.LogInformation(
                    "MCP tool calls detected requiring approval: {Tools}",
                    string.Join(", ", mcpFunctionCalls.Select(fc => $"{fc.PluginName}.{fc.FunctionName}")));

                // Create a proposed plan for user approval
                var proposedPlan = this._mcpPlanService!.CreateProposedPlan(
                    this._kernel,
                    mcpFunctionCalls,
                    prompt.MetaPromptTemplate.LastOrDefault()?.Content ?? string.Empty,
                    userIntent);

                // Create bot message with the proposed plan (type = Plan)
                var planJson = JsonSerializer.Serialize(proposedPlan);
                var chatMessage = await this.CreateBotMessageOnClient(
                    chatId,
                    userId,
                    JsonSerializer.Serialize(prompt),
                    planJson,
                    cancellationToken,
                    citations,
                    tokenUsage: null,
                    messageType: CopilotChatMessage.ChatMessageType.Plan
                );

                return chatMessage;
            }
        }

        // No MCP tools requiring approval - return the response content directly
        var responseContent = result.Content ?? string.Empty;
        string? reasoning = null;

        // Log response for debugging
        this._logger.LogDebug("Response from model (first 500 chars): {Content}",
            responseContent.Length > 500 ? responseContent.Substring(0, 500) : responseContent);

        // If reasoning mode, parse <thinking> tags from response
        if (isReasoningMode)
        {
            // Check for thinking tags (case-insensitive)
            bool hasThinkingTag = responseContent.Contains("<thinking>", StringComparison.OrdinalIgnoreCase);
            this._logger.LogInformation("Reasoning mode: checking for <thinking> tags. Found: {Found}", hasThinkingTag);

            if (hasThinkingTag)
            {
                var (extractedReasoning, cleanContent) = ParseReasoningFromResponse(responseContent);
                if (extractedReasoning != null)
                {
                    reasoning = extractedReasoning;
                    responseContent = cleanContent;
                    this._logger.LogInformation("✅ Reasoning extracted from response: {Length} chars", reasoning.Length);
                }
            }
            else
            {
                this._logger.LogWarning("⚠️ Reasoning mode enabled but no <thinking> tags found in response");
            }
        }

        // Update status - now writing the response
        await this.UpdateBotResponseStatusOnClientAsync(chatId, "Mimir skriv ei melding", cancellationToken);

        // Create message on client
        var normalMessage = await this.CreateBotMessageOnClient(
            chatId,
            userId,
            JsonSerializer.Serialize(prompt),
            string.Empty,
            cancellationToken,
            citations
        );

        // Set reasoning if extracted
        if (reasoning != null)
        {
            normalMessage.Reasoning = reasoning;
            await this.UpdateReasoningOnClientAsync(chatId, normalMessage.Id, reasoning, cancellationToken);
        }

        // If there are non-MCP function calls, we need to handle them with auto-invoke
        if (functionCalls.Count > 0)
        {
            // Re-run with auto-invoke for non-MCP functions
            // Pass chatId to improve prompt cache routing
            var autoInvokeSettings = this.CreateChatRequestSettings(requireApproval: false, chatId: chatId);
            var autoInvokeStream = chatCompletion.GetStreamingChatMessageContentsAsync(
                prompt.MetaPromptTemplate,
                autoInvokeSettings,
                this._kernel,
                cancellationToken);

            await foreach (var contentPiece in autoInvokeStream)
            {
                normalMessage.Content += contentPiece;
                await this.UpdateMessageOnClient(normalMessage, cancellationToken);
            }
        }
        else
        {
            // No function calls - just use the response content
            normalMessage.Content = responseContent;
            await this.UpdateMessageOnClient(normalMessage, cancellationToken);
        }

        return normalMessage;
    }

    /// <summary>
    /// Create an empty message on the client to begin the response.
    /// </summary>
    /// <param name="chatId">The chat ID</param>
    /// <param name="userId">The user ID</param>
    /// <param name="prompt">Prompt used to generate the message</param>
    /// <param name="content">Content of the message</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <param name="citations">Citations for the message</param>
    /// <param name="tokenUsage">Total token usage of response completion</param>
    /// <param name="messageType">Type of the message (default: Message)</param>
    /// <returns>The created chat message</returns>
    private async Task<CopilotChatMessage> CreateBotMessageOnClient(
        string chatId,
        string userId,
        string prompt,
        string content,
        CancellationToken cancellationToken,
        IEnumerable<CitationSource>? citations = null,
        Dictionary<string, int>? tokenUsage = null,
        CopilotChatMessage.ChatMessageType messageType = CopilotChatMessage.ChatMessageType.Message)
    {
        var chatMessage = CopilotChatMessage.CreateBotResponseMessage(chatId, content, prompt, citations, tokenUsage, messageType);

        // Enhanced logging to debug SignalR message delivery
        try
        {
            this._logger.LogWarning("🔵 SIGNALR: Attempting to send ReceiveMessage for chatId: {ChatId}, messageId: {MessageId}", chatId, chatMessage.Id);

            if (this._messageRelayHubContext == null)
            {
                this._logger.LogError("🔴 SIGNALR ERROR: _messageRelayHubContext is NULL!");
                throw new InvalidOperationException("MessageRelayHubContext is null");
            }

            await this._messageRelayHubContext.Clients.Group(chatId).SendAsync("ReceiveMessage", chatId, userId, chatMessage, cancellationToken);

            this._logger.LogWarning("✅ SIGNALR: Successfully sent ReceiveMessage for chatId: {ChatId}", chatId);
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "🔴 SIGNALR ERROR: Failed to send ReceiveMessage for chatId: {ChatId}", chatId);
            throw;
        }

        return chatMessage;
    }

    /// <summary>
    /// Update the response on the client.
    /// </summary>
    /// <param name="message">The message</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    private async Task UpdateMessageOnClient(CopilotChatMessage message, CancellationToken cancellationToken)
    {
        await this._messageRelayHubContext.Clients.Group(message.ChatId).SendAsync("ReceiveMessageUpdate", message, cancellationToken);
    }

    /// <summary>
    /// Update the status of the response on the client.
    /// </summary>
    /// <param name="chatId">The chat ID</param>
    /// <param name="status">Current status of the response</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    private async Task UpdateBotResponseStatusOnClientAsync(string chatId, string status, CancellationToken cancellationToken)
    {
        // Enhanced logging to debug SignalR status updates
        try
        {
            this._logger.LogWarning("🔵 SIGNALR: Sending ReceiveBotResponseStatus for chatId: {ChatId}, status: {Status}", chatId, status ?? "null (clearing)");

            if (this._messageRelayHubContext == null)
            {
                this._logger.LogError("🔴 SIGNALR ERROR: _messageRelayHubContext is NULL in UpdateBotResponseStatusOnClientAsync!");
                throw new InvalidOperationException("MessageRelayHubContext is null");
            }

            await this._messageRelayHubContext.Clients.Group(chatId).SendAsync("ReceiveBotResponseStatus", chatId, status, cancellationToken);

            this._logger.LogWarning("✅ SIGNALR: Successfully sent ReceiveBotResponseStatus for chatId: {ChatId}", chatId);
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "🔴 SIGNALR ERROR: Failed to send ReceiveBotResponseStatus for chatId: {ChatId}", chatId);
            throw;
        }
    }

    /// <summary>
    /// Log prompt cache metrics for Azure OpenAI cost optimization monitoring.
    /// Extracts cached_tokens from the response metadata to track cache hit rates.
    /// </summary>
    /// <param name="response">The chat message content response</param>
    /// <param name="chatId">The chat session ID for correlation</param>
    private void LogPromptCacheMetrics(ChatMessageContent response, string chatId)
    {
        try
        {
            var metadata = response.Metadata;
            if (metadata == null)
            {
                return;
            }

            // Try to extract usage information from the response metadata
            // The structure varies depending on the SDK version and provider
            int promptTokens = 0;
            int cachedTokens = 0;
            int completionTokens = 0;

            // Check for Azure OpenAI usage format
            if (metadata.TryGetValue("Usage", out var usageObj) && usageObj != null)
            {
                // Try to extract from the usage object using reflection or dynamic
                var usageType = usageObj.GetType();

                var promptTokensProp = usageType.GetProperty("PromptTokens") ?? usageType.GetProperty("InputTokens");
                var completionTokensProp = usageType.GetProperty("CompletionTokens") ?? usageType.GetProperty("OutputTokens");

                if (promptTokensProp != null)
                {
                    promptTokens = Convert.ToInt32(promptTokensProp.GetValue(usageObj) ?? 0);
                }
                if (completionTokensProp != null)
                {
                    completionTokens = Convert.ToInt32(completionTokensProp.GetValue(usageObj) ?? 0);
                }

                // Try to get cached tokens from PromptTokensDetails
                var detailsProp = usageType.GetProperty("PromptTokensDetails");
                if (detailsProp != null)
                {
                    var details = detailsProp.GetValue(usageObj);
                    if (details != null)
                    {
                        var cachedProp = details.GetType().GetProperty("CachedTokens");
                        if (cachedProp != null)
                        {
                            cachedTokens = Convert.ToInt32(cachedProp.GetValue(details) ?? 0);
                        }
                    }
                }
            }

            // Calculate and log cache metrics
            if (promptTokens > 0)
            {
                var cacheHitRate = promptTokens > 0 ? (double)cachedTokens / promptTokens * 100 : 0;

                this._logger.LogInformation(
                    "Prompt Cache Metrics - ChatId: {ChatId}, PromptTokens: {PromptTokens}, CachedTokens: {CachedTokens}, " +
                    "CompletionTokens: {CompletionTokens}, CacheHitRate: {CacheHitRate:F1}%",
                    chatId, promptTokens, cachedTokens, completionTokens, cacheHitRate);

                // Track in Application Insights if telemetry service is available
                this._telemetryService?.TrackPromptCacheMetrics(promptTokens, cachedTokens, completionTokens, chatId);
            }
        }
        catch (Exception ex)
        {
            // Don't let metrics logging break the main flow
            this._logger.LogWarning(ex, "Failed to extract prompt cache metrics from response");
        }
    }

    /// <summary>
    /// Set the system description in the prompt options.
    /// </summary>
    /// <param name="chatId">Id of the chat session</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <exception cref="ArgumentException">Throw if the chat session does not exist.</exception>
    private async Task SetSystemDescriptionAsync(string chatId, CancellationToken cancellationToken)
    {
        ChatSession? chatSession = null;
        if (!await this._chatSessionRepository.TryFindByIdAsync(chatId, callback: v => chatSession = v))
        {
            throw new ArgumentException("Chat session does not exist.");
        }

        var systemDescription = chatSession!.SafeSystemDescription;

        // Note: Reasoning instructions are added in RenderSystemInstructionsAsync, not here
        // This keeps the intent extraction prompt clean (without reasoning tags)
        this._promptOptions.SystemDescription = systemDescription;
    }

    /// <summary>
    /// Get the reasoning effort level for the given model.
    /// </summary>
    /// <param name="modelId">The model ID to check.</param>
    /// <returns>The reasoning effort level (low, medium, high). Defaults to medium.</returns>
    private string GetReasoningEffort(string? modelId)
    {
        if (string.IsNullOrEmpty(modelId) || this._modelKernelFactory == null)
        {
            return "medium";
        }

        var modelConfig = this._modelKernelFactory.GetModelConfig(modelId);
        var effort = modelConfig?.ReasoningEffort?.ToLowerInvariant() ?? "medium";

        // Validate effort level
        return effort switch
        {
            "low" => "low",
            "high" => "high",
            _ => "medium"
        };
    }

    /// <summary>
    /// Get the appropriate reasoning instruction based on effort level.
    /// Uses prompts configured in appsettings.json under Prompts section.
    /// </summary>
    /// <param name="effort">The effort level (low, medium, high).</param>
    /// <returns>The reasoning instruction string.</returns>
    private string GetReasoningInstruction(string effort)
    {
        return effort switch
        {
            "low" => this._promptOptions.ReasoningInstructionLow,
            "high" => this._promptOptions.ReasoningInstructionHigh,
            _ => this._promptOptions.ReasoningInstructionMedium
        };
    }

    /// <summary>
    /// Check if reasoning is enabled for the given model.
    /// </summary>
    /// <param name="modelId">The model ID to check.</param>
    /// <returns>True if reasoning is enabled for this model.</returns>
    private bool IsReasoningEnabled(string? modelId)
    {
        if (string.IsNullOrEmpty(modelId) || this._modelKernelFactory == null)
        {
            return false;
        }

        var modelConfig = this._modelKernelFactory.GetModelConfig(modelId);
        return modelConfig?.SupportsReasoning == true;
    }

    /// <summary>
    /// Parse reasoning/thinking content from the model response.
    /// Extracts content within &lt;thinking&gt;...&lt;/thinking&gt; tags and returns
    /// both the reasoning and the clean response.
    /// </summary>
    /// <param name="fullResponse">The full response from the model.</param>
    /// <returns>A tuple of (reasoning, cleanContent) where reasoning is null if not found.</returns>
    private static (string? Reasoning, string CleanContent) ParseReasoningFromResponse(string fullResponse)
    {
        var match = s_thinkingTagRegex.Match(fullResponse);
        if (!match.Success)
        {
            return (null, fullResponse);
        }

        var reasoning = match.Groups[1].Value.Trim();
        var cleanContent = s_thinkingTagRegex.Replace(fullResponse, string.Empty).Trim();

        return (reasoning, cleanContent);
    }

    /// <summary>
    /// Stream response with native reasoning content extraction.
    /// GPT-5.2 and o-series models may return reasoning in their Items collection.
    /// Falls back to &lt;thinking&gt; tag parsing if no native reasoning is found.
    /// </summary>
    private async Task StreamWithNativeReasoningAsync(
        string chatId,
        CopilotChatMessage chatMessage,
        IAsyncEnumerable<StreamingChatMessageContent> stream,
        CancellationToken cancellationToken)
    {
        var reasoningBuffer = new System.Text.StringBuilder();
        var contentBuffer = new System.Text.StringBuilder();
        var lastUpdateTime = DateTime.UtcNow;
        var updateInterval = TimeSpan.FromMilliseconds(100);
        bool foundNativeReasoning = false;
        bool firstChunkReceived = false;
        int lastReasoningLength = 0;

        await foreach (var chunk in stream)
        {
            // When first chunk arrives, update status from "thinking" to "writing"
            if (!firstChunkReceived)
            {
                firstChunkReceived = true;
                await this.UpdateBotResponseStatusOnClientAsync(chatId, "Mimir skriv ei melding", cancellationToken);
            }

            // Check for native reasoning content in Items (GPT-5.2, o-series)
            if (chunk.Items != null)
            {
                foreach (var item in chunk.Items)
                {
                    var itemType = item.GetType().Name;

                    // Check for reasoning content types (native reasoning from GPT-5.2/o-series)
                    if (itemType.Contains("Reasoning", StringComparison.OrdinalIgnoreCase))
                    {
                        foundNativeReasoning = true;
                        var reasoningText = item.ToString() ?? string.Empty;
                        reasoningBuffer.Append(reasoningText);

                        // Send reasoning update (throttled)
                        var now = DateTime.UtcNow;
                        if (now - lastUpdateTime >= updateInterval && reasoningBuffer.Length > lastReasoningLength + 10)
                        {
                            chatMessage.Reasoning = reasoningBuffer.ToString().Trim();
                            await this.UpdateReasoningOnClientAsync(chatId, chatMessage.Id, chatMessage.Reasoning, cancellationToken);
                            lastReasoningLength = reasoningBuffer.Length;
                            lastUpdateTime = now;
                        }
                    }
                    else if (itemType.Contains("Text", StringComparison.OrdinalIgnoreCase))
                    {
                        // Text content item
                        contentBuffer.Append(item.ToString());
                    }
                }
            }

            // Also append the chunk's text content directly
            var chunkText = chunk.Content;
            if (!string.IsNullOrEmpty(chunkText))
            {
                contentBuffer.Append(chunkText);

                // Update message content (throttled)
                var now = DateTime.UtcNow;
                if (now - lastUpdateTime >= updateInterval)
                {
                    chatMessage.Content = contentBuffer.ToString().Trim();
                    await this.UpdateMessageOnClient(chatMessage, cancellationToken);
                    lastUpdateTime = now;
                }
            }
        }

        // Send final reasoning if found
        if (foundNativeReasoning && reasoningBuffer.Length > 0)
        {
            chatMessage.Reasoning = reasoningBuffer.ToString().Trim();
            await this.UpdateReasoningOnClientAsync(chatId, chatMessage.Id, chatMessage.Reasoning, cancellationToken);
            this._logger.LogInformation("Native reasoning extracted: {Length} chars", chatMessage.Reasoning.Length);
        }

        // Send final content
        if (contentBuffer.Length > 0)
        {
            chatMessage.Content = contentBuffer.ToString().Trim();
            await this.UpdateMessageOnClient(chatMessage, cancellationToken);
        }

        // If no native reasoning found, the content might contain <thinking> tags - try parsing
        if (!foundNativeReasoning && chatMessage.Content?.Contains("<thinking>") == true)
        {
            this._logger.LogDebug("No native reasoning found, checking for <thinking> tags");
            var (reasoning, cleanContent) = ParseReasoningFromResponse(chatMessage.Content);
            if (reasoning != null)
            {
                chatMessage.Reasoning = reasoning;
                chatMessage.Content = cleanContent;
                await this.UpdateReasoningOnClientAsync(chatId, chatMessage.Id, chatMessage.Reasoning, cancellationToken);
                await this.UpdateMessageOnClient(chatMessage, cancellationToken);
            }
        }
    }

    /// <summary>
    /// Stream response with real-time &lt;thinking&gt; tag extraction.
    /// Tags are extracted as they arrive - never shown in main content.
    /// Batched updates to reduce UI thrashing.
    /// </summary>
    private async Task StreamWithReasoningExtractionAsync(
        string chatId,
        CopilotChatMessage chatMessage,
        IAsyncEnumerable<StreamingChatMessageContent> stream,
        CancellationToken cancellationToken)
    {
        var rawBuffer = new System.Text.StringBuilder();
        var reasoningBuffer = new System.Text.StringBuilder();
        var contentBuffer = new System.Text.StringBuilder();

        bool insideThinking = false;
        bool thinkingComplete = false;
        int updateCounter = 0;
        const int UpdateFrequency = 5; // Update every N chunks

        await foreach (var contentPiece in stream)
        {
            rawBuffer.Append(contentPiece);
            updateCounter++;

            var raw = rawBuffer.ToString();

            // Look for opening tag
            if (!insideThinking && !thinkingComplete)
            {
                int openIdx = raw.IndexOf("<thinking>", StringComparison.OrdinalIgnoreCase);
                if (openIdx >= 0)
                {
                    insideThinking = true;
                    contentBuffer.Append(raw.Substring(0, openIdx));
                    rawBuffer.Clear();
                    rawBuffer.Append(raw.Substring(openIdx + 10));
                }
                else
                {
                    // No tag found - stream content (batched)
                    if (updateCounter % UpdateFrequency == 0)
                    {
                        chatMessage.Content = raw;
                        await this.UpdateMessageOnClient(chatMessage, cancellationToken);
                    }
                }
            }

            // Inside thinking - accumulate reasoning
            if (insideThinking && !thinkingComplete)
            {
                var current = rawBuffer.ToString();
                int closeIdx = current.IndexOf("</thinking>", StringComparison.OrdinalIgnoreCase);
                if (closeIdx >= 0)
                {
                    reasoningBuffer.Append(current.Substring(0, closeIdx));
                    insideThinking = false;
                    thinkingComplete = true;

                    // Send reasoning once complete
                    chatMessage.Reasoning = reasoningBuffer.ToString().Trim();
                    await this.UpdateReasoningOnClientAsync(chatId, chatMessage.Id, chatMessage.Reasoning, cancellationToken);
                    await this.UpdateBotResponseStatusOnClientAsync(chatId, "Mimir skriv ei melding", cancellationToken);

                    rawBuffer.Clear();
                    rawBuffer.Append(current.Substring(closeIdx + 11));
                    updateCounter = 0; // Reset for content streaming
                }
                else
                {
                    // Still thinking - accumulate but don't send updates (just show status)
                    reasoningBuffer.Append(rawBuffer);
                    rawBuffer.Clear();
                }
            }

            // After thinking - stream content (batched)
            if (thinkingComplete && rawBuffer.Length > 0)
            {
                contentBuffer.Append(rawBuffer);
                rawBuffer.Clear();

                if (updateCounter % UpdateFrequency == 0)
                {
                    chatMessage.Content = contentBuffer.ToString().Trim();
                    await this.UpdateMessageOnClient(chatMessage, cancellationToken);
                }
            }
        }

        // Final updates
        if (insideThinking)
        {
            reasoningBuffer.Append(rawBuffer);
            chatMessage.Reasoning = reasoningBuffer.ToString().Trim();
            await this.UpdateReasoningOnClientAsync(chatId, chatMessage.Id, chatMessage.Reasoning, cancellationToken);
        }

        if (!thinkingComplete && !insideThinking)
        {
            chatMessage.Content = rawBuffer.ToString().Trim();
        }
        else if (thinkingComplete)
        {
            contentBuffer.Append(rawBuffer);
            chatMessage.Content = contentBuffer.ToString().Trim();
        }

        await this.UpdateMessageOnClient(chatMessage, cancellationToken);
    }

    /// <summary>
    /// Send reasoning update to the client via SignalR.
    /// </summary>
    private async Task UpdateReasoningOnClientAsync(string chatId, string messageId, string reasoning, CancellationToken cancellationToken)
    {
        try
        {
            await this._messageRelayHubContext.Clients.Group(chatId).SendAsync(
                "ReceiveReasoningUpdate",
                chatId,
                messageId,
                reasoning,
                cancellationToken);
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Failed to send reasoning update for chat {ChatId}", chatId);
        }
    }
}