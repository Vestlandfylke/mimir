# Azure Deployment - Scalability Issues and Recommendations

## Critical Issues Identified

### 1. **Using Development Storage in Production (CRITICAL)**

**Current Configuration:**
```json
"ChatStore": {
  "Type": "volatile"  // In-memory storage
}

"KernelMemory": {
  "DocumentStorageType": "SimpleFileStorage",  // File-based storage
  "DataIngestion": {
    "OrchestrationType": "Distributed",
    "DistributedOrchestration": {
      "QueueType": "SimpleQueues"  // File-based queues
    },
    "MemoryDbTypes": ["SimpleVectorDb"]  // File-based vector DB
  },
  "Retrieval": {
    "MemoryDbType": "SimpleVectorDb"  // File-based vector DB
  }
}
```

**Problem:** 
- **Volatile storage** means all chat sessions are stored in RAM and lost on restart/crash
- **SimpleFileStorage, SimpleQueues, SimpleVectorDb** are all **file-based** and designed for **LOCAL DEVELOPMENT ONLY**
- When multiple users access simultaneously, file I/O contention causes locks and crashes
- Azure App Service instances don't share local file systems - each instance has its own copy
- If Azure scales out to multiple instances, data becomes inconsistent across instances

**Impact on 10-20 concurrent users:**
- File locks when multiple requests try to read/write simultaneously
- Memory exhaustion if all sessions are held in RAM
- Application crashes due to I/O contention
- Data loss on every restart

---

### 2. **Missing Cosmos DB Configuration (HIGH PRIORITY)**

**Current State:** ChatStore type is set to "volatile" instead of "cosmos"

**Required Changes:**
Your application is configured to use Cosmos DB but it's not enabled. You need to:

1. Change `ChatStore.Type` from `"volatile"` to `"cosmos"`
2. Ensure Cosmos DB connection string is set
3. Verify Cosmos DB containers exist with correct partition keys

---

### 3. **No Connection Pooling Configuration (HIGH PRIORITY)**

**Missing Configuration:**

The application uses:
- **CosmosClient** without explicit connection mode/settings
- **HttpClient** factory without timeout/pooling configuration
- **SignalR** without scale-out configuration

**Current CosmosDB Context Issues:**
```csharp
// In CosmosDbContext.cs - No connection pooling configuration
var options = new CosmosClientOptions
{
    SerializerOptions = new CosmosSerializationOptions
    {
        PropertyNamingPolicy = CosmosPropertyNamingPolicy.CamelCase
    },
};
this._client = new CosmosClient(connectionString, options);
```

**Problems:**
- No connection mode specified (Direct vs Gateway)
- No max connection limit set
- No retry policy configured
- No request timeout configured
- Creates new CosmosClient for each context (should be singleton)

---

### 4. **SignalR Not Configured for Scale-Out (HIGH PRIORITY)**

**Current Configuration:**
```csharp
builder.Services.AddSignalR();  // No backplane configured
```

**Problem:**
- When Azure App Service scales to multiple instances, SignalR connections are per-instance
- Users connected to different instances won't receive messages
- No Azure SignalR Service or Redis backplane configured

---

### 5. **No Kestrel/IIS Configuration for Production (MEDIUM)**

**Current Kestrel Config:**
```json
"Kestrel": {
  "Endpoints": {
    "Https": {
      "Url": "https://localhost:40443"
    }
  }
}
```

**Missing:**
- Request queue limits
- Maximum concurrent connections
- Request body size limits
- Connection timeout settings

---

### 6. **Azure OpenAI Rate Limiting Not Handled (MEDIUM)**

**Current Configuration:**
```json
"AzureOpenAIText": {
  "MaxRetries": 10  // Retries configured but may not be enough
}
```

**Problems:**
- With 10-20 concurrent users, you'll hit Azure OpenAI rate limits quickly
- No exponential backoff configuration visible
- No circuit breaker pattern implemented
- No request throttling at application level

---

## Recommended Solutions (Priority Order)

### IMMEDIATE FIXES (Deploy ASAP)

#### 1. Enable Cosmos DB for Chat Storage

**Update `appsettings.json`:**
```json
{
  "ChatStore": {
    "Type": "cosmos",
    "Cosmos": {
      "Database": "CopilotChat",
      "ChatSessionsContainer": "chatsessions",
      "ChatMessagesContainer": "chatmessages",
      "ChatMemorySourcesContainer": "chatmemorysources",
      "ChatParticipantsContainer": "chatparticipants"
      // ConnectionString set via user-secrets or Azure App Settings
    }
  }
}
```

