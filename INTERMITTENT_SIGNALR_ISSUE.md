# Intermittent SignalR Problem - Analyse og Løysing

## 🔴 Problem Mønster (Oppdatert Forståing)

**Observasjon frå brukar**:
- Chat 1: Melding 1 ✅, Melding 2 ❌ (spinner)
- Chat 2: Melding 1 ✅, Melding 2 ❌ (spinner)  
- Chat 3: Melding 1 ✅, Melding 2 ✅

**Dette er KRITISK informasjon**:
- ❌ IKKJE ein konfigurasjonsfeil (då ville det ALDRI fungere)
- ✅ Det er ein **intermittent** feil
- ✅ Første melding fungerer ofte
- ❌ Andre melding feiler nokre gonger

## 🎯 Mest Sannsynleg Årsak

### SignalR Group Membership Problem (70% sannsynleg)

**Kva skjer**:
```
1. Opne chat → Frontend joins SignalR group "chatId123" ✅
2. Send melding 1:
   - Backend sender til group "chatId123"
   - Frontend mottar (er i gruppe) ✅
   
3. Noko skjer som fjernar frontend frå gruppe 🔴
   - Kanskje ved navigation?
   - Kanskje ved oppdatering av state?
   - Kanskje connection reconnect?
   
4. Send melding 2:
   - Backend sender til group "chatId123"
   - Frontend mottar IKKJE (er IKKJE i gruppe) ❌
   - Melding går tapt → Spinner forever
```

### Alternativ: Connection Drops (20% sannsynleg)

**Kva skjer**:
```
1. Send melding 1:
   - SignalR connection: Connected ✅
   - Melding mottas ✅
   
2. Under/etter melding 1:
   - SignalR connection dropper
   - State: Connected → Disconnected 🔴
   
3. Send melding 2:
   - Backend sender melding
   - Frontend connection: Disconnected ❌
   - Melding går tapt
```

## 🔍 Diagnose NO (Rask Test)

### Test 1: Sjekk Browser Console NO

1. Opne Mimir (mimir.vlfk.no)
2. Opne Browser Console (F12)
3. Send 2 meldingar i same chat
4. Sjå etter desse loggane:

**For melding 1 (som fungerer)**:
```javascript
✓ SignalR connection: Connected
📨 SignalR ReceiveMessage: {...}
🤖 Bot message received
✓ Message dispatched
🔄 SignalR ReceiveBotResponseStatus: { status: null }
✓ Bot response complete
```

**For melding 2 (som feiler)**:
```javascript
✓ SignalR connection: Connected  // ELLER
⚠️ SignalR connection state: Disconnected  // Dette er problemet!

(INGEN andre logs - ingen ReceiveMessage)
```

**Dersom du ser**:
- ⚠️ "SignalR connection state: Disconnected" → Connection droppar
- Ingen "ReceiveMessage" logs → Frontend mottar ikkje melding

### Test 2: Sjekk Network Tab

1. Opne Browser DevTools → Network tab
2. Filter: WS (WebSocket)
3. Send 2 meldingar
4. Sjekk WebSocket connection

**Problem dersom**:
- WebSocket connection blir raud (disconnected)
- WebSocket reconnects mellom meldingar
- Multiple WebSocket connections (should be ONE)

## 🔧 Quick Fix: Forbetre Connection Stability

Sidan me allereie har lagt til forbetre reconnect-logikk i frontend, la oss legge til meir **defensive** kode:

### Fix 1: Sjekk Connection State Før Sending

**Problem**: Me sender request sjølv om SignalR er disconnected

**Løysing**: Vent på reconnect før me sender

```typescript
// I chat input handler (før me sender melding)
const checkSignalRConnection = async () => {
    const maxWaitTime = 5000; // 5 sekund
    const startTime = Date.now();
    
    while (hubConnection.state !== signalR.HubConnectionState.Connected) {
        if (Date.now() - startTime > maxWaitTime) {
            console.error('⚠️ SignalR not connected after 5s, sending anyway');
            break;
        }
        console.log('⏳ Waiting for SignalR to connect...');
        await new Promise(resolve => setTimeout(resolve, 100));
    }
};

// Call before sending message
await checkSignalRConnection();
await sendMessage(...);
```

### Fix 2: Auto-Rejoin Group on Reconnect

**Problem**: Ved reconnect, me joiner kanskje ikkje gruppe igjen

**Løysing**: Explicitly rejoin group etter reconnect

