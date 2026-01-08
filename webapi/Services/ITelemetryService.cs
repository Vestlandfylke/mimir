// Copyright (c) Microsoft. All rights reserved.

namespace CopilotChat.WebApi.Services;

/// <summary>
/// Interface for common telemetry events to track actions across the semantic kernel.
/// </summary>
public interface ITelemetryService
{
    /// <summary>
    /// Creates a telemetry event when a function is executed.
    /// </summary>
    /// <param name="pluginName">Name of the plugin</param>
    /// <param name="functionName">Function name</param>
    /// <param name="success">If the function executed successfully</param>
    void TrackPluginFunction(string pluginName, string functionName, bool success);

    /// <summary>
    /// Tracks Azure OpenAI prompt cache metrics for cost optimization monitoring.
    /// </summary>
    /// <param name="promptTokens">Total prompt tokens in the request</param>
    /// <param name="cachedTokens">Number of tokens served from cache (90% discount)</param>
    /// <param name="completionTokens">Tokens generated in the response</param>
    /// <param name="chatId">The chat session ID</param>
    void TrackPromptCacheMetrics(int promptTokens, int cachedTokens, int completionTokens, string? chatId = null);
}