# Add Enhanced Backend SignalR Logging
# This helps identify exactly where SignalR message delivery fails

param(
    [string]$ResourceGroup = "rg-sk-copilot-npi",
    [string]$WebApiName = "app-copichat-4kt5uxo2hrzri-webapi"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Enable Backend SignalR Debug Logging" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Please log in to Azure first: az login" -ForegroundColor Red
    exit 1
}

Write-Host "`n[1/2] Enabling detailed logging..." -ForegroundColor Yellow

# Enable detailed logging for SignalR and the app
az webapp config appsettings set `
    --name $WebApiName `
    --resource-group $ResourceGroup `
    --settings `
        "Logging:LogLevel:Default=Information" `
        "Logging:LogLevel:Microsoft.AspNetCore.SignalR=Debug" `
        "Logging:LogLevel:Microsoft.AspNetCore.Http.Connections=Debug" `
        "Logging:LogLevel:CopilotChat=Debug"

Write-Host "  ✓ Logging levels configured" -ForegroundColor Green

Write-Host "`n[2/2] Restarting app..." -ForegroundColor Yellow

az webapp restart --name $WebApiName --resource-group $ResourceGroup

Write-Host "  ✓ App restarted" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Logging Enabled!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nWhat was enabled:" -ForegroundColor Yellow
Write-Host "  ✓ SignalR debug logging" -ForegroundColor Green
Write-Host "  ✓ HTTP connections logging" -ForegroundColor Green
Write-Host "  ✓ Application debug logging" -ForegroundColor Green

Write-Host "`nNow do this:" -ForegroundColor Yellow
Write-Host "`n1. Reproduce the issue:" -ForegroundColor White
Write-Host "   - Ask Mimir a question" -ForegroundColor Gray
Write-Host "   - Wait for 'spinning' to happen" -ForegroundColor Gray
Write-Host "   - Note the exact time" -ForegroundColor Gray

Write-Host "`n2. Check Application Insights logs:" -ForegroundColor White

$query = @"
traces
| where timestamp > ago(30m)
| where message contains "messageRelayHub" 
    or message contains "SendAsync"
    or message contains "Clients.Group"
    or message contains "SignalR"
| extend 
    chatId = extract("chatId['\"]?:\\s*['\"]?([^'\"\\s,}]+)", 1, message),
    operation = case(
        message contains "SendAsync", "Sending",
        message contains "Clients.Group", "Targeting Group",
        message contains "Connected", "Connection",
        "Other"
    )
| project 
    timestamp,
    operation,
    chatId,
    severityLevel,
    message
| order by timestamp asc
"@

$query | Out-File -FilePath "signalr-detailed-trace.kql" -Encoding UTF8

Write-Host "   Run this query in Application Insights:" -ForegroundColor Cyan
Write-Host "   File: signalr-detailed-trace.kql" -ForegroundColor Gray
Write-Host "`n   Expected to see:" -ForegroundColor Gray
Write-Host "   - 'Targeting Group: <chatId>'" -ForegroundColor Gray
Write-Host "   - 'SendAsync: ReceiveMessage'" -ForegroundColor Gray  
Write-Host "   - 'SendAsync: ReceiveBotResponseStatus'" -ForegroundColor Gray

Write-Host "`n3. Compare with frontend browser console:" -ForegroundColor White
Write-Host "   Backend says: 'SendAsync: ReceiveMessage'" -ForegroundColor Gray
Write-Host "   Frontend should show: '📨 SignalR ReceiveMessage'" -ForegroundColor Gray
Write-Host "   " -ForegroundColor Gray
Write-Host "   If backend sends but frontend doesn't receive:" -ForegroundColor Yellow
Write-Host "   → ChatId mismatch or SignalR connection issue" -ForegroundColor Yellow

Write-Host "`n4. Check if chatId matches:" -ForegroundColor White

$chatIdQuery = @"
// Backend: What chatId is being used?
traces
| where timestamp > ago(30m)
| where message contains "Chat" and message contains "request"
| extend chatId = extract("chatId['\"]?:\\s*['\"]?([^'\"\\s,}]+)", 1, message)
| project timestamp, chatId, message
| order by timestamp desc
| take 10

// Compare with SignalR send
traces  
| where timestamp > ago(30m)
| where message contains "SendAsync" and message contains "Clients.Group"
| extend chatId = extract("Group\\(\\\"([^\\\"]+)", 1, message)
| project timestamp, chatId, message
| order by timestamp desc
| take 10
"@

$chatIdQuery | Out-File -FilePath "check-chatid-mismatch.kql" -Encoding UTF8

Write-Host "   Run: check-chatid-mismatch.kql" -ForegroundColor Cyan
Write-Host "   ChatIds should match between request and SendAsync" -ForegroundColor Gray

Write-Host "`nCommon issues to look for:" -ForegroundColor Yellow
Write-Host "`n❌ Backend NOT calling SendAsync at all" -ForegroundColor White
Write-Host "   Cause: Exception before SendAsync, or wrong code path" -ForegroundColor Gray
Write-Host "   Fix: Check for exceptions, ensure all paths call SendAsync" -ForegroundColor Gray

Write-Host "`n❌ SendAsync called with wrong chatId" -ForegroundColor White
Write-Host "   Cause: ChatId mismatch between request and SignalR group" -ForegroundColor Gray
Write-Host "   Fix: Ensure chatId is consistent throughout request" -ForegroundColor Gray

Write-Host "`n❌ SendAsync called but throws exception" -ForegroundColor White
Write-Host "   Cause: SignalR hub context null, or connection issue" -ForegroundColor Gray
Write-Host "   Fix: Verify IHubContext<MessageRelayHub> is injected" -ForegroundColor Gray

Write-Host "`n❌ Message sent to SignalR but not reaching frontend" -ForegroundColor White
Write-Host "   Cause: Frontend not in correct SignalR group" -ForegroundColor Gray
Write-Host "   Fix: Ensure frontend joins group when opening chat" -ForegroundColor Gray

Write-Host "`nFiles created:" -ForegroundColor White
Write-Host "  - signalr-detailed-trace.kql" -ForegroundColor Gray
Write-Host "  - check-chatid-mismatch.kql" -ForegroundColor Gray

Write-Host "`n⚠ Remember: After debugging, disable debug logging for performance:" -ForegroundColor Yellow
Write-Host "   az webapp config appsettings set \\" -ForegroundColor Cyan
Write-Host "     --name $WebApiName \\" -ForegroundColor Cyan
Write-Host "     --resource-group $ResourceGroup \\" -ForegroundColor Cyan
Write-Host "     --settings \\" -ForegroundColor Cyan
Write-Host "       'Logging:LogLevel:Microsoft.AspNetCore.SignalR=Warning'" -ForegroundColor Cyan

Write-Host "`nDone! Reproduce the issue and check the logs." -ForegroundColor Green