**Set in Azure App Service Configuration:**
```bash
az webapp config appsettings set \
  --name <your-app-name> \
  --resource-group <your-rg> \
  --settings ChatStore__Cosmos__ConnectionString="<your-cosmos-connection-string>"
```

**Verify Cosmos DB Containers:**
Ensure these containers exist with correct partition keys:
- `chatsessions` - partition key: `/id`
- `chatmessages` - partition key: `/chatId`
- `chatmemorysources` - partition key: `/chatId`
- `chatparticipants` - partition key: `/userId`

---

#### 2. Configure Production Storage for Kernel Memory

**Update `appsettings.json`:**
```json
{
  "KernelMemory": {
    "DocumentStorageType": "AzureBlobs",
    "DataIngestion": {
      "OrchestrationType": "Distributed",
      "DistributedOrchestration": {
        "QueueType": "AzureQueue"  // Changed from SimpleQueues
      },
      "MemoryDbTypes": ["AzureAISearch"]  // Changed from SimpleVectorDb
    },
    "Retrieval": {
      "MemoryDbType": "AzureAISearch",  // Changed from SimpleVectorDb
      "EmbeddingGeneratorType": "AzureOpenAIEmbedding"
    },
    "Services": {
      "AzureBlobs": {
        "Auth": "ConnectionString",
        "Container": "memorypipeline"
      },
      "AzureQueue": {
        "Auth": "ConnectionString"
      },
      "AzureAISearch": {
        "Auth": "ApiKey",
        "Endpoint": "<your-search-endpoint>"
      }
    }
  }
}
```

**Set in Azure App Service:**
```bash
# Azure Storage for blobs and queues
az webapp config appsettings set \
  --settings KernelMemory__Services__AzureBlobs__ConnectionString="<storage-conn-string>" \
             KernelMemory__Services__AzureQueue__ConnectionString="<storage-conn-string>" \
             KernelMemory__Services__AzureAISearch__APIKey="<search-api-key>"
```

---

#### 3. Optimize Cosmos DB Connection

**Create a new file: `webapi/Extensions/CosmosDbExtensions.cs`**
```csharp
using Microsoft.Azure.Cosmos;
using CopilotChat.WebApi.Options;

namespace CopilotChat.WebApi.Extensions;

public static class CosmosDbExtensions
{
    public static CosmosClientOptions GetOptimizedCosmosClientOptions()
    {
        return new CosmosClientOptions
        {
            ConnectionMode = ConnectionMode.Direct,  // Better performance
            MaxRetryAttemptsOnRateLimitedRequests = 9,
            MaxRetryWaitTimeOnRateLimitedRequests = TimeSpan.FromSeconds(30),
            MaxRequestsPerTcpConnection = 20,
            MaxTcpConnectionsPerEndpoint = 16,
            RequestTimeout = TimeSpan.FromSeconds(60),
            SerializerOptions = new CosmosSerializationOptions
            {
                PropertyNamingPolicy = CosmosPropertyNamingPolicy.CamelCase
            },
            // Enable bulk operations for better throughput
            AllowBulkExecution = false,  // Set to true only if doing bulk operations
            ConsistencyLevel = ConsistencyLevel.Session  // Good balance of performance/consistency
        };
    }
}
```

**Update `webapi/Storage/CosmosDbContext.cs`:**
```csharp
// BEFORE (line 32-43):
public CosmosDbContext(string connectionString, string database, string container)
{
    var options = new CosmosClientOptions
    {
        SerializerOptions = new CosmosSerializationOptions
        {
            PropertyNamingPolicy = CosmosPropertyNamingPolicy.CamelCase
        },
    };
    this._client = new CosmosClient(connectionString, options);
    this.Container = this._client.GetContainer(database, container);
}

// AFTER:
public CosmosDbContext(string connectionString, string database, string container)
{
    var options = CosmosDbExtensions.GetOptimizedCosmosClientOptions();
    this._client = new CosmosClient(connectionString, options);
    this.Container = this._client.GetContainer(database, container);
}
```

---

#### 4. Add SignalR Scale-Out with Azure SignalR Service

**Install NuGet Package:**
```bash
cd webapi
dotnet add package Microsoft.Azure.SignalR --version 1.25.0
```

