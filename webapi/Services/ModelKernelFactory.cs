// Copyright (c) Microsoft. All rights reserved.

using CopilotChat.WebApi.Options;
using Microsoft.Extensions.Options;
using Microsoft.KernelMemory;
using Microsoft.SemanticKernel;

namespace CopilotChat.WebApi.Services;

/// <summary>
/// Factory service for creating Semantic Kernel instances configured for different AI models.
/// Supports dynamic model selection per chat session.
/// </summary>
internal sealed class ModelKernelFactory
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ModelsOptions _modelsOptions;
    private readonly ILogger<ModelKernelFactory> _logger;

    // Cache of model configurations for quick lookup
    private readonly Dictionary<string, ModelConfig> _modelConfigCache;

    public ModelKernelFactory(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        IOptions<ModelsOptions> modelsOptions,
        ILogger<ModelKernelFactory> logger)
    {
        this._serviceProvider = serviceProvider;
        this._configuration = configuration;
        this._httpClientFactory = httpClientFactory;
        this._modelsOptions = modelsOptions.Value;
        this._logger = logger;

        // Build cache of model configurations
        this._modelConfigCache = this._modelsOptions.AvailableModels
            .Where(m => m.Enabled)
            .ToDictionary(m => m.Id, m => m, StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Get the default model ID.
    /// </summary>
    public string DefaultModelId => this._modelsOptions.DefaultModelId;

    /// <summary>
    /// Get all available (enabled) models.
    /// </summary>
    public IEnumerable<ModelConfig> GetAvailableModels() => this._modelConfigCache.Values;

    /// <summary>
    /// Get a specific model configuration by ID.
    /// </summary>
    public ModelConfig? GetModelConfig(string modelId)
    {
        return this._modelConfigCache.TryGetValue(modelId, out var config) ? config : null;
    }

    /// <summary>
    /// Create a Semantic Kernel configured for the specified model.
    /// If modelId is null/empty, uses the default model.
    /// </summary>
    /// <param name="modelId">The model ID to use, or null for default.</param>
    /// <returns>A configured Kernel instance.</returns>
    public Kernel CreateKernel(string? modelId = null)
    {
        var effectiveModelId = string.IsNullOrEmpty(modelId) ? this._modelsOptions.DefaultModelId : modelId;

        if (!this._modelConfigCache.TryGetValue(effectiveModelId, out var modelConfig))
        {
            this._logger.LogWarning(
                "Model {ModelId} not found or disabled. Falling back to default model {DefaultModelId}.",
                effectiveModelId, this._modelsOptions.DefaultModelId);

            if (!this._modelConfigCache.TryGetValue(this._modelsOptions.DefaultModelId, out modelConfig))
            {
                throw new InvalidOperationException($"Default model {this._modelsOptions.DefaultModelId} is not configured.");
            }
        }

        return this.CreateKernelForModel(modelConfig);
    }

    /// <summary>
    /// Create a Kernel instance for a specific model configuration.
    /// </summary>
    private Kernel CreateKernelForModel(ModelConfig modelConfig)
    {
        var builder = Kernel.CreateBuilder();
        builder.Services.AddLogging();

        // Get API key - first check model-specific config, then fall back to shared config
        var apiKey = GetApiKeyForModel(modelConfig);

        switch (modelConfig.Provider)
        {
            case ModelProviderType.AzureOpenAI:
                this._logger.LogDebug("Creating Azure OpenAI kernel for model {ModelId}", modelConfig.Id);
                builder.AddAzureOpenAIChatCompletion(
                    deploymentName: modelConfig.Deployment,
                    endpoint: modelConfig.Endpoint,
                    apiKey: apiKey,
                    httpClient: this._httpClientFactory.CreateClient());
                break;

            case ModelProviderType.AzureAnthropic:
                // Azure AI Foundry with Anthropic models uses Anthropic's native API format,
                // which is different from OpenAI's format. Full support requires either:
                // 1. Using the Anthropic.SDK package with custom handlers
                // 2. Using Lost.SemanticKernel.Connectors.Anthropic
                // 3. Implementing a custom IChatCompletionService
                // 
                // For now, log a warning and this will need additional configuration.
                // See: https://learn.microsoft.com/en-us/azure/ai-foundry/model-inference/
                this._logger.LogWarning(
                    "Azure Anthropic model {ModelId} requires additional configuration. " +
                    "Claude models on Azure AI Foundry use Anthropic's native API format. " +
                    "Falling back to Azure OpenAI connector - this may not work correctly.",
                    modelConfig.Id);

                // Attempt to use Azure OpenAI connector with the inference endpoint
                // This works for some Azure AI Foundry models that support OpenAI-compatible API
                var inferenceEndpoint = modelConfig.Endpoint
                    .TrimEnd('/')
                    .Replace("/anthropic/v1/messages", "")
                    .Replace("/anthropic", "");

                builder.AddAzureOpenAIChatCompletion(
                    deploymentName: modelConfig.Deployment,
                    endpoint: inferenceEndpoint,
                    apiKey: apiKey,
                    httpClient: this._httpClientFactory.CreateClient());
                break;

            case ModelProviderType.OpenAI:
                this._logger.LogDebug("Creating OpenAI kernel for model {ModelId}", modelConfig.Id);
                builder.AddOpenAIChatCompletion(
                    modelId: modelConfig.Deployment,
                    apiKey: apiKey,
                    httpClient: this._httpClientFactory.CreateClient());
                break;

            case ModelProviderType.AzureAIFoundry:
                this._logger.LogDebug("Creating Azure AI Foundry kernel for model {ModelId}", modelConfig.Id);
                // Azure AI Foundry models (like Mistral) typically use OpenAI-compatible API
                // We use AddOpenAIChatCompletion with a custom endpoint
                builder.AddOpenAIChatCompletion(
                    modelId: modelConfig.Deployment,
                    apiKey: apiKey,
                    endpoint: new Uri(modelConfig.Endpoint),
                    httpClient: this._httpClientFactory.CreateClient());
                break;

            default:
                throw new NotSupportedException($"Model provider type {modelConfig.Provider} is not supported.");
        }

        // Add fast model for intent extraction if configured (for all model types)
        this.AddFastModelIfConfigured(builder);

        return builder.Build();
    }

    /// <summary>
    /// Get the API key for a model, falling back to shared configuration if not model-specific.
    /// </summary>
    private string GetApiKeyForModel(ModelConfig modelConfig)
    {
        // First, try model-specific API key from configuration
        if (!string.IsNullOrEmpty(modelConfig.ApiKey))
        {
            return modelConfig.ApiKey;
        }

        // Fall back to the shared Azure OpenAI API key from KernelMemory config
        var memoryOptions = this._serviceProvider.GetRequiredService<IOptions<KernelMemoryConfig>>().Value;
        var azureAIOptions = memoryOptions.GetServiceConfig<AzureOpenAIConfig>(this._configuration, "AzureOpenAIText");
        return azureAIOptions.APIKey;
    }

    /// <summary>
    /// Add fast model service for quick tasks like intent extraction.
    /// </summary>
    private void AddFastModelIfConfigured(IKernelBuilder builder)
    {
        var fastModelOptions = this._configuration.GetSection(FastModelOptions.PropertyName).Get<FastModelOptions>();
        if (fastModelOptions?.Enabled != true || string.IsNullOrEmpty(fastModelOptions.Deployment))
        {
            return;
        }

        var memoryOptions = this._serviceProvider.GetRequiredService<IOptions<KernelMemoryConfig>>().Value;
        var azureAIOptions = memoryOptions.GetServiceConfig<AzureOpenAIConfig>(this._configuration, "AzureOpenAIText");

        var fastEndpoint = string.IsNullOrEmpty(fastModelOptions.Endpoint) ? azureAIOptions.Endpoint : fastModelOptions.Endpoint;
        var fastApiKey = string.IsNullOrEmpty(fastModelOptions.ApiKey) ? azureAIOptions.APIKey : fastModelOptions.ApiKey;

        builder.AddAzureOpenAIChatCompletion(
            deploymentName: fastModelOptions.Deployment,
            endpoint: fastEndpoint,
            apiKey: fastApiKey,
            serviceId: "fast",
            httpClient: this._httpClientFactory.CreateClient());
    }
}
