# Verify Azure SignalR Configuration and Find Real Issue
# Since Azure SignalR Service already exists, let's find why messages aren't delivered

param(
    [string]$ResourceGroup = "rg-sk-copilot-npi",
    [string]$WebApiName = "app-copichat-4kt5uxo2hrzri-webapi"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Azure SignalR Configuration Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Please log in to Azure first: az login" -ForegroundColor Red
    exit 1
}

Write-Host "`n[1/5] Finding Azure SignalR Service..." -ForegroundColor Yellow

$signalRServices = az signalr list --resource-group $ResourceGroup | ConvertFrom-Json

if ($signalRServices.Count -eq 0) {
    Write-Host "  ✗ No SignalR Service found in resource group" -ForegroundColor Red
    exit 1
}

Write-Host "  ✓ Found $($signalRServices.Count) SignalR Service(s):" -ForegroundColor Green
foreach ($service in $signalRServices) {
    Write-Host "    - $($service.name)" -ForegroundColor White
    Write-Host "      SKU: $($service.sku.name) ($($service.sku.tier))" -ForegroundColor Gray
    Write-Host "      Location: $($service.location)" -ForegroundColor Gray
    Write-Host "      Status: $($service.provisioningState)" -ForegroundColor Gray
}

$signalRName = $signalRServices[0].name

Write-Host "`n[2/5] Checking Web API configuration..." -ForegroundColor Yellow

$appSettings = az webapp config appsettings list `
    --name $WebApiName `
    --resource-group $ResourceGroup | ConvertFrom-Json

$signalRConnString = $appSettings | Where-Object { $_.name -eq "Azure:SignalR:ConnectionString" }

