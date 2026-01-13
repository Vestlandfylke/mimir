// Copyright (c) Microsoft. All rights reserved.

using System.Security.Claims;
using System.Threading.RateLimiting;
using CopilotChat.WebApi.Options;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace CopilotChat.WebApi.Extensions;

/// <summary>
/// Extension methods for configuring rate limiting.
/// </summary>
public static class RateLimitingExtensions
{
    /// <summary>
    /// Policy name for chat message rate limiting.
    /// </summary>
    public const string ChatPolicy = "ChatRateLimit";

    /// <summary>
    /// Policy name for general API rate limiting.
    /// </summary>
    public const string GeneralPolicy = "GeneralRateLimit";

    /// <summary>
    /// Add rate limiting services to the application.
    /// </summary>
    public static IServiceCollection AddRateLimitingServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Bind configuration
        var rateLimitingSection = configuration.GetSection(RateLimitingOptions.PropertyName);
        services.Configure<RateLimitingOptions>(rateLimitingSection);

        var options = rateLimitingSection.Get<RateLimitingOptions>() ?? new RateLimitingOptions();

        if (!options.Enabled)
        {
            return services;
        }

        // Add Redis if configured
        if (options.UseRedis)
        {
            services.AddStackExchangeRedisCache(redisOptions =>
            {
                redisOptions.Configuration = options.RedisConnectionString;
                redisOptions.InstanceName = "MimirRateLimit:";
            });

            // Add connection multiplexer for rate limiting
            services.AddSingleton<IConnectionMultiplexer>(sp =>
            {
                var logger = sp.GetRequiredService<ILogger<Program>>();
                try
                {
                    return ConnectionMultiplexer.Connect(options.RedisConnectionString!);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Failed to connect to Redis for rate limiting. Falling back to in-memory rate limiting.");
                    throw;
                }
            });
        }

        // Configure rate limiter
        services.AddRateLimiter(limiterOptions =>
        {
            limiterOptions.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // Add callback for rejected requests
            limiterOptions.OnRejected = async (context, cancellationToken) =>
            {
                var logger = context.HttpContext.RequestServices.GetService<ILogger<Program>>();
                var userId = GetUserId(context.HttpContext);

                logger?.LogWarning(
                    "Rate limit exceeded for user {UserId} on endpoint {Endpoint}",
                    userId,
                    context.HttpContext.Request.Path);

                context.HttpContext.Response.ContentType = "application/json";
                await context.HttpContext.Response.WriteAsJsonAsync(new
                {
                    error = "For mange førespurnader",
                    message = "Du har sendt for mange meldingar. Vent litt før du prøver igjen.",
                    retryAfter = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter)
                        ? retryAfter.TotalSeconds
                        : 60
                }, cancellationToken);
            };

            // Chat-specific rate limiting policy (stricter)
            limiterOptions.AddPolicy(ChatPolicy, context =>
            {
                var userId = GetUserId(context);

                // Use sliding window limiter for chat messages
                return RateLimitPartition.GetSlidingWindowLimiter(
                    partitionKey: userId,
                    factory: _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = options.MessagesPerMinute,
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 6, // 10-second segments for smoother limiting
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        QueueLimit = 0 // Don't queue, reject immediately
                    });
            });

            // General API rate limiting policy
            limiterOptions.AddPolicy(GeneralPolicy, context =>
            {
                var userId = GetUserId(context);

                return RateLimitPartition.GetTokenBucketLimiter(
                    partitionKey: userId,
                    factory: _ => new TokenBucketRateLimiterOptions
                    {
                        TokenLimit = options.ConcurrentRequestsPerUser * 2,
                        TokensPerPeriod = options.ConcurrentRequestsPerUser,
                        ReplenishmentPeriod = TimeSpan.FromSeconds(10),
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        QueueLimit = 2,
                        AutoReplenishment = true
                    });
            });

            // Global rate limiter (applies to all requests)
            if (options.GlobalRequestsPerMinute > 0)
            {
                limiterOptions.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                {
                    return RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: "global",
                        factory: _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = options.GlobalRequestsPerMinute,
                            Window = TimeSpan.FromMinutes(1),
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                            QueueLimit = 0
                        });
                });
            }
        });

        return services;
    }

    /// <summary>
    /// Get user identifier for rate limiting partitioning.
    /// Uses authenticated user ID if available, otherwise falls back to IP address.
    /// </summary>
    private static string GetUserId(HttpContext context)
    {
        // Try to get authenticated user ID
        var userId = context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? context.User?.FindFirst("oid")?.Value // Azure AD object ID
            ?? context.User?.FindFirst("sub")?.Value; // Subject claim

        if (!string.IsNullOrEmpty(userId))
        {
            return $"user:{userId}";
        }

        // Fall back to IP address for unauthenticated requests
        var ipAddress = context.Connection.RemoteIpAddress?.ToString()
            ?? context.Request.Headers["X-Forwarded-For"].FirstOrDefault()
            ?? "unknown";

        return $"ip:{ipAddress}";
    }
}
