// Copyright (c) Microsoft. All rights reserved.

using System.Security.Claims;
using Microsoft.ApplicationInsights;

namespace CopilotChat.WebApi.Services;

/// <summary>
/// Implementation of the telemetry service interface for Azure Application Insights (AppInsights).
/// </summary>
public class AppInsightsTelemetryService : ITelemetryService
{
    private const string UnknownUserId = "unauthenticated";

    private readonly TelemetryClient _telemetryClient;
    private readonly IHttpContextAccessor _httpContextAccessor;

    /// <summary>
    /// Creates an instance of the app insights telemetry service.
    /// This should be injected into the service collection during startup.
    /// </summary>
    /// <param name="telemetryClient">An AppInsights telemetry client</param>
    /// <param name="httpContextAccessor">Accessor for the current request's http context</param>
    public AppInsightsTelemetryService(TelemetryClient telemetryClient, IHttpContextAccessor httpContextAccessor)
    {
        this._telemetryClient = telemetryClient;
        this._httpContextAccessor = httpContextAccessor;
    }

    /// <inheritdoc/>
    public void TrackPluginFunction(string pluginName, string functionName, bool success)
    {
        var properties = new Dictionary<string, string>(this.BuildDefaultProperties())
        {
            { "pluginName", pluginName },
            { "functionName", functionName },
            { "success", success.ToString() },
        };

        this._telemetryClient.TrackEvent("PluginFunction", properties);
    }

    /// <inheritdoc/>
    public void TrackPromptCacheMetrics(int promptTokens, int cachedTokens, int completionTokens, string? chatId = null)
    {
        // Calculate cache hit rate
        var cacheHitRate = promptTokens > 0 ? (double)cachedTokens / promptTokens * 100 : 0;

        // Calculate cost savings (GPT-5.2-Chat pricing: $1.75/M input, $0.175/M cached, $14/M output)
        const double InputCostPerMillion = 1.75;
        const double CachedCostPerMillion = 0.175;  // 90% discount
        const double OutputCostPerMillion = 14.0;

        var normalInputCost = promptTokens * InputCostPerMillion / 1_000_000;
        var actualInputCost = (promptTokens - cachedTokens) * InputCostPerMillion / 1_000_000
                            + cachedTokens * CachedCostPerMillion / 1_000_000;
        var outputCost = completionTokens * OutputCostPerMillion / 1_000_000;
        var savingsUsd = normalInputCost - actualInputCost;

        var properties = new Dictionary<string, string>(this.BuildDefaultProperties());
        if (!string.IsNullOrEmpty(chatId))
        {
            properties["chatId"] = chatId;
        }

        // Track as an event with all metrics for detailed analysis and dashboards
        var eventProperties = new Dictionary<string, string>(properties)
        {
            { "promptTokens", promptTokens.ToString() },
            { "cachedTokens", cachedTokens.ToString() },
            { "completionTokens", completionTokens.ToString() },
            { "cacheHitRate", cacheHitRate.ToString("F2") },
            { "savingsUSD", savingsUsd.ToString("F6") },
            { "totalCostUSD", (actualInputCost + outputCost).ToString("F6") }
        };

        this._telemetryClient.TrackEvent("PromptCacheMetrics", eventProperties);

        // Also track key metrics individually for easier querying
        this._telemetryClient.TrackMetric("AI.CacheHitRate", cacheHitRate);
        this._telemetryClient.TrackMetric("AI.PromptTokens", promptTokens);
        this._telemetryClient.TrackMetric("AI.CachedTokens", cachedTokens);
    }

    /// <summary>
    /// Gets the current user's ID from the http context for the current request.
    /// </summary>
    /// <param name="contextAccessor">The http context accessor</param>
    /// <returns></returns>
    public static string GetUserIdFromHttpContext(IHttpContextAccessor contextAccessor)
    {
        var context = contextAccessor.HttpContext;
        if (context == null)
        {
            return UnknownUserId;
        }

        var user = context.User;
        if (user?.Identity?.IsAuthenticated != true)
        {
            return UnknownUserId;
        }

        var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (userId == null)
        {
            return UnknownUserId;
        }

        return userId;
    }

    /// <summary>
    /// Prepares a list of common properties that all telemetry events should contain.
    /// </summary>
    /// <returns>Collection of common properties for all telemetry events</returns>
    private Dictionary<string, string> BuildDefaultProperties()
    {
        string? userId = GetUserIdFromHttpContext(this._httpContextAccessor);

        return new Dictionary<string, string>
        {
            { "userId", GetUserIdFromHttpContext(this._httpContextAccessor) }
        };
    }
}