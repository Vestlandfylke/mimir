# Plugins

Mimir utvider KI-funksjonaliteten gjennom to typar plugins: **innebygde plugins** og **MCP-serverar**.

## Innebygde plugins

Desse er integrerte direkte i backend og konfigurert i `appsettings.json`:

| Plugin | Funksjon | Kjeldetype (sitat) |
|--------|----------|--------------------|
| **ChatPlugin** | Hovud chat-logikk, minne, kontekst | — |
| **LeiarKontekstPlugin** | Strategidokument via Azure AI Search | Leiardokument |
| **SharePointOboPlugin** | SharePoint-dokumentsøk med brukarens tilgang | SharePoint |
| **LovdataPlugin** | Oppslag i norske lover og forskrifter | Lovdata |
| **MimirKnowledgePlugin** | Intern kunnskapsbase om Mimir | Kunnskapsbase |
| **FileGenerationPlugin** | Genererer Word, PowerPoint, Excel, PDF | — |

Alle informasjonsplugins registrerer sitat via `PluginCitationService` som visast nederst i svaret.

## MCP-serverar (Model Context Protocol)

MCP er ein open protokoll for å kople KI-modellar til datakjelder og verktøy.

### Konfigurasjon

I `webapi/appsettings.json`:

```json
"McpServers": {
  "PlanApprovalMode": "PerServer",
  "Servers": [
    {
      "Name": "MittVerktøy",
      "Transport": "Http",
      "Url": "https://mcp-server.azurecontainerapps.io/mcp",
      "Enabled": true,
      "TimeoutSeconds": 60,
      "Templates": ["min-mal"],
      "RequireApproval": true
    }
  ]
}
```

### Konfigurasjonsfelt

| Felt | Skildring |
|------|-----------|
| `Name` | Unikt namn (brukt som plugin-namn) |
| `Transport` | `Http` eller `Stdio` |
| `Url` | Endpoint (for Http) |
| `Command` / `Arguments` | Kommando (for Stdio, t.d. `npx`) |
| `EnvironmentVariables` | Miljøvariablar til serveren |
| `Enabled` | Aktiver/deaktiver |
| `TimeoutSeconds` | Timeout (standard: 30) |
| `Templates` | Avgrens til bestemte assistentmalar (tom = alle) |
| `RequireApproval` | Krev brukar-godkjenning før verktøy køyrast |

### PlanApprovalMode

| Modus | Skildring |
|-------|-----------|
| `Auto` | Verktøy køyrast automatisk |
| `RequireApproval` | Alle MCP-verktøy krev godkjenning |
| `PerServer` | Brukar `RequireApproval` per server |

### Eksempel: HTTP-transport

```json
{
  "Name": "Klarsprak",
  "Transport": "Http",
  "Url": "http://localhost:8002/mcp",
  "Enabled": true
}
```

### Eksempel: Stdio-transport

```json
{
  "Name": "GitHub",
  "Transport": "Stdio",
  "Command": "npx",
  "Arguments": ["-y", "@modelcontextprotocol/server-github"],
  "EnvironmentVariables": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "din-token"
  },
  "Enabled": true
}
```

### Azure-deployment

Legg til i App Service → Configuration → Application settings:

```
McpServers__Servers__0__Name=MittVerktøy
McpServers__Servers__0__Transport=Http
McpServers__Servers__0__Url=https://mcp-server.azurecontainerapps.io/mcp
McpServers__Servers__0__Enabled=true
```

Sensitive verdiar (API-nøklar): bruk `dotnet user-secrets` lokalt eller Azure Key Vault i produksjon.

## Eldre plugins (OpenAI-format)

Mimir støttar framleis OpenAI-format plugins via `Plugins`-seksjonen i appsettings. Sjå [web-searcher/README.md](web-searcher/README.md).

## Meir info

- [MCP-integrasjonsguide](../webapi/MCP_INTEGRATION_GUIDE.md)
- [MCP Bridge](../mcp-bridge/README.md)
- [MCP Servers Registry](https://github.com/modelcontextprotocol/servers)
