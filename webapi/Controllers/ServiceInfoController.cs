// Copyright (c) Microsoft. All rights reserved.

using System.Diagnostics;
using System.Reflection;
using CopilotChat.WebApi.Auth;
using CopilotChat.WebApi.Models.Response;
using CopilotChat.WebApi.Options;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Microsoft.KernelMemory;

namespace CopilotChat.WebApi.Controllers;

/// <summary>
/// Controller responsible for returning information on the service.
/// </summary>
[ApiController]
internal sealed class ServiceInfoController : ControllerBase
{
    private readonly ILogger<ServiceInfoController> _logger;
    private readonly IConfiguration _configuration;
    private readonly KernelMemoryConfig _memoryOptions;
    private readonly ChatAuthenticationOptions _chatAuthenticationOptions;
    private readonly FrontendOptions _frontendOptions;
    private readonly IEnumerable<Plugin> _availablePlugins;
    private readonly ContentSafetyOptions _contentSafetyOptions;
    private readonly PromptsOptions _promptsOptions;
    private readonly IAuthInfo _authInfo;

    public ServiceInfoController(
        ILogger<ServiceInfoController> logger,
        IConfiguration configuration,
        IOptions<KernelMemoryConfig> memoryOptions,
        IOptions<ChatAuthenticationOptions> chatAuthenticationOptions,
        IOptions<FrontendOptions> frontendOptions,
        IDictionary<string, Plugin> availablePlugins,
        IOptions<ContentSafetyOptions> contentSafetyOptions,
        IOptions<PromptsOptions> promptsOptions,
        IAuthInfo authInfo)
    {
        this._logger = logger;
        this._configuration = configuration;
        this._memoryOptions = memoryOptions.Value;
        this._chatAuthenticationOptions = chatAuthenticationOptions.Value;
        this._frontendOptions = frontendOptions.Value;
        this._availablePlugins = this.SanitizePlugins(availablePlugins);
        this._contentSafetyOptions = contentSafetyOptions.Value;
        this._promptsOptions = promptsOptions.Value;
        this._authInfo = authInfo;
    }

    /// <summary>
    /// Return information on running service.
    /// </summary>
    [Route("info")]
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetServiceInfo()
    {
        var response = new ServiceInfoResponse()
        {
            MemoryStore = new MemoryStoreInfoResponse()
            {
                Types = Enum.GetNames(typeof(MemoryStoreType)),
                SelectedType = this._memoryOptions.GetMemoryStoreType(this._configuration).ToString(),
            },
            AvailablePlugins = this._availablePlugins,
            Version = GetAssemblyFileVersion(),
            IsContentSafetyEnabled = this._contentSafetyOptions.Enabled
        };

        return this.Ok(response);
    }

    /// <summary>
    /// Return the auth config to be used by the frontend client to access this service.
    /// </summary>
    [Route("authConfig")]
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [AllowAnonymous]
    public IActionResult GetAuthConfig()
    {
        string authorityUriString = string.Empty;
        if (!string.IsNullOrEmpty(this._chatAuthenticationOptions.AzureAd!.Instance) &&
            !string.IsNullOrEmpty(this._chatAuthenticationOptions.AzureAd!.TenantId))
        {
            var authorityUri = new Uri(this._chatAuthenticationOptions.AzureAd!.Instance);
            authorityUri = new Uri(authorityUri, this._chatAuthenticationOptions.AzureAd!.TenantId);
            authorityUriString = authorityUri.ToString();
        }

        // Build the API scope URI - use ApplicationIdUri if set (for Teams SSO with domain),
        // otherwise fall back to constructing from ClientId
        var apiUriBase = !string.IsNullOrEmpty(this._chatAuthenticationOptions.AzureAd!.ApplicationIdUri)
            ? this._chatAuthenticationOptions.AzureAd!.ApplicationIdUri
            : $"api://{this._chatAuthenticationOptions.AzureAd!.ClientId}";

        var config = new FrontendAuthConfig
        {
            AuthType = this._chatAuthenticationOptions.Type.ToString(),
            AadAuthority = authorityUriString,
            AadClientId = this._frontendOptions.AadClientId,
            AadApiScope = $"{apiUriBase}/{this._chatAuthenticationOptions.AzureAd!.Scopes}",
        };

        return this.Ok(config);
    }

