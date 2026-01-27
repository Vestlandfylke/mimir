// Copyright (c) Microsoft. All rights reserved.

namespace CopilotChat.WebApi.Options;

/// <summary>
/// Configuration options for available AI models.
/// Supports multiple model providers (Azure OpenAI, Anthropic via Azure AI Foundry, etc.)
/// </summary>
internal sealed class ModelsOptions
{
    public const string PropertyName = "Models";

    /// <summary>
    /// List of available AI models that users can select from.
    /// </summary>
    public List<ModelConfig> AvailableModels { get; set; } = new();

    /// <summary>
    /// The default model ID to use when no model is explicitly selected.
    /// </summary>
    public string DefaultModelId { get; set; } = "gpt-5.2-chat";
}

/// <summary>
/// Configuration for a single AI model.
/// </summary>
internal sealed class ModelConfig
{
    /// <summary>
    /// Unique identifier for this model configuration.
    /// Used to reference the model in chat sessions.
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Display name shown to users in the model selector.
    /// </summary>
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>
    /// The provider type for this model.
    /// Determines which Semantic Kernel connector to use.
    /// </summary>
    public ModelProviderType Provider { get; set; } = ModelProviderType.AzureOpenAI;

    /// <summary>
    /// The deployment name or model ID.
    /// For Azure OpenAI, this is the deployment name.
    /// For Anthropic, this is the model name (e.g., "claude-opus-4-5").
    /// </summary>
    public string Deployment { get; set; } = string.Empty;

    /// <summary>
    /// The endpoint URL for the model API.
    /// </summary>
    public string Endpoint { get; set; } = string.Empty;

    /// <summary>
    /// The API key for authentication.
    /// Can be set via user-secrets for security.
    /// </summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the model's capabilities.
    /// </summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Maximum completion tokens for this model.
    /// Different models have different context limits.
    /// </summary>
    public int MaxCompletionTokens { get; set; } = 16384;

    /// <summary>
    /// Whether this model is currently enabled/available.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Icon identifier for UI display (optional).
    /// </summary>
    public string? Icon { get; set; }

    /// <summary>
    /// Whether this model supports reasoning/thinking output.
    /// When enabled, the model will be prompted to show its reasoning process.
    /// </summary>
    public bool SupportsReasoning { get; set; } = false;

    /// <summary>
    /// Reasoning effort level for models that support it.
    /// Controls how much compute the model uses for reasoning.
    /// Values: "low", "medium", "high" (default: "medium")
    /// </summary>
    public string ReasoningEffort { get; set; } = "medium";
}

/// <summary>
/// Supported model provider types.
/// </summary>
internal enum ModelProviderType
{
    /// <summary>
    /// Azure OpenAI Service (GPT models).
    /// Uses AzureOpenAIChatCompletion connector.
    /// </summary>
    AzureOpenAI,

    /// <summary>
    /// Anthropic via Azure AI Foundry (Claude models).
    /// Uses Anthropic Messages API format.
    /// </summary>
    AzureAnthropic,

    /// <summary>
    /// Direct OpenAI API.
    /// Uses OpenAIChatCompletion connector.
    /// </summary>
    OpenAI,

    /// <summary>
    /// Azure AI Foundry with OpenAI-compatible API.
    /// Can be used for Mistral and other models deployed on Azure AI.
    /// </summary>
    AzureAIFoundry
}
