# SignalR "Spinning Forever" Issue - Root Cause og Løysing

## 🔴 Problem

**Symptom**: 
- Brukar stiller spørsmål til Mimir
- HTTP request fullfører vellykka (t.d. 34 sekund)
- Svaret blir lagra i database
- **MEN**: Svaret kjem aldri inn i chatten - berre "spinning" loader
- Ved refresh: Svaret er der (lasta frå database)

**Basert på screenshots**:
```
Network tab viser:
- POST /api/chat/chat
- Status: 200 OK
- Time: 34.38s
- Response: Success

MEN chatten:
- Mimir avatar med "spinning" dots
- Ingen svar
- Ingen feilmelding
```

## 🔍 Root Cause Analysis

### SignalR Message Delivery Failure

**Kva skjer:**

1. ✅ Frontend sender POST /api/chat/chat
2. ✅ Backend mottar request
3. ✅ Backend startar AI-generering
4. ✅ AI genererer svar (tar 30-40 sekund)
5. ✅ Backend lagrar svar i database
6. 🔴 Backend prøver å sende svar via SignalR
7. ❌ **SignalR melding når IKKJE frontend**
8. ❌ Frontend ventar evig (spinner)
9. ✅ Ved refresh: Hent svar frå database

### Kvifor SignalR Feiler

Det er **3 mulige årsaker**:

#### A. SignalR Connection Lost Under Request 🔴 (MEST SANNSYNLEG)

**Problem:**
```
Time: 0s  - SignalR Connected ✓
Time: 5s  - Request sent
Time: 10s - Backend thinking...
Time: 20s - Backend thinking...
Time: 30s - Backend done, sending via SignalR
Time: 30s - SignalR connection: LOST ❌
         → Message can't be delivered
         → Frontend never receives it
```

**Årsakar til connection loss:**
- Lange HTTP requests kan forstyrre WebSocket connection
- Proxy/firewall timeout
- Load balancer timeout
- Manglar proper keepalive
- Lokalt SignalR har grenser

#### B. Message Sendt Men Ikkje Motteke 🟡

**Problem:**
- Backend sender melding til feil SignalR group/connectionId
- Melding går til feil brukar
- Melding blir filtrert bort av frontend
- Redux dispatch feiler

#### C. Backend Sender Ikkje Melding 🟡

**Problem:**
- Exception i SignalR send-logikk
- Try-catch blokk svelger feil
- Logger ikkje exceptions

## 🎯 Løysing

### Anbefalt: Azure SignalR Service 🏆

**Kvifor dette løyser problemet:**

1. **Dedikert infrastruktur** for SignalR
   - Ikkje påverka av lang HTTP requests
   - Eigen connection pool
   - Betre keepalive håndtering

2. **Auto-scaling og redundancy**
   - Automatisk skalering ved load
   - Failover ved problem
   - Multi-region support

3. **Optimalisert for lang-køyrande connections**
   - Handterer connections som varer i minutt/timer
   - Smartare timeout-håndtering
   - Betre message routing

4. **Ingen sticky session-krav**
   - Fungerer med multiple instansar
   - Ingen app service plan-avhengigheit

### Implementering

**1. Køyr Setup Script**

```powershell
cd scripts
.\setup-azure-signalr.ps1

# Eller med custom SKU:
.\setup-azure-signalr.ps1 -SKU Standard_S1
```

**Kva scriptet gjer:**
- Opprettar Azure SignalR Service
- Hent connection string
- Konfigurerer Web API og Memory Pipeline
- Restartar apps

**2. Test**
```
1. Opne Mimir
2. Still eit komplekst spørsmål
3. Sjå at svaret kjem inn (ingen spinning)
4. Sjekk browser console for loggar
```

**3. Monitor**
```
Azure Portal → SignalR Service → Metrics
- Connection count
- Message count
- Errors
```

## 🔧 Alternative Løysingar (Dersom Azure SignalR ikkje er mulig)

### 1. Frontend Polling Fallback

**Idé**: Dersom SignalR ikkje leverer melding på X sekund, poll database

```typescript
// Pseudo-code
async function sendMessage(message) {
    const response = await postMessage(message);
    
    // Wait for SignalR
    const received = await waitForSignalR(response.messageId, 45000); // 45s
    
    if (!received) {
        // Fallback: Poll for message
        console.warn('SignalR did not deliver, falling back to polling');
        await pollForMessage(response.messageId);
    }
}
```

**Pros:**
- Fungerer alltid (backup)
- Enkel å implementere

**Cons:**
- Ekstra load på backend
- Delay før brukar ser svar
- Ikkje real-time

### 2. Auk SignalR Timeouts Ytterlegare

**Prøvd allereie** (60s → 180s), men kan aukast meir:

```typescript
hubConnection.serverTimeoutInMilliseconds = 300000; // 5 minutt
hubConnection.keepAliveIntervalInMilliseconds = 10000; // 10 sekund
```

**Pros:**
- Enkel endring
- Kan hjelpe for enkelte scenarios

**Cons:**
- Løyser ikkje grunnproblemet
- Kan maskere andre issues
- Ikkje påliteleg for alle nettverksscenarios

