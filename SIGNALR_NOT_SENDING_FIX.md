# Backend IKKJE Sender SignalR-Meldingar - Fix

## 🔴 Problem Bekrefta

Frå Application Insights query:
```
No results found from the last 30 minutes
```

**Backend sender IKKJE SignalR-meldingar!**

Dette forklarer kvifor:
- HTTP request fullfører (200 OK)
- Svaret blir lagra i database
- Frontend "spinner" evig
- Ved refresh: Svaret er der

## 🔍 Mulige Årsakar

### 1. Silent Exception (MEST SANNSYNLEG)
**Symptom**: SendAsync feiler, men exception blir ikkje logga

**Kode-lokasjon**:
```csharp
// webapi/Plugins/Chat/ChatPlugin.cs:848
await this._messageRelayHubContext.Clients.Group(chatId)
    .SendAsync("ReceiveMessage", chatId, userId, chatMessage, cancellationToken);
```

**Kvifor det kan feile**:
- `_messageRelayHubContext` er null
- Azure SignalR connection string ikkje lest riktig ved oppstart
- SignalR group ikkje funne (feil chatId)
- CancellationToken already cancelled

### 2. SaveNewResponseAsync Blir IKKJE Kalla
**Symptom**: Koden som sender SignalR-melding blir aldri køyrt

**Check**: Er det ein alternativ kode-veg som ikkje kallar SaveNewResponseAsync?

### 3. Azure SignalR Connection Problem
**Symptom**: Backend prøver å sende, men Azure SignalR feiler

**Check**: SignalR Service metrics i Azure Portal

## 🔧 Løysing: Legg Til Explicit Logging

### Steg 1: Aktiver Backend Debug Logging (Allereie gjort)

```powershell
.\add-backend-signalr-logging.ps1
```

### Steg 2: Legg Til Explicit Logging i ChatPlugin.cs

**Fil**: `webapi/Plugins/Chat/ChatPlugin.cs`

**Endring 1 - I CreateBotMessageOnClient (linje ~848)**:

```csharp
private async Task<CopilotChatMessage> CreateBotMessageOnClient(
    string chatId,
    string userId,
    string prompt,
    string content,
    CancellationToken cancellationToken,
    IEnumerable<CitationSource>? citations = null,
    Dictionary<string, int>? tokenUsage = null,
    CopilotChatMessage.ChatMessageType messageType = CopilotChatMessage.ChatMessageType.Message)
{
    var chatMessage = CopilotChatMessage.CreateBotResponseMessage(chatId, content, prompt, citations, tokenUsage, messageType);
    
    // 🔵 ADD THIS LOGGING:
    try 
    {
        this._logger.LogInformation("🔵 SIGNALR: Attempting to send ReceiveMessage for chatId: {ChatId}, messageId: {MessageId}", chatId, chatMessage.Id);
        
        if (this._messageRelayHubContext == null)
        {
            this._logger.LogError("🔴 SIGNALR ERROR: _messageRelayHubContext is NULL!");
            throw new InvalidOperationException("MessageRelayHubContext is null");
        }
        
        await this._messageRelayHubContext.Clients.Group(chatId).SendAsync("ReceiveMessage", chatId, userId, chatMessage, cancellationToken);
        
        this._logger.LogInformation("✅ SIGNALR: Successfully sent ReceiveMessage for chatId: {ChatId}", chatId);
    }
    catch (Exception ex)
    {
        this._logger.LogError(ex, "🔴 SIGNALR ERROR: Failed to send ReceiveMessage for chatId: {ChatId}", chatId);
        throw; // Re-throw so we know about the failure
    }
    
    return chatMessage;
}
```

**Endring 2 - I UpdateBotResponseStatusOnClientAsync (linje ~870)**:

```csharp
private async Task UpdateBotResponseStatusOnClientAsync(string chatId, string status, CancellationToken cancellationToken)
{
    // 🔵 ADD THIS LOGGING:
    try
    {
        this._logger.LogInformation("🔵 SIGNALR: Sending ReceiveBotResponseStatus for chatId: {ChatId}, status: {Status}", chatId, status ?? "null (clearing)");
        
        if (this._messageRelayHubContext == null)
        {
            this._logger.LogError("🔴 SIGNALR ERROR: _messageRelayHubContext is NULL in UpdateBotResponseStatusOnClientAsync!");
            throw new InvalidOperationException("MessageRelayHubContext is null");
        }
        
        await this._messageRelayHubContext.Clients.Group(chatId).SendAsync("ReceiveBotResponseStatus", chatId, status, cancellationToken);
        
        this._logger.LogInformation("✅ SIGNALR: Successfully sent ReceiveBotResponseStatus for chatId: {ChatId}", chatId);
    }
    catch (Exception ex)
    {
        this._logger.LogError(ex, "🔴 SIGNALR ERROR: Failed to send ReceiveBotResponseStatus for chatId: {ChatId}", chatId);
        throw;
    }
}
```

