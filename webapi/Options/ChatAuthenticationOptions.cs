// Copyright (c) Microsoft. All rights reserved.

using System.ComponentModel.DataAnnotations;

namespace CopilotChat.WebApi.Options;

/// <summary>
/// Configuration options for authenticating to the service.
/// </summary>
internal sealed class ChatAuthenticationOptions
{
    public const string PropertyName = "Authentication";

    internal enum AuthenticationType
    {
        None,
        AzureAd
    }

    /// <summary>
    /// Type of authentication.
    /// </summary>
    [Required]
    public AuthenticationType Type { get; set; } = AuthenticationType.None;

    /// <summary>
    /// When <see cref="Type"/> is <see cref="AuthenticationType.AzureAd"/>, these are the Azure AD options to use.
    /// </summary>
    [RequiredOnPropertyValue(nameof(Type), AuthenticationType.AzureAd)]
    public AzureAdOptions? AzureAd { get; set; }

    /// <summary>
    /// Configuration options for Azure Active Directory (AAD) authorization.
    /// </summary>
    internal sealed class AzureAdOptions
    {
        /// <summary>
        /// AAD instance url, i.e., https://login.microsoftonline.com
        /// </summary>
        [Required, NotEmptyOrWhitespace]
        public string Instance { get; set; } = string.Empty;

        /// <summary>
        /// Tenant (directory) ID
        /// </summary>
        [Required, NotEmptyOrWhitespace]
        public string TenantId { get; set; } = string.Empty;

        /// <summary>
        /// Application (client) ID
        /// </summary>
        [Required, NotEmptyOrWhitespace]
        public string ClientId { get; set; } = string.Empty;

        /// <summary>
        /// Required scopes.
        /// </summary>
        [Required]
        public string? Scopes { get; set; } = string.Empty;

        /// <summary>
        /// Application ID URI with domain for Teams SSO support.
        /// If set, this will be used instead of constructing from ClientId.
        /// Example: "api://mimir.vlfk.no/db0932b4-3bb7-4b89-a398-85be5940e84f"
        /// </summary>
        public string? ApplicationIdUri { get; set; }
    }
}
