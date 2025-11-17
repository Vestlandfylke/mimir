// Copyright (c) Microsoft. All rights reserved.

using Microsoft.Azure.Cosmos;

namespace CopilotChat.WebApi.Extensions;

/// <summary>
/// Extension methods for Cosmos DB configuration.
/// </summary>
public static class CosmosDbExtensions
{
  /// <summary>
  /// Gets optimized CosmosClientOptions for production use with concurrent connections.
  /// </summary>
  /// <returns>CosmosClientOptions configured for optimal performance and reliability.</returns>
  public static CosmosClientOptions GetOptimizedCosmosClientOptions()
  {
    return new CosmosClientOptions
    {
      // Use Direct mode for better performance (bypasses gateway)
      ConnectionMode = ConnectionMode.Direct,

      // Retry configuration for handling rate limiting (429 errors)
      MaxRetryAttemptsOnRateLimitedRequests = 9,
      MaxRetryWaitTimeOnRateLimitedRequests = TimeSpan.FromSeconds(30),

      // Connection pooling settings for concurrent requests
      MaxRequestsPerTcpConnection = 20,
      MaxTcpConnectionsPerEndpoint = 16,

      // Request timeout
      RequestTimeout = TimeSpan.FromSeconds(60),

      // Enable TCP connection endpoint rediscovery
      EnableTcpConnectionEndpointRediscovery = true,

      // Consistency level - Session is good balance for most scenarios
      ConsistencyLevel = ConsistencyLevel.Session,

      // Serialization options
      SerializerOptions = new CosmosSerializationOptions
      {
        PropertyNamingPolicy = CosmosPropertyNamingPolicy.CamelCase
      },

      // Disable telemetry for slight performance improvement
      EnableContentResponseOnWrite = false,

      // Application region (optional - let SDK choose optimal)
      // ApplicationRegion = Regions.WestEurope,
    };
  }
}

