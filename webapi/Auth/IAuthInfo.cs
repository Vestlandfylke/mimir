// Copyright (c) Microsoft. All rights reserved.

namespace CopilotChat.WebApi.Auth;

internal interface IAuthInfo
{
    /// <summary>
    /// The authenticated user's unique ID.
    /// </summary>
    public string UserId { get; }

    /// <summary>
    /// The authenticated user's name.
    /// </summary>
    public string Name { get; }

    /// <summary>
    /// The authenticated user's email address.
    /// </summary>
    public string? Email { get; }

    /// <summary>
    /// The Azure AD group IDs the user belongs to.
    /// These are extracted from the 'groups' claim in the token.
    /// Note: Requires the app registration to emit group claims.
    /// May be empty due to group overage (150+ groups).
    /// </summary>
    public IReadOnlyList<string> Groups { get; }

    /// <summary>
    /// The App Roles assigned to the user via the Enterprise Application.
    /// These are extracted from the 'roles' claim in the token.
    /// App Roles are always emitted (no overage limit) and are the
    /// recommended way to control access to specialized assistants.
    /// Manage assignments in Azure Portal: Enterprise App > Users and groups.
    /// </summary>
    public IReadOnlyList<string> Roles { get; }

    /// <summary>
    /// Whether the user is authenticated.
    /// </summary>
    public bool IsAuthenticated { get; }
}