    private static string GetAssemblyFileVersion()
    {
        Assembly assembly = Assembly.GetExecutingAssembly();
        FileVersionInfo fileVersion = FileVersionInfo.GetVersionInfo(assembly.Location);

        return fileVersion.FileVersion ?? string.Empty;
    }

    /// <summary>
    /// Get available chat templates for the current user.
    /// Templates may be restricted by Azure AD group membership.
    /// In dev mode (Authentication.Type = None), all enabled templates are shown.
    /// </summary>
    [Route("templates")]
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetAvailableTemplates()
    {
        var availableTemplates = new List<AvailableTemplate>();

        if (this._promptsOptions.Templates == null)
        {
            return this.Ok(availableTemplates);
        }

        // Check if we're in dev mode (no authentication)
        bool isDevMode = this._chatAuthenticationOptions.Type == ChatAuthenticationOptions.AuthenticationType.None;

        if (isDevMode)
        {
            this._logger.LogDebug("Dev mode detected (Authentication.Type = None). Showing all enabled templates.");
        }

        var userGroups = this._authInfo.Groups;
        var userRoles = this._authInfo.Roles;

        this._logger.LogDebug(
            "Getting available templates for user {UserId}. User roles: [{Roles}], User groups: [{Groups}]",
            this._authInfo.UserId,
            string.Join(", ", userRoles),
            string.Join(", ", userGroups));

        foreach (var (templateId, template) in this._promptsOptions.Templates)
        {
            // Skip disabled templates
            if (!template.Enabled)
            {
                this._logger.LogDebug("Template '{TemplateId}' is disabled, skipping.", templateId);
                continue;
            }

            // In dev mode, skip access check and show all enabled templates
            if (!isDevMode)
            {
                // Check if user has access to this template (by App Role, user ID, or group membership)
                if (!template.IsUserAllowed(this._authInfo.UserId, userGroups, userRoles))
                {
                    this._logger.LogDebug(
                        "User {UserId} does not have access to template '{TemplateId}'. Required roles: [{RequiredRoles}], Allowed groups: [{AllowedGroups}], Allowed users: [{AllowedUsers}]",
                        this._authInfo.UserId,
                        templateId,
                        string.Join(", ", template.RequiredRoles ?? new List<string>()),
                        string.Join(", ", template.AllowedGroups ?? new List<string>()),
                        string.Join(", ", template.AllowedUsers ?? new List<string>()));
                    continue;
                }
            }

            availableTemplates.Add(new AvailableTemplate
            {
                Id = templateId,
                DisplayName = template.DisplayName ?? templateId,
                Description = template.Description,
                Icon = template.Icon,
            });

            this._logger.LogDebug("Template '{TemplateId}' is available for user {UserId}.", templateId, this._authInfo.UserId);
        }

        return this.Ok(availableTemplates);
    }

