// Copyright (c) Microsoft. All rights reserved.

using System.ComponentModel.DataAnnotations;

namespace CopilotChat.WebApi.Options;

/// <summary>
/// Configuration for a specialized chat template.
/// </summary>
internal sealed class ChatTemplate
{
    /// <summary>
    /// Display name shown in the UI for this template.
    /// </summary>
    public string? DisplayName { get; set; }

    /// <summary>
    /// Description shown in the UI for this template.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Icon identifier for the template (e.g., "leader", "klarsprak").
    /// </summary>
    public string? Icon { get; set; }

    /// <summary>
    /// System description for this template.
    /// </summary>
    [Required, NotEmptyOrWhitespace]
    public string SystemDescription { get; set; } = string.Empty;

    /// <summary>
    /// Initial bot message for this template.
    /// </summary>
    [Required, NotEmptyOrWhitespace]
    public string InitialBotMessage { get; set; } = string.Empty;

    /// <summary>
    /// Optional static cache prefix for this template.
    /// If not set, falls back to the global SystemCachePrefix.
    /// Used for Azure OpenAI prompt caching optimization.
    /// </summary>
    public string? SystemCachePrefix { get; set; }

    /// <summary>
    /// App Roles required to access this template (RECOMMENDED).
    /// These are defined in the App Registration manifest and assigned to AAD groups
    /// via the Enterprise Application in Azure Portal (Enterprise App > Users and groups).
    /// If empty/null (and no other restrictions), the template is available to all users.
    /// Example: ["Mimir.Leiar"] - user must have the "Mimir.Leiar" App Role.
    /// </summary>
    public List<string>? RequiredRoles { get; set; }

    /// <summary>
    /// List of Azure AD group IDs that have access to this template (LEGACY/FALLBACK).
    /// Prefer RequiredRoles instead - groups may not be present in the token due to
    /// group overage (150+ groups) in large organizations like Vestland fylkeskommune.
    /// If empty or null (and no other restrictions), the template is available to all users.
    /// </summary>
    public List<string>? AllowedGroups { get; set; }

    /// <summary>
    /// List of user IDs (Object IDs) that have access to this template.
    /// Useful for testing or granting access to specific individuals during development.
    /// </summary>
    public List<string>? AllowedUsers { get; set; }

    /// <summary>
    /// Whether this template is currently enabled/active.
    /// Set to false to disable a template without removing it from config.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Checks if a user has access to this template.
    /// Access is checked in this priority order:
    /// 1. If no restrictions are configured → allow all users
    /// 2. Check RequiredRoles against user's App Roles (recommended, always works)
    /// 3. Check AllowedUsers against user's Object ID (for testing)
    /// 4. Check AllowedGroups against user's group claims (may fail with group overage)
    /// </summary>
    /// <param name="userId">The user's Object ID (may include tenant suffix).</param>
    /// <param name="userGroups">The user's group claims (IDs or names).</param>
    /// <param name="userRoles">The user's App Role claims from the token.</param>
    /// <returns>True if the user has access, false otherwise.</returns>
    public bool IsUserAllowed(string? userId, IEnumerable<string>? userGroups, IEnumerable<string>? userRoles)
    {
        // If no restrictions are specified at all, template is available to all
        bool hasRoleRestrictions = RequiredRoles != null && RequiredRoles.Count > 0;
        bool hasGroupRestrictions = AllowedGroups != null && AllowedGroups.Count > 0;
        bool hasUserRestrictions = AllowedUsers != null && AllowedUsers.Count > 0;

        if (!hasRoleRestrictions && !hasGroupRestrictions && !hasUserRestrictions)
        {
            return true;
        }

        // Check App Roles first (recommended - always present in token, no overage issue)
        if (hasRoleRestrictions && userRoles != null)
        {
            if (userRoles.Any(userRole =>
              RequiredRoles!.Any(requiredRole =>
                string.Equals(userRole, requiredRole, StringComparison.OrdinalIgnoreCase))))
            {
                return true;
            }
        }

        // Check if user ID is explicitly allowed (useful for testing)
        if (hasUserRestrictions && !string.IsNullOrEmpty(userId))
        {
            if (AllowedUsers!.Any(allowedUser =>
              string.Equals(userId, allowedUser, StringComparison.OrdinalIgnoreCase) ||
              // Also check without tenant suffix (userId might be "objectId.tenantId")
              userId.StartsWith(allowedUser, StringComparison.OrdinalIgnoreCase)))
            {
                return true;
            }
        }

        // Check if user has any of the allowed groups (legacy fallback)
        if (hasGroupRestrictions && userGroups != null)
        {
            if (userGroups.Any(userGroup =>
              AllowedGroups!.Any(allowedGroup =>
                string.Equals(userGroup, allowedGroup, StringComparison.OrdinalIgnoreCase))))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// Overload for backwards compatibility - checks user ID and groups only (no roles).
    /// </summary>
    public bool IsUserAllowed(string? userId, IEnumerable<string>? userGroups)
    {
        return IsUserAllowed(userId, userGroups, null);
    }

    /// <summary>
    /// Overload for backwards compatibility - checks only groups.
    /// </summary>
    public bool IsUserAllowed(IEnumerable<string>? userGroups)
    {
        return IsUserAllowed(null, userGroups, null);
    }
}
