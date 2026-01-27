// Copyright (c) Microsoft. All rights reserved.

namespace CopilotChat.WebApi.Options;

/// <summary>
/// Configuration options for the Lovdata plugin.
/// Provides access to Norwegian laws and regulations via the Lovdata API.
/// This plugin is specifically designed for the Leader assistant.
/// </summary>
internal sealed class LovdataPluginOptions
{
    public const string PropertyName = "Lovdata";

    /// <summary>
    /// Whether the Lovdata plugin is enabled.
    /// </summary>
    public bool Enabled { get; set; } = false;

    /// <summary>
    /// The Lovdata API base URL.
    /// Default: https://api.lovdata.no
    /// </summary>
    public string BaseUrl { get; set; } = "https://api.lovdata.no";

    /// <summary>
    /// Optional API key for authenticated Lovdata endpoints.
    /// When provided, enables full-text search and AI search features.
    /// Should be set via user-secrets: dotnet user-secrets set "Lovdata:ApiKey" "YOUR_KEY"
    /// </summary>
    public string? ApiKey { get; set; }

    /// <summary>
    /// Maximum content length (in characters) to return from each law document.
    /// Helps prevent token limit issues with large law texts.
    /// Default: 50000 characters (~12,500 tokens)
    /// </summary>
    public int MaxContentLength { get; set; } = 50000;

    /// <summary>
    /// Maximum number of results to return when listing laws.
    /// </summary>
    public int MaxResults { get; set; } = 20;

    /// <summary>
    /// Request timeout in seconds for Lovdata API calls.
    /// </summary>
    public int TimeoutSeconds { get; set; } = 30;

    /// <summary>
    /// Whether to require user approval before executing Lovdata operations.
    /// When true, the system will show a plan with the proposed operations and wait for user approval.
    /// Default: false (law lookups are generally safe and don't need approval).
    /// </summary>
    public bool RequireApproval { get; set; } = false;

    /// <summary>
    /// The plugin name used when registering with Semantic Kernel.
    /// </summary>
    public const string PluginName = "lovdata";

    /// <summary>
    /// Whether the plugin has an API key configured for authenticated endpoints.
    /// </summary>
    public bool IsAuthenticated => !string.IsNullOrWhiteSpace(ApiKey);

    /// <summary>
    /// Validates that minimum required configuration is present.
    /// The plugin can work without an API key using public endpoints.
    /// </summary>
    public bool IsConfigured => !string.IsNullOrWhiteSpace(BaseUrl);
}