```typescript
hubConnection.onreconnected(async (connectionId) => {
    console.log('✓ Reconnected with connectionId:', connectionId);
    
    // Rejoin current chat group
    const currentChatId = getCurrentChatId(); // Get from Redux state
    if (currentChatId) {
        console.log('🔄 Rejoining group:', currentChatId);
        // Backend should have endpoint to rejoin group
        // Or it happens automatically on next request
    }
});
```

### Fix 3: Poll Fallback for Failed Messages

**Problem**: Melding går tapt om SignalR feiler

**Løysing**: Dersom me ikkje får melding på X sekund, poll database

```typescript
const sendMessageWithFallback = async (message: string, chatId: string) => {
    const messageId = generateId();
    
    // Send message
    await api.sendMessage(chatId, message, messageId);
    
    // Wait for SignalR delivery (max 45 sekund)
    const received = await waitForMessage(messageId, 45000);
    
    if (!received) {
        console.warn('⚠️ SignalR did not deliver message, polling...');
        
        // Poll every 2 seconds for max 10 seconds
        for (let i = 0; i < 5; i++) {
            await sleep(2000);
            const messages = await api.getChatMessages(chatId);
            const newMessage = messages.find(m => m.id === messageId);
            if (newMessage) {
                console.log('✓ Message retrieved via polling fallback');
                dispatch(addMessage(newMessage));
                return;
            }
        }
        
        // Still not found - show error
        dispatch(showError('Message delivery failed'));
    }
};
```

## 📋 Action Plan (Prioritert)

### 1. 🔴 KRITISK: Sjekk Browser Console NO

```
- Opne mimir.vlfk.no
- F12 → Console
- Send 2 meldingar
- Noter kva du ser (eller ikkje ser)
```

**Rapporter tilbake**:
- Ser du "⚠️ SignalR connection state: Disconnected"?
- Ser du "📨 ReceiveMessage" for begge meldingar?
- Ser du "✓ SignalR connection: Connected" hele tida?

### 2. 🟡 Deploy Backend Med Logging (Om Ikkje Gjort)

```powershell
cd webapi
dotnet build
# Deploy
```

Dette vil vise om backend sender meldingane.

### 3. 🟡 Køyr Diagnostikk

```powershell
cd scripts
.\diagnose-intermittent-signalr.ps1
```

Dette lagar queries for Application Insights.

### 4. 🟢 Implement Fallback

Etter me finn årsaka, implement ein av desse:
- Connection state check
- Auto-rejoin groups
- Poll fallback

## 🎯 Forventet Årsak og Fix

**Basert på mønsteret (første melding OK, andre feiler nokre gonger)**:

**Mest Sannsynleg**: 
SignalR connection droppar ETTER første melding, men FØR andre melding.

**Kvifor**:
- Første request tek lang tid (30-40s)
- Under denne tida kan connection bli ustabil
- Ved neste request er connection i feil state

**Fix**:
1. Forbetre keepalive (allereie gjort)
2. Legge til connection state check før sending
3. Legge til polling fallback

## 🧪 Testing Scenario

For å reprodusere:
1. Opne ny chat
2. Send kompleks spørsmål (tek 30-40s)
3. **UMIDDELBART** etter du ser svar, send ny melding
4. Sjå om andre melding "spinner"

**Hypotese**: Andre melding feiler om du sender han fort etter første.

**Test**: Vent 10 sekund mellom meldingar - fungerer då begge?

## 📊 Metrics å Sjekke

**Azure SignalR Service → Metrics**:
- Connection Close Count (høg = problem)
- Connection Count (skal vere stabil)
- Message Count (skal auke)

**Application Insights**:
```kql
traces
| where timestamp > ago(1h)
| where message contains "SIGNALR"
| extend chatId = extract("chatId[^\\s]+", 0, message)
| summarize count() by chatId, message
| order by timestamp asc
```

Sjå om me ser:
- 🔵 Attempting (backend prøver å sende)
- ✅ Success (backend sende OK)
- Men frontend mottar ikkje (connection issue)

## 🎯 Summary

**Problem**: Intermittent - første melding OK, andre feiler nokre gonger  
**Årsak**: Truleg SignalR connection droppar/unstabil etter lang request  
**Neste steg**: 
1. Sjekk browser console NO (F12) under test
2. Rapporter tilbake kva du ser
3. Me implementerer riktig fix basert på det

**Rask test**: Send 2 meldingar raskt etter kvarandre - feiler då andre? 🔍