    /// <summary>
    /// Debug endpoint to inspect the current user's token claims.
    /// Useful for verifying that App Roles, groups, and other claims are correctly
    /// emitted by Azure AD. Only available in Development environment.
    /// </summary>
    [Route("debug/claims")]
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public IActionResult GetDebugClaims([FromServices] IWebHostEnvironment env)
    {
        // Only allow in Development or when user has Swagger access (via role, group, or user ID)
        if (!env.IsDevelopment())
        {
            var swaggerRequiredRoles = this._configuration.GetSection("Swagger:RequiredRoles").Get<string[]>() ?? [];
            var swaggerAuthorizedUsers = this._configuration.GetSection("Swagger:AuthorizedUsers").Get<string[]>() ?? [];
            var swaggerAuthorizedGroups = this._configuration.GetSection("Swagger:AuthorizedGroups").Get<string[]>() ?? [];

            // Check App Roles (recommended)
            var isRoleAuthorized = swaggerRequiredRoles.Length > 0 &&
                this._authInfo.Roles.Any(userRole =>
                    swaggerRequiredRoles.Any(requiredRole =>
                        string.Equals(userRole, requiredRole, StringComparison.OrdinalIgnoreCase)));

            // Fallback: check user Object ID
            var userObjectId = this.HttpContext.User.Claims
                .FirstOrDefault(c => c.Type == "oid" || c.Type == "http://schemas.microsoft.com/identity/claims/objectidentifier")
                ?.Value;
            var isUserAuthorized = swaggerAuthorizedUsers.Length > 0 &&
                userObjectId != null &&
                swaggerAuthorizedUsers.Contains(userObjectId, StringComparer.OrdinalIgnoreCase);

            // Fallback: check group membership
            var isGroupAuthorized = swaggerAuthorizedGroups.Length > 0 &&
                this._authInfo.Groups.Any(userGroup =>
                    swaggerAuthorizedGroups.Contains(userGroup, StringComparer.OrdinalIgnoreCase));

            if (!isRoleAuthorized && !isUserAuthorized && !isGroupAuthorized)
            {
                return this.Forbid();
            }
        }

        // Extract all claims from the token for debugging
        var allClaims = this.HttpContext.User.Claims
            .Select(c => new { c.Type, c.Value })
            .ToList();

        // Check for group overage indicators
        var hasGroupOverage = this.HttpContext.User.Claims
            .Any(c => c.Type == "_claim_names" && c.Value.Contains("groups"));
        var hasGroupsClaimSource = this.HttpContext.User.Claims
            .Any(c => c.Type == "_claim_sources");

        var debugInfo = new
        {
            UserId = this._authInfo.UserId,
            UserName = this._authInfo.Name,
            Email = this._authInfo.Email,
            IsAuthenticated = this._authInfo.IsAuthenticated,

            // App Roles (the recommended way to control template access)
            Roles = this._authInfo.Roles,
            RolesCount = this._authInfo.Roles.Count,

            // Groups (may be empty due to overage)
            Groups = this._authInfo.Groups,
            GroupsCount = this._authInfo.Groups.Count,

            // Group overage detection
            GroupOverageDetected = hasGroupOverage,
            HasClaimSources = hasGroupsClaimSource,
            GroupOverageNote = hasGroupOverage
                ? "Group overage detected! The user has too many groups (150+) for Azure AD to include in the token. Use App Roles (RequiredRoles) instead of AllowedGroups for template access control."
                : "No group overage detected.",

            // Template access summary
            TemplateAccess = this._promptsOptions.Templates?.Select(t => new
            {
                TemplateId = t.Key,
                t.Value.DisplayName,
                t.Value.Enabled,
                RequiredRoles = t.Value.RequiredRoles ?? [],
                AllowedGroups = t.Value.AllowedGroups ?? [],
                AllowedUsers = t.Value.AllowedUsers ?? [],
                UserHasAccess = t.Value.IsUserAllowed(this._authInfo.UserId, this._authInfo.Groups, this._authInfo.Roles),
            }),

            // Raw token claims for debugging
            AllClaims = allClaims,
        };

        return this.Ok(debugInfo);
    }

    /// <summary>
    /// Sanitize the plugins to only return the name and url.
    /// </summary>
    /// <param name="plugins">The plugins to sanitize.</param>
    /// <returns></returns>
    private IEnumerable<Plugin> SanitizePlugins(IDictionary<string, Plugin> plugins)
    {
        return plugins.Select(p => new Plugin()
        {
            Name = p.Value.Name,
            ManifestDomain = p.Value.ManifestDomain,
        });
    }
}
