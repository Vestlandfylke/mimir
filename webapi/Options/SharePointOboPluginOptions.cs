// Copyright (c) Microsoft. All rights reserved.

namespace CopilotChat.WebApi.Options;

/// <summary>
/// Configuration options for SharePoint OBO (On-Behalf-Of) plugin.
/// Used to access SharePoint documents on behalf of the authenticated user.
/// </summary>
public class SharePointOboPluginOptions
{
    public const string PropertyName = "SharePointObo";

    /// <summary>
    /// The Azure AD authority URL for OBO authentication.
    /// Default: https://login.microsoftonline.com
    /// </summary>
    public string Authority { get; set; } = "https://login.microsoftonline.com";

    /// <summary>
    /// The Azure AD tenant ID.
    /// </summary>
    public string? TenantId { get; set; }

    /// <summary>
    /// The WebAPI application (client) ID registered in Azure AD.
    /// </summary>
    public string? ClientId { get; set; }

    /// <summary>
    /// The client secret for the WebAPI app registration.
    /// </summary>
    public string? ClientSecret { get; set; }

    /// <summary>
    /// The SharePoint site URL to access.
    /// Example: https://vestlandfylke.sharepoint.com/sites/leiar-dokumenter
    /// </summary>
    public string? SiteUrl { get; set; }

    /// <summary>
    /// Optional: Specific document library drive ID.
    /// If not specified, the default document library will be used.
    /// </summary>
    public string? DriveId { get; set; }

    /// <summary>
    /// The OAuth scopes required for SharePoint access via Microsoft Graph.
    /// Space-separated list of scopes.
    /// Default: https://graph.microsoft.com/Sites.Read.All https://graph.microsoft.com/Files.Read.All
    /// </summary>
    public string DefaultScopes { get; set; } = "https://graph.microsoft.com/Sites.Read.All https://graph.microsoft.com/Files.Read.All";

    /// <summary>
    /// Maximum content length (in characters) to return from document text extraction.
    /// Helps prevent token limit issues with large documents.
    /// Default: 50000 characters (~12,500 tokens)
    /// </summary>
    public int MaxContentLength { get; set; } = 50000;

    /// <summary>
    /// Whether the SharePoint OBO plugin is enabled.
    /// </summary>
    public bool Enabled { get; set; } = false;

    /// <summary>
    /// Whether to require user approval before executing SharePoint operations.
    /// When true, the system will show a plan with the proposed operations and wait for user approval.
    /// Default: false (operations are executed automatically).
    /// </summary>
    public bool RequireApproval { get; set; } = false;

    /// <summary>
    /// The plugin name used when registering with Semantic Kernel.
    /// </summary>
    public const string PluginName = "sharePointObo";

    /// <summary>
    /// Validates that all required configuration is present.
    /// </summary>
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(TenantId) &&
        !string.IsNullOrWhiteSpace(ClientId) &&
        !string.IsNullOrWhiteSpace(ClientSecret) &&
        !string.IsNullOrWhiteSpace(SiteUrl);
}