**Update `webapi/Program.cs` (around line 49):**
```csharp
// BEFORE:
builder.Services.AddSignalR();

// AFTER:
var signalRConnectionString = builder.Configuration["Azure:SignalR:ConnectionString"];
if (!string.IsNullOrEmpty(signalRConnectionString))
{
    builder.Services.AddSignalR()
        .AddAzureSignalR(options =>
        {
            options.ConnectionString = signalRConnectionString;
            options.ServerStickyMode = Microsoft.Azure.SignalR.ServerStickyMode.Required;
        });
}
else
{
    // Fallback for local development
    builder.Services.AddSignalR();
}
```

**Set in Azure App Service:**
```bash
az webapp config appsettings set \
  --settings Azure__SignalR__ConnectionString="<signalr-service-connection-string>"
```

---

#### 5. Configure Kestrel Limits

**Update `appsettings.json` Kestrel section:**
```json
{
  "Kestrel": {
    "Limits": {
      "MaxConcurrentConnections": 100,
      "MaxConcurrentUpgradedConnections": 100,
      "MaxRequestBodySize": 10485760,
      "RequestHeadersTimeout": "00:00:30",
      "KeepAliveTimeout": "00:02:00"
    },
    "Endpoints": {
      "Http": {
        "Url": "http://0.0.0.0:8080"
      }
    }
  }
}
```

---

### HIGH PRIORITY FIXES (Deploy within days)

#### 6. Add HttpClient Timeout Configuration

**Update `webapi/Program.cs` (around line 62):**
```csharp
// BEFORE:
builder.Services.AddHttpClient();

// AFTER:
builder.Services.AddHttpClient()
    .ConfigureHttpClientDefaults(http =>
    {
        http.ConfigureHttpClient(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(100);
        });
        http.AddStandardResilienceHandler(options =>
        {
            options.TotalRequestTimeout = new()
            {
                Timeout = TimeSpan.FromSeconds(120)
            };
            options.AttemptTimeout = new()
            {
                Timeout = TimeSpan.FromSeconds(30)
            };
            options.CircuitBreaker = new()
            {
                SamplingDuration = TimeSpan.FromSeconds(10),
                FailureRatio = 0.2,
                MinimumThroughput = 3
            };
        });
    });
```

**Install required package:**
```bash
dotnet add package Microsoft.Extensions.Http.Resilience --version 8.0.0
```

---

#### 7. Add Request Throttling

**Create new file: `webapi/Middleware/ThrottlingMiddleware.cs`**
```csharp
using System.Threading.RateLimiting;

namespace CopilotChat.WebApi.Middleware;

public static class ThrottlingExtensions
{
    public static IServiceCollection AddRequestThrottling(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                // Get user ID from claims or use IP address
                var userId = context.User?.Identity?.Name ?? context.Connection.RemoteIpAddress?.ToString() ?? "anonymous";
                
                return RateLimitPartition.GetTokenBucketLimiter(userId, _ => new TokenBucketRateLimiterOptions
                {
                    TokenLimit = 10,
                    ReplenishmentPeriod = TimeSpan.FromSeconds(10),
                    TokensPerPeriod = 5,
                    AutoReplenishment = true
                });
            });
            
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        });
        
        return services;
    }
}
```

**Update `webapi/Program.cs`:**
```csharp
// Add after line 74 (after AddHealthChecks):
builder.Services.AddRequestThrottling();

// Add after line 83 (after UseAuthorization):
app.UseRateLimiter();
```

---

### MEDIUM PRIORITY (Deploy within weeks)

#### 8. Add Logging and Monitoring

**Update `appsettings.json`:**
```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.Azure.Cosmos": "Warning",
      "CopilotChat.WebApi": "Information"
    }
  }
}
```

**Ensure Application Insights is configured:**
```bash
az webapp config appsettings set \
  --settings APPLICATIONINSIGHTS_CONNECTION_STRING="<your-appinsights-connection-string>"
```

---

#### 9. Optimize Memory Pipeline

If using the memory pipeline, ensure it's also using Azure resources.

**Update `memorypipeline/appsettings.json` with the same Azure storage configurations.**

---

## Azure Resource Requirements

To support 10-20 concurrent users, you need:

### Required Azure Resources:

1. **Azure Cosmos DB**
   - Tier: Standard
   - Throughput: Start with 400 RU/s per container, scale to 1000 RU/s if needed
   - Cost: ~$24/month per container at 400 RU/s

2. **Azure Storage Account**
   - Tier: Standard (LRS or GRS)
   - For: Blob storage, Queue storage
   - Cost: ~$20-30/month

