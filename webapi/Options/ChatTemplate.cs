// Copyright (c) Microsoft. All rights reserved.

using System.ComponentModel.DataAnnotations;

namespace CopilotChat.WebApi.Options;

/// <summary>
/// Configuration for a specialized chat template.
/// </summary>
public class ChatTemplate
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
  /// List of Azure AD group IDs or names that have access to this template.
  /// If empty or null (and AllowedUsers is also empty), the template is available to all users.
  /// </summary>
  public List<string>? AllowedGroups { get; set; }

  /// <summary>
  /// List of user IDs (Object IDs) that have access to this template.
  /// Useful for testing or granting access to specific individuals.
  /// </summary>
  public List<string>? AllowedUsers { get; set; }

  /// <summary>
  /// Whether this template is currently enabled/active.
  /// Set to false to disable a template without removing it from config.
  /// </summary>
  public bool Enabled { get; set; } = true;

  /// <summary>
  /// Checks if a user has access to this template.
  /// Access is granted if the user's ID is in AllowedUsers OR if the user is in any AllowedGroups.
  /// </summary>
  /// <param name="userId">The user's Object ID.</param>
  /// <param name="userGroups">The user's group claims (IDs or names).</param>
  /// <returns>True if the user has access, false otherwise.</returns>
  public bool IsUserAllowed(string? userId, IEnumerable<string>? userGroups)
  {
    // If no restrictions are specified, template is available to all
    bool hasGroupRestrictions = AllowedGroups != null && AllowedGroups.Count > 0;
    bool hasUserRestrictions = AllowedUsers != null && AllowedUsers.Count > 0;

    if (!hasGroupRestrictions && !hasUserRestrictions)
    {
      return true;
    }

    // Check if user ID is explicitly allowed
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

    // Check if user has any of the allowed groups
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
  /// Overload for backwards compatibility - checks only groups.
  /// </summary>
  public bool IsUserAllowed(IEnumerable<string>? userGroups)
  {
    return IsUserAllowed(null, userGroups);
  }
}