### 3. Splitt Lange Requests

**Idé**: Returner svar i chunks via streaming

```
Request → Start generation
SignalR: "Started..."
SignalR: "25% done..."
SignalR: "50% done..."
SignalR: "75% done..."
SignalR: "Done!" + full message
```

**Pros:**
- Betre brukaropplevelse
- Visar framdrift
- Held connection alive

**Cons:**
- Stor refactoring
- Kompleks implementering

## 📊 Diagnostikk

### Køyr Diagnostics Script

```powershell
cd scripts
.\diagnose-signalr-issue.ps1
```

**Output:**
- `diagnostic-report.txt` - Full analyse
- `slow-requests-query.kql` - Trege requests
- `signalr-issues-query.kql` - SignalR feil
- `timeout-errors-query.kql` - Timeout errors

### Check Browser Console

Med nye loggane eg har lagt til, sjå etter:

```javascript
// God flow:
✓ SignalR connection: Connected
📨 SignalR ReceiveMessage: {...}
🤖 Bot message received, dispatching to Redux
✓ Message dispatched to Redux store
🔄 SignalR ReceiveBotResponseStatus: { status: null }
✓ Bot response complete - spinner should clear

// Dårleg flow (problem):
⚠️ SignalR connection state: Disconnected
// ELLER
✓ SignalR connection: Connected
// Men ingen "ReceiveMessage" eller "ReceiveBotResponseStatus"
```

### Check Application Insights

**Query 1: Sjekk om backend sender SignalR meldingar**

```kql
traces
| where timestamp > ago(1h)
| where message contains "SendAsync" or message contains "messageRelayHub"
| project timestamp, message, severityLevel
| order by timestamp desc
```

**Query 2: SignalR exceptions**

```kql
exceptions  
| where timestamp > ago(1h)
| where outerMessage contains "SignalR" or outerMessage contains "Hub"
| project timestamp, type, outerMessage, operation_Name
| order by timestamp desc
```

**Query 3: Sjekk chat request timeline**

```kql
requests
| where timestamp > ago(1h)
| where name contains "Chat"
| where duration > 30000
| project 
    timestamp,
    name,
    duration,
    resultCode,
    success,
    customDimensions
| order by timestamp desc
```

## 🏁 Samandrag

| Problem | Root Cause | Løysing | Prioritet |
|---------|-----------|---------|-----------|
| Spinning forever | SignalR connection lost | Azure SignalR Service | 🔴 Høg |
| Message ikkje motteke | Long HTTP request | Azure SignalR Service | 🔴 Høg |
| Inconsistent behavior | Lokalt SignalR limits | Azure SignalR Service | 🔴 Høg |
| Ingen fallback | No retry logic | Add polling fallback | 🟡 Medium |
| Lang responstid | AI model + MCP tools | Optimize/cache | 🟢 Låg |

## 🎯 Action Items (Priority Order)

1. **🔴 KRITISK**: Setup Azure SignalR Service
   ```powershell
   .\scripts\setup-azure-signalr.ps1
   ```

2. **🟡 HØG**: Test og verifiser
   - Still komplekse spørsmål
   - Sjekk browser console
   - Verifiser ingen spinning

3. **🟡 HØG**: Monitor SignalR Service
   - Sjekk connections
   - Sjekk message throughput
   - Sjekk for errors

4. **🟢 MEDIUM**: Implement polling fallback (backup)
   - For ekstra pålitelegheit
   - Fungerer om SignalR feiler

5. **🟢 LÅG**: Optimize AI response time
   - Bruk FastModel for enkle spørsmål
   - Cache ofte brukte svar
   - Optimaliser MCP tools

## 💰 Kostand Azure SignalR

**Free Tier** (F1):
- 0 kr/månad
- Max 20 connections
- Max 20,000 meldingar/dag
- God for testing

**Standard Tier** (S1):
- ~€46/månad (~500 kr)
- Max 1,000 connections per unit
- Unlimited meldingar
- Anbefalt for produksjon

**Anbefaling**: Start med Free, oppgrader til Standard når nødvendig

## ✅ Forventet Resultat

**Før**:
```
User: [Ask question]
Bot: [Spinning...] ⏳
[Wait 34s]
Bot: [Still spinning...] ⏳
[Refresh page]
Bot: [Response appears] ✓
```

**Etter**:
```
User: [Ask question]
Bot: [Thinking...] 💭
[Wait 34s]
Bot: [Response appears immediately] ✓
```

## 📞 Support

Dersom problemet held fram etter Azure SignalR setup:

1. Check diagnostics: `.\diagnose-signalr-issue.ps1`
2. Check browser console for SignalR errors
3. Check Application Insights for exceptions
4. Verify SignalR Service is connected:
   ```
   Connection string should be set in app settings
   ```
5. Contact support med loggar

---

**TL;DR**: Problemet er at SignalR connections blir lost under lange AI-requests. Løysing: Bruk Azure SignalR Service som handterer dette mykje betre. Køyr `.\scripts\setup-azure-signalr.ps1` for å fikse.

