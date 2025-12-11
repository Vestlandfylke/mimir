# SignalR Debug Queries for Application Insights

Bruk desse KQL-queries i Application Insights for å feilsøke SignalR-problemet.

## 1. Sjekk SignalR-meldingar sendt frå backend

```kql
// Finn alle SignalR SendAsync kall dei siste 30 minutta
traces
| where timestamp > ago(30m)
| where message contains "SignalR" or message contains "SendAsync" or message contains "ReceiveMessage"
| order by timestamp desc
| project timestamp, message, severityLevel, customDimensions
| take 100
```

## 2. Sjekk bot-meldingar som blir oppretta

```kql
// Finn CreateBotMessageOnClient kall
traces
| where timestamp > ago(30m)
| where message contains "CreateBotMessage" or message contains "Bot message"
| order by timestamp desc
| project timestamp, message, severityLevel, customDimensions
| take 50
```

## 3. Sjekk om det er feil i SignalR-hub

```kql
// Finn alle exceptions relatert til SignalR
exceptions
| where timestamp > ago(1h)
| where type contains "SignalR" or outerMessage contains "SignalR" or outerMessage contains "Hub"
| order by timestamp desc
| project timestamp, type, outerMessage, innermostMessage, details
| take 50
```

## 4. Sjekk MessageRelayHub aktivitet

```kql
// Finn aktivitet i MessageRelayHub
traces
| where timestamp > ago(30m)
| where message contains "MessageRelayHub" or message contains "Relay"
| order by timestamp desc
| project timestamp, message, severityLevel
| take 50
```

## 5. Sjekk chat-prosessering timing

```kql
// Finn chat-requests og timing
requests
| where timestamp > ago(30m)
| where name contains "chat" or url contains "chat"
| order by timestamp desc
| project timestamp, name, url, duration, resultCode, success
| take 50
```

## 6. Sjekk ReceiveMessage vs ReceiveMessageUpdate

```kql
// Finn alle ReceiveMessage og ReceiveMessageUpdate hendingar
traces
| where timestamp > ago(30m)
| where message contains "ReceiveMessage" or message contains "MessageUpdate"
| order by timestamp desc
| project timestamp, message, customDimensions
| take 100
```

## 7. Sjekk om meldingar blir lagra til database

```kql
// Finn database-operasjonar for meldingar
dependencies
| where timestamp > ago(30m)
| where type == "SQL" or type contains "Cosmos" or type contains "Storage"
| where name contains "message" or data contains "message"
| order by timestamp desc
| project timestamp, name, type, data, duration, success
| take 50
```

## 8. Sjekk for timeout eller connection issues

```kql
// Finn alle warnings og errors
traces
| where timestamp > ago(1h)
| where severityLevel >= 2  // Warning or higher
| where message contains "SignalR" or message contains "connection" or message contains "timeout"
| order by timestamp desc
| project timestamp, message, severityLevel, customDimensions
| take 100
```

## 9. Komplett chat-flow for ein spesifikk chatId

```kql
// Erstatt CHAT_ID_HERE med faktisk chatId
let chatId = "0d17b9de-1a56-4745-b850-0a1b68ecbdd7";
traces
| where timestamp > ago(1h)
| where message contains chatId or tostring(customDimensions) contains chatId
| order by timestamp asc
| project timestamp, message, severityLevel, customDimensions
| take 200
```

## 10. Sjekk SignalR Groups (AddClientToGroup)

```kql
// Finn SignalR group operasjonar
traces
| where timestamp > ago(30m)
| where message contains "Group" or message contains "AddClient"
| order by timestamp desc
| project timestamp, message, severityLevel
| take 50
```

## 11. Sjekk ChatPlugin aktivitet

```kql
// Finn ChatPlugin logs
traces
| where timestamp > ago(30m)
| where message contains "ChatPlugin" or message contains "Chat plugin"
| order by timestamp desc
| project timestamp, message, severityLevel, customDimensions
| take 100
```

## 12. Sjekk for "stille" periodar (ingen SignalR-aktivitet)

```kql
// Finn gaps i SignalR-aktivitet
traces
| where timestamp > ago(1h)
| where message contains "SignalR"
| summarize count() by bin(timestamp, 1m)
| order by timestamp asc
| render timechart
```

---

## Korleis bruke queries

1. Gå til Azure Portal → Application Insights
2. Klikk "Logs" i venstre meny
3. Lim inn ein av queries ovanfor
4. Klikk "Run"

## Kva du leitar etter

### Problem 1: SignalR sender ikkje meldingar
Dersom query 1 og 2 viser at backend prosesserer men ikkje sender → Problem i `ChatPlugin.CreateBotMessageOnClient`

### Problem 2: SignalR connection issues
Dersom query 8 viser timeout/connection errors → Azure SignalR Service problem

### Problem 3: Meldingar blir sendt men ikkje motteke
Dersom query 1 viser sending men frontend ikkje mottek → Klient-side problem eller SignalR hub routing

### Problem 4: Timing issues
Dersom query 5 viser lang latency → Server-side performance problem

