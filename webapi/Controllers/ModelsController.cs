// Copyright (c) Microsoft. All rights reserved.

using CopilotChat.WebApi.Auth;
using CopilotChat.WebApi.Services;
using CopilotChat.WebApi.Storage;
using Microsoft.AspNetCore.Mvc;

namespace CopilotChat.WebApi.Controllers;

/// <summary>
/// Controller for managing AI model selection.
/// </summary>
[ApiController]
[Route("models")]
internal sealed class ModelsController : ControllerBase
{
    private readonly ILogger<ModelsController> _logger;
    private readonly ModelKernelFactory _modelKernelFactory;

    public ModelsController(
        ILogger<ModelsController> logger,
        ModelKernelFactory modelKernelFactory)
    {
        this._logger = logger;
        this._modelKernelFactory = modelKernelFactory;
    }

    /// <summary>
    /// Get all available AI models.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetAvailableModels()
    {
        var models = this._modelKernelFactory.GetAvailableModels()
            .Select(m => new ModelInfo
            {
                Id = m.Id,
                DisplayName = m.DisplayName,
                Description = m.Description,
                Provider = m.Provider.ToString(),
                Icon = m.Icon,
                MaxCompletionTokens = m.MaxCompletionTokens,
                SupportsReasoning = m.SupportsReasoning,
                ReasoningEffort = m.ReasoningEffort
            })
            .ToList();

        var response = new AvailableModelsResponse
        {
            Models = models,
            DefaultModelId = this._modelKernelFactory.DefaultModelId
        };

        return this.Ok(response);
    }

    /// <summary>
    /// Get the model configuration for a specific chat session.
    /// </summary>
    [HttpGet("chat/{chatId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetChatModel(
        [FromServices] ChatSessionRepository chatSessionRepository,
        [FromServices] ChatParticipantRepository chatParticipantRepository,
        [FromServices] IAuthInfo authInfo,
        [FromRoute] Guid chatId)
    {
        string chatIdString = chatId.ToString();

        // Verify chat exists
        Models.Storage.ChatSession? chat = null;
        if (!await chatSessionRepository.TryFindByIdAsync(chatIdString, callback: c => chat = c))
        {
            return this.NotFound("Chat session not found.");
        }

        // Verify user has access
        if (!await chatParticipantRepository.IsUserInChatAsync(authInfo.UserId, chatIdString))
        {
            return this.Forbid("User does not have access to this chat.");
        }

        var modelId = chat!.ModelId ?? this._modelKernelFactory.DefaultModelId;
        var modelConfig = this._modelKernelFactory.GetModelConfig(modelId);

        if (modelConfig == null)
        {
            // Fall back to default if configured model no longer exists
            modelId = this._modelKernelFactory.DefaultModelId;
            modelConfig = this._modelKernelFactory.GetModelConfig(modelId);
        }

        return this.Ok(new ChatModelResponse
        {
            ChatId = chatIdString,
            ModelId = modelId,
            ModelDisplayName = modelConfig?.DisplayName ?? modelId,
            ModelProvider = modelConfig?.Provider.ToString() ?? "Unknown"
        });
    }

    /// <summary>
    /// Update the AI model for a specific chat session.
    /// </summary>
    [HttpPut("chat/{chatId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetChatModel(
        [FromServices] ChatSessionRepository chatSessionRepository,
        [FromServices] ChatParticipantRepository chatParticipantRepository,
        [FromServices] IAuthInfo authInfo,
        [FromRoute] Guid chatId,
        [FromBody] SetChatModelRequest request)
    {
        string chatIdString = chatId.ToString();

        this._logger.LogInformation("Setting model {ModelId} for chat {ChatId}", request.ModelId, chatIdString);

        // Validate the model exists
        var modelConfig = this._modelKernelFactory.GetModelConfig(request.ModelId);
        if (modelConfig == null)
        {
            return this.BadRequest($"Model '{request.ModelId}' is not available.");
        }

        // Verify chat exists
        Models.Storage.ChatSession? chat = null;
        if (!await chatSessionRepository.TryFindByIdAsync(chatIdString, callback: c => chat = c))
        {
            return this.NotFound("Chat session not found.");
        }

        // Verify user has access
        if (!await chatParticipantRepository.IsUserInChatAsync(authInfo.UserId, chatIdString))
        {
            return this.Forbid("User does not have access to this chat.");
        }

        // Update the model
        chat!.ModelId = request.ModelId;
        await chatSessionRepository.UpsertAsync(chat);

        this._logger.LogInformation("Model for chat {ChatId} updated to {ModelId}", chatIdString, request.ModelId);

        return this.Ok(new ChatModelResponse
        {
            ChatId = chatIdString,
            ModelId = request.ModelId,
            ModelDisplayName = modelConfig.DisplayName,
            ModelProvider = modelConfig.Provider.ToString()
        });
    }
}

/// <summary>
/// Response containing available AI models.
/// </summary>
internal sealed class AvailableModelsResponse
{
    public List<ModelInfo> Models { get; set; } = new();
    public string DefaultModelId { get; set; } = string.Empty;
}

/// <summary>
/// Information about a single AI model.
/// </summary>
internal sealed class ModelInfo
{
    public string Id { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public int MaxCompletionTokens { get; set; }
    public bool SupportsReasoning { get; set; }
    public string ReasoningEffort { get; set; } = "medium";
}

/// <summary>
/// Response with the model configuration for a chat.
/// </summary>
internal sealed class ChatModelResponse
{
    public string ChatId { get; set; } = string.Empty;
    public string ModelId { get; set; } = string.Empty;
    public string ModelDisplayName { get; set; } = string.Empty;
    public string ModelProvider { get; set; } = string.Empty;
}

/// <summary>
/// Request to set the model for a chat.
/// </summary>
internal sealed class SetChatModelRequest
{
    public string ModelId { get; set; } = string.Empty;
}