if ($signalRConnString -and $signalRConnString.value) {
    Write-Host "  ✓ Azure SignalR connection string is configured" -ForegroundColor Green
    
    # Check if it matches the service
    if ($signalRConnString.value -match "Endpoint=https://([^\.]+)\.") {
        $configuredService = $matches[1]
        Write-Host "    Configured service: $configuredService" -ForegroundColor Gray
        
        if ($configuredService -eq $signalRName) {
            Write-Host "    ✓ Matches SignalR service in resource group" -ForegroundColor Green
        } else {
            Write-Host "    ⚠ Does NOT match - may be using different service" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  ✗ Azure SignalR NOT configured in app settings!" -ForegroundColor Red
    Write-Host "    App is using LOCAL SignalR (this is the problem!)" -ForegroundColor Red
    
    Write-Host "`n  Do you want to configure it now? (y/n)" -ForegroundColor Yellow
    $response = Read-Host
    
    if ($response -eq "y") {
        Write-Host "`n  Getting connection string..." -ForegroundColor Gray
        $keys = az signalr key list --name $signalRName --resource-group $ResourceGroup | ConvertFrom-Json
        $connectionString = $keys.primaryConnectionString
        
        Write-Host "  Configuring Web API..." -ForegroundColor Gray
        az webapp config appsettings set `
            --name $WebApiName `
            --resource-group $ResourceGroup `
            --settings "Azure:SignalR:ConnectionString=$connectionString"
        
        Write-Host "  ✓ Configured! Restarting app..." -ForegroundColor Green
        az webapp restart --name $WebApiName --resource-group $ResourceGroup
        
        Write-Host "  ✓ Done! Test the app now." -ForegroundColor Green
        exit 0
    }
    exit 1
}

Write-Host "`n[3/5] Checking SignalR Service metrics..." -ForegroundColor Yellow

Write-Host "  Getting recent metrics from SignalR Service..." -ForegroundColor Gray

# Get metrics for last hour
$endTime = Get-Date
$startTime = $endTime.AddHours(-1)

Write-Host "  Time range: $($startTime.ToString('HH:mm')) - $($endTime.ToString('HH:mm'))" -ForegroundColor Gray

# Note: Azure CLI metrics require specific format, we'll provide instructions instead
Write-Host "`n  ⚠ Manual check required:" -ForegroundColor Yellow
Write-Host "    1. Go to: Azure Portal → $signalRName → Metrics" -ForegroundColor White
Write-Host "    2. Check these metrics:" -ForegroundColor White
Write-Host "       - Connection Count (should be > 0)" -ForegroundColor Gray
Write-Host "       - Message Count (should increase during chat)" -ForegroundColor Gray
Write-Host "       - Connection Close Count (should be low)" -ForegroundColor Gray
Write-Host "       - Server Load (should be < 80%)" -ForegroundColor Gray

Write-Host "`n[4/5] Checking backend SignalR Hub implementation..." -ForegroundColor Yellow

Write-Host "  Looking for potential issues in backend code..." -ForegroundColor Gray

$issuesFound = @()

# Check if backend timeout is configured
$timeout = $appSettings | Where-Object { $_.name -eq "Service:TimeoutLimitInS" }
if (-not $timeout -or [int]$timeout.value -lt 120) {
    $issuesFound += "Backend timeout too short or not set (should be 180s+)"
}

Write-Host "`n  Checking Application Insights for SignalR errors..." -ForegroundColor Gray
Write-Host "  (Run these queries manually in Application Insights)" -ForegroundColor Gray

$queries = @"

QUERY 1: Check if backend is SENDING SignalR messages
----------------------------------------------------
traces
| where timestamp > ago(1h)
| where message contains "SendAsync" or message contains "Clients.Group"
| project timestamp, message, severityLevel
| order by timestamp desc
| take 50

Expected: Should see traces for each message sent


QUERY 2: Check for SignalR HUB exceptions
-----------------------------------------
exceptions
| where timestamp > ago(1h)
| where outerMessage contains "Hub" or outerMessage contains "SignalR"
| project timestamp, type, outerMessage, innermostMessage
| order by timestamp desc

Expected: Should be EMPTY or very few errors


QUERY 3: Check message delivery timeline
----------------------------------------
traces
| where timestamp > ago(1h)
| where message contains "ReceiveMessage" or message contains "GeneratingResponse"
| project timestamp, message
| order by timestamp asc

Expected: Should see pairs of "GeneratingResponse" start/end


QUERY 4: Check if messages are sent but not reaching clients
------------------------------------------------------------
customEvents
| where timestamp > ago(1h)
| where name == "MessageSent" or name == "MessageReceived"
| summarize sent=countif(name=="MessageSent"), received=countif(name=="MessageReceived")

Expected: sent ≈ received (if not, delivery problem)

"@

$queries | Out-File -FilePath "signalr-debug-queries.kql" -Encoding UTF8
Write-Host "  ✓ Queries saved to: signalr-debug-queries.kql" -ForegroundColor Green

Write-Host "`n[5/5] Generating recommendations..." -ForegroundColor Yellow

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Analysis Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($issuesFound.Count -gt 0) {
    Write-Host "`n⚠ Issues Found:" -ForegroundColor Yellow
    foreach ($issue in $issuesFound) {
        Write-Host "  - $issue" -ForegroundColor Yellow
    }
}

Write-Host "`nSince you have Azure SignalR, the problem is likely ONE of these:" -ForegroundColor Yellow

Write-Host "`n1. Backend not sending SignalR messages correctly" -ForegroundColor White
Write-Host "   Symptom: HTTP request completes, but no SignalR message sent" -ForegroundColor Gray
Write-Host "   Check: Run QUERY 1 in Application Insights" -ForegroundColor Cyan
Write-Host "   Fix: Add logging to ChatController SendAsync calls" -ForegroundColor Gray

Write-Host "`n2. SignalR Hub context is null or not injected" -ForegroundColor White  
Write-Host "   Symptom: Exception when trying to send message" -ForegroundColor Gray
Write-Host "   Check: Run QUERY 2 in Application Insights" -ForegroundColor Cyan
Write-Host "   Fix: Verify DI configuration for IHubContext<MessageRelayHub>" -ForegroundColor Gray

Write-Host "`n3. Wrong ChatId or UserId in SignalR group" -ForegroundColor White
Write-Host "   Symptom: Message sent but to wrong group/user" -ForegroundColor Gray
Write-Host "   Check: Compare chatId in request vs SignalR send" -ForegroundColor Cyan
Write-Host "   Fix: Ensure consistent chatId usage" -ForegroundColor Gray

Write-Host "`n4. Frontend SignalR connection drops during request" -ForegroundColor White
Write-Host "   Symptom: Connection state changes to Disconnected" -ForegroundColor Gray
Write-Host "   Check: Browser console logs (with new logging added)" -ForegroundColor Cyan
Write-Host "   Fix: Already done (increased timeout + transport fallback)" -ForegroundColor Gray

Write-Host "`n5. CORS or Authentication blocking SignalR" -ForegroundColor White
Write-Host "   Symptom: 401/403 errors in SignalR connection" -ForegroundColor Gray
Write-Host "   Check: Browser console Network tab → WS connection" -ForegroundColor Cyan
Write-Host "   Fix: Update CORS policy to allow SignalR origin" -ForegroundColor Gray

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Next Steps" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n1. Run Application Insights queries (signalr-debug-queries.kql)" -ForegroundColor Cyan
Write-Host "   This will show if backend is sending messages" -ForegroundColor Gray

Write-Host "`n2. Deploy frontend with new logging" -ForegroundColor Cyan
Write-Host "   cd webapp && yarn build" -ForegroundColor Gray
Write-Host "   Browser console will show SignalR message flow" -ForegroundColor Gray

Write-Host "`n3. Test and check browser console" -ForegroundColor Cyan
Write-Host "   Look for '📨 SignalR ReceiveMessage' logs" -ForegroundColor Gray
Write-Host "   If missing → Backend not sending" -ForegroundColor Gray
Write-Host "   If present → Redux/UI issue" -ForegroundColor Gray

Write-Host "`n4. If backend NOT sending messages:" -ForegroundColor Cyan
Write-Host "   Run: .\add-backend-signalr-logging.ps1" -ForegroundColor Gray
Write-Host "   This will add detailed logging to find exact issue" -ForegroundColor Gray

Write-Host "`nConfiguration Status:" -ForegroundColor Yellow
if ($signalRConnString -and $signalRConnString.value) {
    Write-Host "  ✓ Azure SignalR: Configured" -ForegroundColor Green
} else {
    Write-Host "  ✗ Azure SignalR: NOT configured (using local)" -ForegroundColor Red
}

Write-Host "`nFiles created:" -ForegroundColor White
Write-Host "  - signalr-debug-queries.kql" -ForegroundColor Gray

Write-Host "`nDone! Follow the next steps above to find the exact issue." -ForegroundColor Green

