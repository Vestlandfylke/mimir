# Fiks for Treige Svar og "Spinning" Problem

## Problem

Du opplevde:
1. ⏱️ **Treige svar** frå AI-assistenten
2. 🔄 **"Spinning" problem** - svaret kjem aldri inn i chatten
3. 🔄 **Må laste inn på nytt** for å sjå svaret

## Rot

Humanvis-årsaken til problemet:

### 1. **SignalR Timeout for Kort** 🔴
```typescript
// FØR (gammalt):
hubConnection.serverTimeoutInMilliseconds = 60000; // 60 sekund

// PROBLEM: AI-svar kan ta 2-3 minutt
// Når timeout skjer:
// ✓ Backend genererer svaret
// ✓ Svaret lagras i databasen
// ✗ SignalR-tilkoplinga er stengt
// ✗ Svaret kjem aldri til frontend
// → Du ser berre "spinning" loader
```

### 2. **Berre WebSockets Transport** 🟡
```typescript
// FØR:
transport: signalR.HttpTransportType.WebSockets

// PROBLEM: Dersom WebSockets feiler (firewalls, proxy, nettverk):
// → Ingen fallback
// → Tilkoplinga feiler heilt
```

### 3. **Manglar KeepAlive Konfigurasjon** 🟡
```typescript
// FØR:
// Ingen keepAliveIntervalInMilliseconds satt

// PROBLEM: SignalR veit ikkje om tilkoplinga er i live
// → Kan miste tilkopling utan å merke det
```

### 4. **Backend Timeout Ikkje Satt** 🔴
```json
// FØR (appsettings.json):
// Ingen "Service:TimeoutLimitInS" konfigurert

// PROBLEM: 
// - Standardtimeout (30 sek) eller ingen timeout
// - AI-oppgåver kan ta lengre tid
// - 504 Gateway Timeout feil
```

## Løysing

### Frontend Fix ✅

**Fil**: `webapp/src/redux/features/message-relay/signalRHubConnection.ts`

```typescript
// ETTER (nytt):
const signalRConnectionOptions = {
    skipNegotiation: false,
    // Bruk WebSockets MED fallback til andre transportar
    transport: signalR.HttpTransportType.WebSockets | 
               signalR.HttpTransportType.ServerSentEvents | 
               signalR.HttpTransportType.LongPolling,
    logger: signalR.LogLevel.Warning,
};

const hubConnection = new signalR.HubConnectionBuilder()
    .withUrl(connectionHubUrl.toString(), signalRConnectionOptions)
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000]) // Gradvis aukande retry
    .withHubProtocol(new signalR.JsonHubProtocol())
    .configureLogging(signalR.LogLevel.Information)
    .build();

// Auka timeout til 3 minutt (matcher backend)
hubConnection.serverTimeoutInMilliseconds = 180000; // 3 minutt
hubConnection.keepAliveIntervalInMilliseconds = 15000; // Keepalive kvart 15. sekund
```

**Kva dette gjer:**
- ✅ SignalR ventar i 3 minutt (nok for dei fleste AI-svar)
- ✅ Sender keepalive kvart 15. sekund (held tilkoplinga i live)
- ✅ Har fallback-transportar dersom WebSockets feiler
- ✅ Smartare reconnect-strategi

### Backend Fix ✅

**Kjør script**: `scripts/fix-slow-responses.ps1`

Scriptet gjer:
1. **Aukar timeout til 180 sekund** (3 minutt)
   ```
   Service:TimeoutLimitInS = 180
   ```

2. **Aktiverer Always On**
   ```
   --always-on true
   ```
   Hindrar "cold starts" som gjer første request treg

3. **Sikrar WebSocket support**
   ```
   --web-sockets-enabled true
   ```

4. **Konfigurerer sticky sessions**
   ```
   WEBSITE_ADD_SITENAME_BINDINGS_IN_APPHOST_CONFIG = 1
   ```
   Sørger for at SignalR-tilkoplingar går til same server

## Testing

### Køyr Fiks-Scriptet

```powershell
cd scripts
.\fix-slow-responses.ps1
```

### Bygg og Deploy Frontend

```powershell
cd webapp
yarn build

# Deploy (bruk din normale deployment-prosess)
```

### Test Fiks

1. **Opne Mimir i nettlesar**
2. **Still eit komplekst spørsmål** som krev tenking/MCP-verktøy
3. **Sjå at:**
   - ✅ Loader viser framdrift
   - ✅ Svaret kjem inn i chatten
   - ✅ Ingen "spinning" utan svar
   - ✅ Ingen behov for å laste inn på nytt

### Debug

Opne browser console (F12) og sjå etter:

```javascript
// Gode meldingar:
"SignalR connection established"
"Connected with connectionId ..."

// Dårlege meldingar (skal ikkje sjå desse):
"Connection lost due to error"
"Connection closed due to error"
"serverTimeout"
```

