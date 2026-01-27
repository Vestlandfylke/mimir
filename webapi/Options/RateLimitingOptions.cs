// Copyright (c) Microsoft. All rights reserved.

using System.ComponentModel.DataAnnotations;

namespace CopilotChat.WebApi.Options;

/// <summary>
/// Configuration options for rate limiting to protect against spam and abuse.
/// </summary>
internal sealed class RateLimitingOptions
{
    public const string PropertyName = "RateLimiting";

    /// <summary>
    /// Whether rate limiting is enabled.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Maximum number of chat messages per user per minute.
    /// </summary>
    [Range(1, 1000)]
    public int MessagesPerMinute { get; set; } = 20;

    /// <summary>
    /// Maximum number of chat messages per user per hour.
    /// </summary>
    [Range(1, 10000)]
    public int MessagesPerHour { get; set; } = 200;

    /// <summary>
    /// Maximum number of concurrent requests per user.
    /// </summary>
    [Range(1, 100)]
    public int ConcurrentRequestsPerUser { get; set; } = 5;

    /// <summary>
    /// Global rate limit - maximum requests per minute across all users.
    /// Set to 0 to disable global limit.
    /// </summary>
    [Range(0, 100000)]
    public int GlobalRequestsPerMinute { get; set; } = 1000;

    /// <summary>
    /// Redis connection string for distributed rate limiting.
    /// If not set, in-memory rate limiting will be used (not suitable for multiple instances).
    /// </summary>
    public string? RedisConnectionString { get; set; }

    /// <summary>
    /// Whether to use Redis for distributed rate limiting.
    /// </summary>
    public bool UseRedis => !string.IsNullOrWhiteSpace(RedisConnectionString);
}
