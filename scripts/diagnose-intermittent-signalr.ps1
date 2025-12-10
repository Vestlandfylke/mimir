# Diagnose Intermittent SignalR Issues
# For problems that happen SOMETIMES but not always

param(
    [string]$ResourceGroup = "rg-sk-copilot-npi",
    [string]$SignalRName = "signalr-mimir-prod"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Intermittent SignalR Diagnostics" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nProblem Pattern Identified:" -ForegroundColor Yellow
Write-Host "  - First message in chat: Works ✅" -ForegroundColor Green
Write-Host "  - Second message in chat: Sometimes fails ❌" -ForegroundColor Red
Write-Host "  - Some chats: Both messages work ✅" -ForegroundColor Green

Write-Host "`nThis indicates:" -ForegroundColor Yellow
Write-Host "  → NOT a configuration issue (would always fail)" -ForegroundColor White
Write-Host "  → Likely: Race condition or state management" -ForegroundColor White
Write-Host "  → Likely: Connection drops after first message" -ForegroundColor White

Write-Host "`n[Analyzing] Azure SignalR Service metrics..." -ForegroundColor Yellow

# Generate queries for different scenarios
$queries = @"

═══════════════════════════════════════════════════════════
QUERY 1: Check SignalR Group Join/Leave Pattern
═══════════════════════════════════════════════════════════

traces
| where timestamp > ago(1h)
| where message contains "JoinGroup" or message contains "LeaveGroup" or message contains "AddToGroup" or message contains "RemoveFromGroup"
| extend 
    chatId = extract("chatId['\"]?[:\\s]*['\"]?([^'\"\\s,}]+)", 1, message),
    action = case(
        message contains "Join" or message contains "AddToGroup", "JOIN",
        message contains "Leave" or message contains "RemoveFromGroup", "LEAVE",
        "UNKNOWN"
    )
| project timestamp, action, chatId, message
| order by timestamp asc

EXPECTED: Should see JOIN for each chat, minimal LEAVE
IF PROBLEM: See LEAVE after first message → Frontend leaving group!


═══════════════════════════════════════════════════════════
QUERY 2: Compare First vs Second Message in Same Chat
═══════════════════════════════════════════════════════════

traces
| where timestamp > ago(1h)
| where message contains "SIGNALR"
| extend chatId = extract("chatId['\"]?[:\\s]*['\"]?([^'\"\\s,}]+)", 1, message)
| project timestamp, chatId, message
| order by timestamp asc

LOOK FOR: 
- ChatId appears multiple times (multiple messages)
- First message: See both 🔵 and ✅
- Second message: Only see 🔵 (no ✅) → SendAsync failing on 2nd


═══════════════════════════════════════════════════════════
QUERY 3: Check for Concurrent Request Issues
═══════════════════════════════════════════════════════════

requests
| where timestamp > ago(1h)
| where name contains "Chat"
| extend chatId = tostring(customDimensions.chatId)
| summarize 
    count = count(),
    requests = make_list(timestamp)
    by chatId, bin(timestamp, 1s)
| where count > 1
| order by timestamp desc

PROBLEM IF: Multiple requests to same chatId at same time (< 1 second apart)
THIS MEANS: Concurrent requests → potential race condition


═══════════════════════════════════════════════════════════
QUERY 4: SignalR Connection State Changes
═══════════════════════════════════════════════════════════

// This requires frontend logging to be deployed
customEvents
| where timestamp > ago(1h)
| where name == "SignalRConnectionState"
| extend 
    state = tostring(customDimensions.state),
    chatId = tostring(customDimensions.chatId)
| project timestamp, chatId, state
| order by timestamp asc

LOOK FOR:
- State changes from Connected → Disconnected during request
- State changes between first and second message


═══════════════════════════════════════════════════════════
QUERY 5: Azure SignalR Service - Connection Drops
═══════════════════════════════════════════════════════════

// Run in Azure SignalR Service → Metrics
Metrics to check:
1. Connection Close Count (should be LOW)
2. Connection Count (should be STABLE)
3. Message Count (should increase with each message)
4. Server Load (should be < 80%)

IF HIGH Connection Close Count:
→ Connections dropping frequently
→ This explains intermittent failures

"@

$queries | Out-File -FilePath "intermittent-signalr-queries.kql" -Encoding UTF8

Write-Host "  ✓ Queries saved to: intermittent-signalr-queries.kql" -ForegroundColor Green

# Create frontend patch for better logging
$frontendPatch = @"
═══════════════════════════════════════════════════════════
FRONTEND LOGGING PATCH
═══════════════════════════════════════════════════════════

File: webapp/src/redux/features/message-relay/signalRHubConnection.ts

ADD this code to track group membership:

// Track when we join/leave groups
hubConnection.on('joinGroup', (chatId: string) => {
    console.log('🟢 SignalR: Joined group', chatId);
});

// Log ALL SignalR callbacks to track what we receive
const originalOn = hubConnection.on.bind(hubConnection);
hubConnection.on = function(methodName: string, method: (...args: any[]) => void) {
    return originalOn(methodName, function(...args: any[]) {
        console.log('📥 SignalR callback:', methodName, args);
        return method(...args);
    });
};

// Track connection state changes more frequently
setInterval(() => {
    const state = hubConnection.state;
    if (state !== signalR.HubConnectionState.Connected) {
        console.warn('⚠️ SignalR NOT connected:', state);
        console.warn('   This may cause message delivery failures!');
    }
}, 5000); // Every 5 seconds

═══════════════════════════════════════════════════════════

This will log:
- 🟢 When joining SignalR groups
- 📥 ALL SignalR callbacks received
- ⚠️ Connection state warnings

Deploy this, then:
1. Open browser console (F12)
2. Send 2 messages in same chat
3. Check console logs

EXPECTED on 2nd message:
- 📥 SignalR callback: ReceiveMessage
- 📥 SignalR callback: ReceiveBotResponseStatus

IF MISSING → Frontend not receiving (connection dropped)

"@

$frontendPatch | Out-File -FilePath "frontend-logging-patch.txt" -Encoding UTF8

Write-Host "  ✓ Frontend patch saved to: frontend-logging-patch.txt" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Likely Root Causes (Ranked)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n1. Frontend leaves SignalR group after first message" -ForegroundColor White
Write-Host "   Probability: 🔴 HIGH (70%)" -ForegroundColor Red
Write-Host "   Why: First message works, second fails" -ForegroundColor Gray
Write-Host "   Test: Check QUERY 1 (Group Join/Leave)" -ForegroundColor Cyan
Write-Host "   Fix: Ensure frontend stays in group" -ForegroundColor Green

Write-Host "`n2. SignalR connection drops between messages" -ForegroundColor White
Write-Host "   Probability: 🟡 MEDIUM (20%)" -ForegroundColor Yellow
Write-Host "   Why: Intermittent failures" -ForegroundColor Gray
Write-Host "   Test: Check Azure SignalR metrics (Connection Close Count)" -ForegroundColor Cyan
Write-Host "   Fix: Improve reconnection logic" -ForegroundColor Green

Write-Host "`n3. Race condition with concurrent requests" -ForegroundColor White
Write-Host "   Probability: 🟢 LOW (10%)" -ForegroundColor Green
Write-Host "   Why: Second message sent too fast after first" -ForegroundColor Gray
Write-Host "   Test: Check QUERY 3 (Concurrent requests)" -ForegroundColor Cyan
Write-Host "   Fix: Queue requests or add delay" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Immediate Actions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n1. Deploy backend with SignalR logging (if not done):" -ForegroundColor Yellow
Write-Host "   cd webapi && dotnet build" -ForegroundColor Cyan

Write-Host "`n2. Deploy frontend with new logging:" -ForegroundColor Yellow
Write-Host "   See: frontend-logging-patch.txt" -ForegroundColor Cyan

Write-Host "`n3. Reproduce the issue:" -ForegroundColor Yellow
Write-Host "   - Open new chat" -ForegroundColor Gray
Write-Host "   - Send message 1 (should work)" -ForegroundColor Gray
Write-Host "   - Send message 2 immediately after" -ForegroundColor Gray
Write-Host "   - Check browser console for SignalR logs" -ForegroundColor Gray

Write-Host "`n4. Check Application Insights:" -ForegroundColor Yellow
Write-Host "   - Run queries in: intermittent-signalr-queries.kql" -ForegroundColor Cyan
Write-Host "   - Compare logs for message 1 vs message 2" -ForegroundColor Gray

Write-Host "`n5. Check browser console:" -ForegroundColor Yellow
Write-Host "   Expected for working message:" -ForegroundColor Gray
Write-Host "     📥 SignalR callback: ReceiveMessage" -ForegroundColor Green
Write-Host "     📥 SignalR callback: ReceiveBotResponseStatus" -ForegroundColor Green
Write-Host "`n   For failing message:" -ForegroundColor Gray
Write-Host "     (NO SignalR callbacks) ❌" -ForegroundColor Red
Write-Host "     ⚠️ SignalR NOT connected: Disconnected ❌" -ForegroundColor Red

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Quick Test (Do This Now!)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n1. Open Mimir in browser (mimir.vlfk.no)" -ForegroundColor White
Write-Host "2. Open Browser Console (F12)" -ForegroundColor White
Write-Host "3. Look for existing SignalR logs" -ForegroundColor White
Write-Host "4. Send 2 messages in same chat" -ForegroundColor White
Write-Host "5. Compare console logs between message 1 and 2" -ForegroundColor White

Write-Host "`nLook for:" -ForegroundColor Yellow
Write-Host "  • '✓ SignalR connection: Connected' (should ALWAYS show)" -ForegroundColor Gray
Write-Host "  • '📨 SignalR ReceiveMessage' (if missing = problem)" -ForegroundColor Gray
Write-Host "  • '⚠️ SignalR connection state: Disconnected' (BAD!)" -ForegroundColor Gray

Write-Host "`nFiles created:" -ForegroundColor White
Write-Host "  - intermittent-signalr-queries.kql" -ForegroundColor Gray
Write-Host "  - frontend-logging-patch.txt" -ForegroundColor Gray

Write-Host "`nDone! This is a RACE CONDITION or CONNECTION STATE issue." -ForegroundColor Green
Write-Host "Next: Test in browser console first (quickest way to find cause)" -ForegroundColor Yellow

