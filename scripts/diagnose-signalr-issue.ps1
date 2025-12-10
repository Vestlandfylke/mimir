# Diagnose SignalR and Performance Issues
# This script helps identify bottlenecks in the chat response flow

param(
    [string]$ResourceGroup = "rg-sk-copilot-npi",
    [string]$WebApiName = "app-copichat-4kt5uxo2hrzri-webapi",
    [int]$TimeWindowMinutes = 60
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Mimir Performance Diagnostics" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if logged in
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Please log in to Azure first: az login" -ForegroundColor Red
    exit 1
}

Write-Host "`nAnalyzing last $TimeWindowMinutes minutes..." -ForegroundColor Yellow

# Get Application Insights workspace
$appInsightsName = "appins-copichat-4kt5uxo2hrzri"

Write-Host "`n[1/6] Checking slow API requests..." -ForegroundColor Yellow

$slowRequestsQuery = @"
requests
| where timestamp > ago($($TimeWindowMinutes)m)
| where name contains "Chat"
| where duration > 10000
| project timestamp, name, duration, resultCode, success
| order by duration desc
| take 20
"@

Write-Host "  Running query in Application Insights..." -ForegroundColor Gray
Write-Host "  (Check portal manually if this fails)" -ForegroundColor Gray

# Write query to file for manual execution
$slowRequestsQuery | Out-File -FilePath "slow-requests-query.kql" -Encoding UTF8
Write-Host "  Query saved to: slow-requests-query.kql" -ForegroundColor Green

Write-Host "`n[2/6] Checking SignalR connection issues..." -ForegroundColor Yellow

$signalrQuery = @"
traces
| where timestamp > ago($($TimeWindowMinutes)m)
| where message contains "SignalR" or message contains "messageRelayHub"
| project timestamp, message, severityLevel
| order by timestamp desc
| take 50
"@

$signalrQuery | Out-File -FilePath "signalr-issues-query.kql" -Encoding UTF8
Write-Host "  Query saved to: signalr-issues-query.kql" -ForegroundColor Green

Write-Host "`n[3/6] Checking for timeout errors..." -ForegroundColor Yellow

$timeoutQuery = @"
exceptions
| where timestamp > ago($($TimeWindowMinutes)m)
| where outerMessage contains "timeout" or outerMessage contains "Timeout"
| project timestamp, type, outerMessage, operation_Name
| order by timestamp desc
| take 20
"@

$timeoutQuery | Out-File -FilePath "timeout-errors-query.kql" -Encoding UTF8
Write-Host "  Query saved to: timeout-errors-query.kql" -ForegroundColor Green

Write-Host "`n[4/6] Checking current App Service configuration..." -ForegroundColor Yellow

$appSettings = az webapp config appsettings list `
    --name $WebApiName `
    --resource-group $ResourceGroup | ConvertFrom-Json

# Check critical settings
$criticalSettings = @(
    "Service:TimeoutLimitInS",
    "Azure:SignalR:ConnectionString",
    "WEBSITE_ADD_SITENAME_BINDINGS_IN_APPHOST_CONFIG"
)

Write-Host "`n  Critical Settings:" -ForegroundColor White
foreach ($settingName in $criticalSettings) {
    $setting = $appSettings | Where-Object { $_.name -eq $settingName }
    if ($setting) {
        if ($settingName -eq "Azure:SignalR:ConnectionString") {
            if ($setting.value) {
                Write-Host "    ✓ $settingName: Configured" -ForegroundColor Green
            } else {
                Write-Host "    ✗ $settingName: Not configured" -ForegroundColor Red
            }
        } else {
            Write-Host "    ✓ $settingName: $($setting.value)" -ForegroundColor Green
        }
    } else {
        Write-Host "    ✗ $settingName: NOT SET" -ForegroundColor Red
    }
}

Write-Host "`n[5/6] Checking App Service Plan (CPU/Memory)..." -ForegroundColor Yellow

$webApp = az webapp show --name $WebApiName --resource-group $ResourceGroup | ConvertFrom-Json
$appServicePlanId = $webApp.appServicePlanId
$planName = $appServicePlanId.Split('/')[-1]

$plan = az appservice plan show --name $planName --resource-group $ResourceGroup | ConvertFrom-Json

Write-Host "  Plan: $planName" -ForegroundColor White
Write-Host "    SKU: $($plan.sku.name) - $($plan.sku.tier)" -ForegroundColor Gray
Write-Host "    Capacity: $($plan.sku.capacity) instances" -ForegroundColor Gray

