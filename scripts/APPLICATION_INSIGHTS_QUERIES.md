# Application Insights KQL Queries for Mimir

## 🔴 FastModel / Azure OpenAI Errors

### 1. Recent ClientResultException Errors
```kql
exceptions
| where timestamp > ago(1h)
| where type == "System.ClientModel.ClientResultException"
| project timestamp, operation_Name, message, outerMessage, innermostMessage, problemId
| order by timestamp desc
| take 50
```

### 2. All Errors in Last Hour (Grouped)
```kql
exceptions
| where timestamp > ago(1h)
| summarize 
    Count = count(),
    FirstOccurrence = min(timestamp),
    LastOccurrence = max(timestamp),
    SampleMessage = any(outerMessage)
    by type, operation_Name
| order by Count desc
```

### 3. FastModel Configuration Errors
```kql
exceptions
| where timestamp > ago(2h)
| where outerMessage contains "FastModel" 
    or outerMessage contains "gpt-4o-mini"
    or outerMessage contains "Deployment"
| project timestamp, operation_Name, type, outerMessage, innermostMessage, customDimensions
| order by timestamp desc
```

### 4. Azure OpenAI Connection Failures
```kql
exceptions
| where timestamp > ago(1h)
| where outerMessage contains "openai.azure.com" 
    or outerMessage contains "AzureOpenAI"
    or type contains "ClientResult"
| project 
    timestamp, 
    operation_Name,
    type,
    message = coalesce(outerMessage, message),
    innerException = innermostMessage,
    details = customDimensions
| order by timestamp desc
| take 100
```

### 5. Full Exception Details with Stack Trace
```kql
exceptions
| where timestamp > ago(30m)
| where type == "System.ClientModel.ClientResultException"
| project 
    timestamp,
    operation_Name,
    operation_Id,
    type,
    outerMessage,
    innermostMessage,
    details,
    assembly,
    method,
    problemId
| order by timestamp desc
| take 20
```

---

## 🔍 Dependency Call Analysis

### 6. Azure OpenAI Dependency Calls (Success/Failure)
```kql
dependencies
| where timestamp > ago(1h)
| where target contains "openai.azure.com" or name contains "OpenAI"
| summarize 
    TotalCalls = count(),
    SuccessCount = countif(success == true),
    FailureCount = countif(success == false),
    AvgDuration = avg(duration),
    SampleData = any(data)
    by name, resultCode
| extend SuccessRate = round((SuccessCount * 100.0) / TotalCalls, 2)
| order by FailureCount desc
```

### 7. Failed Azure OpenAI Calls with Details
```kql
dependencies
| where timestamp > ago(1h)
| where target contains "openai.azure.com"
| where success == false
| project 
    timestamp,
    name,
    target,
    resultCode,
    duration,
    data,
    operation_Name,
    operation_Id
| order by timestamp desc
| take 50
```

### 8. Model Router vs gpt-4o-mini Calls
```kql
dependencies
| where timestamp > ago(1h)
| where target contains "openai.azure.com"
| extend Deployment = extract(@"deployments/([^/]+)", 1, data)
| summarize 
    Count = count(),
    SuccessCount = countif(success == true),
    FailureCount = countif(success == false),
    AvgDuration = avg(duration)
    by Deployment, resultCode
| order by Count desc
```

---

## 📊 Request Analysis

### 9. Failed Chat Requests (500 errors)
```kql
requests
| where timestamp > ago(1h)
| where resultCode == "500"
| where url contains "Chat"
| project 
    timestamp,
    name,
    url,
    resultCode,
    duration,
    operation_Id,
    customDimensions
| order by timestamp desc
| take 50
```

### 10. Timeline of Errors (Last Hour)
```kql
exceptions
| where timestamp > ago(1h)
| summarize Count = count() by bin(timestamp, 5m), type
| render timechart
```

---

## 🔧 Configuration Debugging

### 11. Trace Logs for FastModel
```kql
traces
| where timestamp > ago(30m)
| where message contains "FastModel" 
    or message contains "gpt-4o-mini"
    or message contains "Using fast model"
| project timestamp, severityLevel, message, customDimensions
| order by timestamp desc
```