3. **Azure AI Search** (formerly Cognitive Search)
   - Tier: Basic or Standard S1
   - Cost: ~$75-250/month

4. **Azure SignalR Service**
   - Tier: Standard (supports 1000 concurrent connections)
   - Cost: ~$50/month

5. **Azure App Service**
   - Tier: At least P1V2 (Premium V2)
   - Reason: Need always-on, multiple instances, better CPU/RAM
   - Scale: 2-3 instances for redundancy
   - Cost: ~$146/month per instance

6. **Azure OpenAI**
   - Already configured
   - Monitor: Tokens per minute (TPM) quota
   - Recommended: Request quota increase if seeing 429 errors

### Total Estimated Monthly Cost:
- **Minimum**: ~$400-500/month
- **Recommended for 20 users**: ~$600-800/month

---

## Deployment Checklist

### Pre-Deployment:
- [ ] Create Azure Cosmos DB with correct containers and partition keys
- [ ] Create Azure Storage Account
- [ ] Create Azure AI Search service
- [ ] Create Azure SignalR Service (optional but recommended)
- [ ] Scale App Service to P1V2 or higher

### Configuration:
- [ ] Update `appsettings.json` with production settings
- [ ] Set all connection strings in Azure App Service Configuration (not in appsettings.json)
- [ ] Enable Application Insights
- [ ] Configure CORS for production domain
- [ ] Set `AllowedOrigins` to production URLs

### Post-Deployment:
- [ ] Monitor Application Insights for errors
- [ ] Monitor Cosmos DB RU consumption
- [ ] Monitor Azure OpenAI token usage
- [ ] Test with 5-10 concurrent users
- [ ] Gradually increase load

---

## Testing Concurrent Load

### Load Testing Tools:
1. **Azure Load Testing** (recommended)
2. **Apache JMeter**
3. **k6**

### Test Scenario:
```bash
# Example k6 test script
# test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 },  // Ramp up to 10 users
    { duration: '5m', target: 10 },  // Stay at 10 users
    { duration: '2m', target: 20 },  // Ramp up to 20 users
    { duration: '5m', target: 20 },  // Stay at 20 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
};

export default function () {
  let response = http.get('https://your-app.azurewebsites.net/healthz');
  check(response, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
```

---

## Monitoring and Alerts

### Key Metrics to Monitor:

1. **Application Insights**:
   - Response time (should be < 3s)
   - Failed requests (should be < 1%)
   - Exceptions
   - Dependency failures (Cosmos, OpenAI)

2. **Cosmos DB**:
   - RU consumption
   - Throttled requests (429 errors)
   - Latency

3. **App Service**:
   - CPU usage (should be < 70%)
   - Memory usage (should be < 80%)
   - HTTP queue length
   - Response time

4. **Azure OpenAI**:
   - Token usage
   - Rate limit errors (429)
   - Latency

### Recommended Alerts:
- Response time > 5 seconds
- Error rate > 5%
- CPU usage > 80%
- Memory usage > 85%
- Cosmos DB throttling > 5% of requests

---

## Quick Win Summary

**If you can only do ONE thing right now:**
Change ChatStore type from `"volatile"` to `"cosmos"` and configure the Cosmos DB connection string.

**If you can do TWO things:**
1. Enable Cosmos DB (above)
2. Change KernelMemory storage from file-based to Azure Blob Storage + Azure AI Search

**If you can do THREE things:**
1. Enable Cosmos DB
2. Fix KernelMemory storage
3. Configure Cosmos DB connection pooling (CosmosDbExtensions)

These three changes will fix 80% of your concurrency issues.

---

## Support and Further Reading

- [Azure Cosmos DB Best Practices](https://learn.microsoft.com/azure/cosmos-db/performance-tips)
- [ASP.NET Core Performance Best Practices](https://learn.microsoft.com/aspnet/core/performance/performance-best-practices)
- [Azure App Service Scaling](https://learn.microsoft.com/azure/app-service/manage-scale-up)
- [SignalR Scale-Out](https://learn.microsoft.com/aspnet/core/signalr/scale)

---

## Questions to Answer

1. **What is your current Azure App Service tier?** (Check: Free, Basic, Standard, Premium)
2. **Is Cosmos DB already created?** If yes, what are the RU/s settings per container?
3. **Do you have Azure AI Search?** If yes, what tier?
4. **How many App Service instances are running?** (Check scale-out settings)
5. **What is your Azure OpenAI quota?** (TPM - Tokens Per Minute)

Please provide answers to these questions so I can give more specific guidance.

