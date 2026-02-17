// Copyright (c) Microsoft. All rights reserved.

using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace CopilotChat.WebApi.Services;

/// <summary>
/// Service that manages short-lived, one-time download tokens.
/// These tokens allow file downloads via direct URL navigation (e.g., window.open)
/// which is required for mobile browsers and Teams WebViews where the
/// blob + programmatic anchor click approach does not work.
/// </summary>
public sealed class DownloadTokenService
{
    private readonly ConcurrentDictionary<string, DownloadToken> _tokens = new();
    private readonly TimeSpan _tokenLifetime = TimeSpan.FromSeconds(60);
    private int _cleanupCounter;

    /// <summary>
    /// Generates a short-lived, one-time-use download token for a specific file.
    /// </summary>
    /// <param name="fileId">The file ID this token grants access to.</param>
    /// <param name="userId">The user ID that requested the token.</param>
    /// <returns>The generated token string.</returns>
    public string GenerateToken(string fileId, string userId)
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');

        var downloadToken = new DownloadToken
        {
            FileId = fileId,
            UserId = userId,
            ExpiresAt = DateTimeOffset.UtcNow.Add(this._tokenLifetime),
        };

        this._tokens[token] = downloadToken;

        // Periodically clean up expired tokens (every 50 token creations)
        if (Interlocked.Increment(ref this._cleanupCounter) % 50 == 0)
        {
            this.CleanupExpiredTokens();
        }

        return token;
    }

    /// <summary>
    /// Validates and consumes a download token. Each token can only be used once.
    /// </summary>
    /// <param name="token">The token to validate.</param>
    /// <param name="fileId">The file ID being downloaded (must match token).</param>
    /// <returns>The user ID associated with the token, or null if invalid.</returns>
    public string? ValidateAndConsume(string token, string fileId)
    {
        if (!this._tokens.TryRemove(token, out var downloadToken))
        {
            return null;
        }

        // Check expiry
        if (downloadToken.ExpiresAt < DateTimeOffset.UtcNow)
        {
            return null;
        }

        // Check file ID matches
        if (!string.Equals(downloadToken.FileId, fileId, StringComparison.Ordinal))
        {
            return null;
        }

        return downloadToken.UserId;
    }

    private void CleanupExpiredTokens()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var kvp in this._tokens)
        {
            if (kvp.Value.ExpiresAt < now)
            {
                this._tokens.TryRemove(kvp.Key, out _);
            }
        }
    }

    private sealed class DownloadToken
    {
        public required string FileId { get; init; }
        public required string UserId { get; init; }
        public required DateTimeOffset ExpiresAt { get; init; }
    }
}