### 12. All Logs Related to Model Selection
```kql
traces
| where timestamp > ago(30m)
| where message contains "model" or message contains "deployment"
| where message !contains "ClientModel" // Exclude the exception type name
| project timestamp, severityLevel, message
| order by timestamp desc
| take 100
```

### 13. Correlation: Find All Events for Failed Request
```kql
// First, get a failed operation_Id
let failedOperationId = toscalar(
    requests
    | where timestamp > ago(1h)
    | where resultCode == "500"
    | top 1 by timestamp desc
    | project operation_Id
);
// Then get all related events
union requests, dependencies, exceptions, traces
| where operation_Id == failedOperationId
| project timestamp, itemType, name, message = coalesce(message, outerMessage), success, resultCode, duration
| order by timestamp asc
```

---

## 🎯 Specific to Your Current Issue

### 14. Recent 500 Errors with Full Context
```kql
requests
| where timestamp > ago(1h)
| where resultCode == "500"
| join kind=leftouter (
    exceptions
    | where timestamp > ago(1h)
) on operation_Id
| project 
    timestamp,
    RequestName = name,
    URL = url,
    ExceptionType = type,
    ExceptionMessage = outerMessage,
    InnerException = innermostMessage,
    operation_Id
| order by timestamp desc
| take 20
```

### 15. Check if FastModel Setting is Being Used
```kql
traces
| where timestamp > ago(30m)
| where message contains "FastModel" 
    or message contains "Enabled"
    or message contains "extraction"
| project timestamp, message, customDimensions
| order by timestamp desc
```

### 16. Azure OpenAI Authentication Failures
```kql
exceptions
| where timestamp > ago(1h)
| where outerMessage contains "authentication" 
    or outerMessage contains "unauthorized"
    or outerMessage contains "401"
    or outerMessage contains "403"
    or outerMessage contains "APIKey"
| project timestamp, type, outerMessage, innermostMessage
| order by timestamp desc
```

---

## 📈 Performance Queries

### 17. Slowest Operations
```kql
requests
| where timestamp > ago(1h)
| where name contains "Chat"
| summarize 
    Count = count(),
    AvgDuration = avg(duration),
    P50 = percentile(duration, 50),
    P95 = percentile(duration, 95),
    P99 = percentile(duration, 99),
    MaxDuration = max(duration)
    by name
| order by P95 desc
```

### 18. Dependency Chain Analysis
```kql
requests
| where timestamp > ago(30m)
| where resultCode == "500"
| take 1
| project operation_Id
| join kind=inner (
    dependencies
    | where timestamp > ago(30m)
) on operation_Id
| project timestamp, dependencyName = name, target, duration, success, resultCode, data
| order by timestamp asc
```

---

## 🚨 Real-time Monitoring

### 19. Live Error Stream (Run with Live)
```kql
exceptions
| where timestamp > ago(5m)
| project timestamp, type, outerMessage, operation_Name
| order by timestamp desc
```

### 20. Error Rate Over Time
```kql
requests
| where timestamp > ago(24h)
| summarize 
    Total = count(),
    Failed = countif(resultCode startswith "5"),
    ErrorRate = round((countif(resultCode startswith "5") * 100.0) / count(), 2)
    by bin(timestamp, 10m)
| render timechart
```

---

## 💡 How to Use These Queries

1. **Start with Query #1** to see the most recent errors
2. **Use Query #4** to see Azure OpenAI specific failures
3. **Run Query #6** to check if calls are reaching Azure OpenAI at all
4. **Use Query #13** to trace a complete failed request from start to finish
5. **Check Query #15** to verify if FastModel is being initialized

## 🔍 What to Look For

### If you see "401" or "403":
- API Key is wrong or missing
- Check: `KernelMemory__Services__AzureOpenAIText__APIKey`

### If you see "404":
- Deployment name doesn't exist
- Check: Deployment is `gpt-4o-mini` or `model-router`

### If you see "InvalidRequest" or "DeploymentNotFound":
- The deployment name in settings doesn't match what's in Azure
- Verify deployments exist in Azure OpenAI Studio

### If you see no dependency calls at all:
- Configuration is completely missing
- Endpoint is not set

---

Last updated: December 2024

