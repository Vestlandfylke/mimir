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
    /// </summary>
    public IReadOnlyList<string> Groups { get; }

    /// <summary>
    /// Whether the user is authenticated.
    /// </summary>
    public bool IsAuthenticated { get; }
}