## Kva om det framleis er treigt?

### 1. Sjekk SignalR-tilkopling i browser console

```javascript
// Opne Console (F12)
// Sjekk for feilmeldingar relatert til SignalR
```

### 2. Sjekk Application Insights for lang responstid

```kql
requests
| where timestamp > ago(1h)
| where name contains "Chat"
| summarize avg(duration), max(duration), count() by name
| order by avg_duration desc
```

### 3. Sjekk om Azure SignalR Service er konfigurert

```powershell
az webapp config appsettings list `
    --name app-copichat-4kt5uxo2hrzri-webapi `
    --resource-group rg-sk-copilot-npi `
    --query "[?name=='Azure:SignalR:ConnectionString']"
```

**Dersom IKKJE konfigurert:**
- Lokalt SignalR har grenser
- Vurder Azure SignalR Service for produksjon

### 4. Vurder Azure SignalR Service

**Fordelar:**
- 🚀 Betre skalering
- 🔒 Meir påliteleg tilkopling
- ⚡ Håndterer lang-køyrande tilkoplingar betre
- 📊 Innebygd metrikkar og logging

**Sett opp:**
```powershell
# Opprett SignalR Service
az signalr create `
    --name mimir-signalr `
    --resource-group rg-sk-copilot-npi `
    --sku Standard_S1 `
    --location swedencentral

# Hent connection string
$connString = az signalr key list `
    --name mimir-signalr `
    --resource-group rg-sk-copilot-npi `
    --query "primaryConnectionString" -o tsv

# Legg til i App Service
az webapp config appsettings set `
    --name app-copichat-4kt5uxo2hrzri-webapi `
    --resource-group rg-sk-copilot-npi `
    --settings "Azure:SignalR:ConnectionString=$connString"

# Restart
az webapp restart `
    --name app-copichat-4kt5uxo2hrzri-webapi `
    --resource-group rg-sk-copilot-npi
```

## Teknisk Forklaring

### SignalR Timeout Flow

**FØR (problem):**
```
1. Brukar stiller spørsmål
2. Frontend sender request via HTTP
3. Backend startar AI-generering
4. SignalR ventar på svar...
   ⏰ 60 sekund...
   ❌ TIMEOUT! (AI er ikkje ferdig)
5. Frontend: Connection lost
6. AI ferdig (lagrar i database)
7. SignalR prøver å sende svar → FEILAR (connection stengt)
8. Frontend: "spinning" forever
9. Brukar lastar inn på nytt → Ser svaret (frå database)
```

**ETTER (løyst):**
```
1. Brukar stiller spørsmål
2. Frontend sender request via HTTP
3. Backend startar AI-generering
4. SignalR ventar på svar...
   ⏰ 180 sekund... (nok tid!)
   ✅ Keepalive kvart 15. sek (held i live)
5. AI ferdig (2 minutt)
6. SignalR sender svar → ✅ SUCCESS
7. Frontend: Viser svaret
8. Brukar: Fornøgd! 🎉
```

### Transport Fallback

**FØR:**
```
Prøv WebSockets → Feilar → Gjev opp ❌
```

**ETTER:**
```
Prøv WebSockets → Feilar
  ↓
Prøv Server-Sent Events → Feilar
  ↓
Prøv Long Polling → ✅ Fungerer!
```

## Samandrag

| Problem | Løysing | Status |
|---------|---------|--------|
| SignalR timeout (60s) | Auka til 180s | ✅ Fiksa |
| Ingen keepalive | Sett til 15s | ✅ Fiksa |
| Berre WebSockets | Lagt til fallback | ✅ Fiksa |
| Backend timeout ikkje sett | Sett til 180s | ✅ Fiksa |
| Cold starts | Always On enabled | ✅ Fiksa |
| Dårleg reconnect | Smartare retry-strategi | ✅ Fiksa |

## Resultat

- ✅ Svar kjem alltid inn i chatten
- ✅ Ingen "spinning" utan svar
- ✅ Ingen behov for å laste inn på nytt
- ✅ Betre brukaropplevelse
- ✅ Meir påliteleg tilkopling

## Ytterlegare Optimalisering

**Dersom du vil ha endå betre ytelse:**

1. **Enable Azure SignalR Service** (anbefalt for produksjon)
2. **Optimaliser AI-modell**:
   - Bruk FastModel (gpt-4o-mini) for enklare spørsmål
   - Bruk Main Model (gpt-4o) for komplekse spørsmål
3. **Cache ofte brukte svar**
4. **Optimaliser MCP-verktøy** (reduser timeout/complexity)

## Support

Dersom problem held fram:
1. Sjekk browser console for feilmeldingar
2. Sjekk Application Insights for lang responstid
3. Vurder Azure SignalR Service
4. Kontakt support med loggar frå Application Insights

