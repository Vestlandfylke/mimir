// Copyright (c) Microsoft. All rights reserved.

using System.Security.Claims;
using Azure.Identity;
using Microsoft.Identity.Web;

namespace CopilotChat.WebApi.Auth;

/// <summary>
/// Class which provides validated security information for use in controllers.
/// </summary>
public class AuthInfo : IAuthInfo
{
    private record struct AuthData(
        string UserId,
        string UserName,
        string? Email,
        IReadOnlyList<string> Groups,
        bool IsAuthenticated);

    private readonly Lazy<AuthData> _data;

    // Common claim types for groups in Azure AD tokens
    private const string GroupsClaimType = "groups";
    private const string GroupsClaimTypeAlt = "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups";

    public AuthInfo(IHttpContextAccessor httpContextAccessor)
    {
        this._data = new Lazy<AuthData>(() =>
        {
            var user = httpContextAccessor.HttpContext?.User;
            if (user is null)
            {
                throw new InvalidOperationException("HttpContext must be present to inspect auth info.");
            }

            // Some endpoints (e.g. file downloads) may allow anonymous requests. In that case,
            // avoid throwing and return empty values so callers can decide how to handle it.
            if (user.Identity?.IsAuthenticated != true)
            {
                return new AuthData
                {
                    UserId = string.Empty,
                    UserName = string.Empty,
                    Email = null,
                    Groups = Array.Empty<string>(),
                    IsAuthenticated = false,
                };
            }

            var userIdClaim = user.FindFirst(ClaimConstants.Oid)
                              ?? user.FindFirst(ClaimConstants.ObjectId)
                              ?? user.FindFirst(ClaimConstants.Sub)
                              ?? user.FindFirst(ClaimConstants.NameIdentifierId);
            if (userIdClaim is null)
            {
                throw new CredentialUnavailableException("User Id was not present in the request token.");
            }

            var tenantIdClaim = user.FindFirst(ClaimConstants.Tid)
                                ?? user.FindFirst(ClaimConstants.TenantId);
            var userNameClaim = user.FindFirst(ClaimConstants.Name);
            if (userNameClaim is null)
            {
                throw new CredentialUnavailableException("User name was not present in the request token.");
            }

            // Get email claim (preferred_username or email)
            var emailClaim = user.FindFirst("preferred_username")
                            ?? user.FindFirst(ClaimTypes.Email)
                            ?? user.FindFirst("email");

            // Extract group claims from the token
            // Azure AD can emit groups as either object IDs or names depending on config
            var groups = ExtractGroupClaims(user);

            return new AuthData
            {
                UserId = (tenantIdClaim is null) ? userIdClaim.Value : string.Join(".", userIdClaim.Value, tenantIdClaim.Value),
                UserName = userNameClaim.Value,
                Email = emailClaim?.Value,
                Groups = groups,
                IsAuthenticated = true,
            };
        }, isThreadSafe: false);
    }

    /// <summary>
    /// Extracts group claims from the user's claims principal.
    /// </summary>
    private static IReadOnlyList<string> ExtractGroupClaims(ClaimsPrincipal user)
    {
        var groups = new List<string>();

        // Try standard 'groups' claim type
        var groupClaims = user.FindAll(GroupsClaimType);
        foreach (var claim in groupClaims)
        {
            if (!string.IsNullOrWhiteSpace(claim.Value))
            {
                groups.Add(claim.Value);
            }
        }

        // Also try the full URI claim type
        var altGroupClaims = user.FindAll(GroupsClaimTypeAlt);
        foreach (var claim in altGroupClaims)
        {
            if (!string.IsNullOrWhiteSpace(claim.Value) && !groups.Contains(claim.Value))
            {
                groups.Add(claim.Value);
            }
        }

        return groups;
    }

    /// <summary>
    /// The authenticated user's unique ID.
    /// </summary>
    public string UserId => this._data.Value.UserId;

    /// <summary>
    /// The authenticated user's name.
    /// </summary>
    public string Name => this._data.Value.UserName;

    /// <summary>
    /// The authenticated user's email address.
    /// </summary>
    public string? Email => this._data.Value.Email;

    /// <summary>
    /// The Azure AD group IDs the user belongs to.
    /// </summary>
    public IReadOnlyList<string> Groups => this._data.Value.Groups;

    /// <summary>
    /// Whether the user is authenticated.
    /// </summary>
    public bool IsAuthenticated => this._data.Value.IsAuthenticated;
}