### Steg 3: Rebuild og Deploy Backend

```powershell
cd webapi
dotnet build
dotnet publish -c Release -o ./publish

# Deploy to Azure (bruk din normale prosess)
```

### Steg 4: Test og Sjekk Loggar

1. **Reproduce problemet**:
   - Still eit spørsmål til Mimir
   - Vent på "spinning"

2. **Sjekk Application Insights**:

```kql
traces
| where timestamp > ago(30m)
| where message contains "SIGNALR"
| project timestamp, severityLevel, message
| order by timestamp asc
```

**Scenario 1: Ser 🔵 men IKKJE ✅**
```
🔵 SIGNALR: Attempting to send ReceiveMessage
(ingen ✅ SUCCESS melding)

→ SendAsync feiler (sjekk for 🔴 ERROR)
```

**Scenario 2: Ser 🔴 ERROR**
```
🔴 SIGNALR ERROR: _messageRelayHubContext is NULL!
ELLER
🔴 SIGNALR ERROR: Failed to send ReceiveMessage

→ Sjekk exception details i loggen
```

**Scenario 3: Ser VERKEN 🔵, ✅ eller 🔴**
```
(ingen SIGNALR logs i det heile)

→ CreateBotMessageOnClient blir IKKJE kalla
→ Sjekk om SaveNewResponseAsync blir kalla
```

## 🎯 Forventet Resultat Etter Fix

**God flow** (i Application Insights traces):
```
[21:30:15] 🔵 SIGNALR: Attempting to send ReceiveMessage for chatId: abc-123
[21:30:15] ✅ SIGNALR: Successfully sent ReceiveMessage for chatId: abc-123
[21:30:15] 🔵 SIGNALR: Sending ReceiveBotResponseStatus for chatId: abc-123, status: null
[21:30:15] ✅ SIGNALR: Successfully sent ReceiveBotResponseStatus for chatId: abc-123
```

**Dårleg flow** (exception):
```
[21:30:15] 🔵 SIGNALR: Attempting to send ReceiveMessage for chatId: abc-123
[21:30:15] 🔴 SIGNALR ERROR: Failed to send ReceiveMessage for chatId: abc-123
             Exception: TaskCanceledException...
```

## 🔍 Vidare Debugging

### Dersom HubContext er NULL:

**Problem**: DI (Dependency Injection) feiler

**Check Program.cs**:
```csharp
// Should have:
builder.Services.AddSignalR().AddAzureSignalR(options => { ... });

// And:
app.MapHub<MessageRelayHub>("/messageRelayHub");
```

**Fix**: Ensure SignalR is properly registered

### Dersom SendAsync Feiler Med Exception:

**Check exception type**:
- `TaskCanceledException` → CancellationToken cancelled too early
- `InvalidOperationException` → Connection not established
- `TimeoutException` → Azure SignalR timeout

**Fix basert på exception**

### Dersom Metoden IKKJE Blir Kalla:

**Check**: Er det ein alternativ kode-veg?

```kql
traces
| where timestamp > ago(30m)
| where message contains "Chat" or message contains "SaveNewResponse"
| project timestamp, message
| order by timestamp asc
```

## 📊 Monitoring Query

**Real-time SignalR message flow**:

```kql
traces
| where timestamp > ago(5m)
| where message contains "SIGNALR"
| extend 
    action = case(
        message contains "Attempting", "🔵 Attempting",
        message contains "Successfully", "✅ Success",
        message contains "ERROR", "🔴 Error",
        "Other"
    ),
    chatId = extract("chatId: ([a-z0-9-]+)", 1, message)
| summarize count() by action, bin(timestamp, 10s)
| render timechart
```

## ✅ Sjekkliste

- [ ] Backend debug logging aktivert (`add-backend-signalr-logging.ps1`)
- [ ] Explicit SignalR logging lagt til i ChatPlugin.cs
- [ ] Backend rebuilda og deploya
- [ ] Problemet reprodusert
- [ ] Application Insights loggar sjekka
- [ ] Funne om:
  - [ ] HubContext er null
  - [ ] SendAsync feiler med exception
  - [ ] Metoden blir ikkje kalla
- [ ] Fix implementert basert på funn
- [ ] Testa at meldingar no kjem fram

## 🎯 Summary

**Problem**: Backend sender ikkje SignalR-meldingar  
**Løysing**: Legg til explicit logging for å finne kvifor  
**Neste steg**: Rebuild backend med logging → Test → Check logs → Implement fix  

Etter denne debuggingen vil me vite **nøyaktig** kvifor SignalR-meldingar ikkje blir sendt!