if ($plan.sku.name -like "B*" -or $plan.sku.name -like "F*") {
    Write-Host "    ⚠ Using Basic/Free tier - may cause performance issues" -ForegroundColor Yellow
    Write-Host "      Recommendation: Upgrade to S1 or higher for production" -ForegroundColor Yellow
}

Write-Host "`n[6/6] Checking WebSocket and Always On..." -ForegroundColor Yellow

$webConfig = az webapp config show --name $WebApiName --resource-group $ResourceGroup | ConvertFrom-Json

$checks = @{
    "Always On" = $webConfig.alwaysOn
    "Web Sockets" = $webConfig.webSocketsEnabled
    "HTTP 2.0" = $webConfig.http20Enabled
}

foreach ($check in $checks.GetEnumerator()) {
    if ($check.Value) {
        Write-Host "  ✓ $($check.Key): Enabled" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $($check.Key): Disabled" -ForegroundColor Red
    }
}

# Generate comprehensive report
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Diagnostic Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$report = @"

DIAGNOSTIC REPORT
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

ISSUE: Messages complete on backend but don't appear in chat (spinning forever)

ANALYSIS:
---------

1. HTTP Request Flow:
   - POST /api/chat/chat → Completes (34.38s in your case)
   - Backend generates response successfully
   - Response saved to database ✓
   
2. SignalR Flow (LIKELY ISSUE HERE):
   - Backend should send message via SignalR to frontend
   - Frontend should receive message and display
   - ❌ Message not reaching frontend
   - User must refresh to see message (loaded from DB)

POSSIBLE CAUSES:
---------------

A. SignalR Connection Dropped During Request
   - Long-running request (34s) may exceed connection timeout
   - Even with increased timeout, connection may be unstable
   - Solution: Azure SignalR Service (recommended)

B. Backend Not Sending SignalR Message
   - Exception in SignalR send logic
   - Check: Application Insights exceptions
   - Look for: "Failed to send message to group"

C. Message Sent But Not Received
   - Client connection in wrong state
   - Message routing issue (wrong connectionId/groupId)
   - Check: SignalR connection state during request

D. App Service Plan Limitations
   - Current SKU: $($plan.sku.name) - $($plan.sku.tier)
   - May have connection/throughput limits
   - Basic/Free tiers have strict limits

E. No Azure SignalR Service
   - Local SignalR has limitations with long-running connections
   - Sticky sessions may not be working properly
   - Multiple instances can cause routing issues

RECOMMENDATIONS (Priority Order):
---------------------------------

🔴 CRITICAL - Deploy Azure SignalR Service
   - Handles long-running connections better
   - More reliable message delivery
   - Auto-scaling and connection management
   - See: setup-azure-signalr.ps1

🟡 HIGH - Enable detailed SignalR logging
   - Add logging to see exact SignalR flow
   - Identify where messages are lost
   - See: enable-signalr-debug-logging.ps1

🟡 HIGH - Upgrade App Service Plan
   - Move from Basic to Standard (S1 or higher)
   - Better performance and reliability
   - More connection capacity

🟢 MEDIUM - Add retry logic in frontend
   - Automatically retry fetching message if SignalR fails
   - Fallback to polling if SignalR doesn't deliver
   - See: add-message-retry-logic.md

NEXT STEPS:
-----------

1. Check Application Insights queries:
   - slow-requests-query.kql
   - signalr-issues-query.kql  
   - timeout-errors-query.kql

2. Run: .\setup-azure-signalr.ps1
   - This will likely solve the issue

3. Enable debug logging:
   - See exact SignalR message flow
   - Identify where disconnect happens

4. Test after each change
"@

$report | Out-File -FilePath "diagnostic-report.txt" -Encoding UTF8

Write-Host $report

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Files Created" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  - diagnostic-report.txt (full report)" -ForegroundColor White
Write-Host "  - slow-requests-query.kql (run in App Insights)" -ForegroundColor White
Write-Host "  - signalr-issues-query.kql (run in App Insights)" -ForegroundColor White
Write-Host "  - timeout-errors-query.kql (run in App Insights)" -ForegroundColor White

Write-Host "`n🔴 MOST LIKELY FIX: Setup Azure SignalR Service" -ForegroundColor Red
Write-Host "   Run: .\setup-azure-signalr.ps1" -ForegroundColor Cyan

Write-Host "`nDone! Review diagnostic-report.txt for detailed analysis." -ForegroundColor Green

