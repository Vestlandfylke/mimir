# Mimir Backend (WebAPI)

Backend API-teneste for Mimir, bygd med .NET 8 og Semantic Kernel.

## Oversikt

Backend-en handterer:
- Chat-orkestrering med Semantic Kernel
- Integrasjon med Azure OpenAI
- Dokumentlagring og semantisk søk
- MCP-verktøy via HTTP-klient
- Autentisering og autorisering
- Telemetri og logging

## Kjøre lokalt

### Krav
- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- Azure OpenAI ressurs

### Setup

1. **Konfigurer appsettings**
   ```bash
   cp appsettings.json appsettings.Development.json
   ```
   
   Oppdater `appsettings.Development.json`:
   ```json
   {
     "AzureOpenAI": {
       "Endpoint": "https://your-resource.openai.azure.com",
       "ChatDeploymentName": "gpt-4o",
       "EmbeddingDeploymentName": "text-embedding-ada-002"
     }
   }
   ```

2. **Legg til API-nøkkel**
   ```bash
   dotnet user-secrets set "AzureOpenAI:Key" "YOUR_KEY_HERE"
   ```

3. **Bygg og kjør**
   ```bash
   dotnet build
   dotnet run
   ```

Backend køyrer no på `https://localhost:40443`

### Verifiser
Opne `https://localhost:40443/healthz` i nettlesar for å sjekke at backend svarar.

## Konfigurasjon

### appsettings.json

Viktige seksjonar:

**AzureOpenAI** - AI-modellkonfigurasjon
```json
{
  "AzureOpenAI": {
    "Endpoint": "https://...",
    "ChatDeploymentName": "gpt-4o",
    "EmbeddingDeploymentName": "text-embedding-ada-002"
  }
}
```

**FastModel** - Rask modell for intent-ekstraksjon
```json
{
  "FastModel": {
    "Enabled": true,
    "Deployment": "gpt-4o-mini"
  }
}
```

**McpServers** - MCP-verktøy
```json
{
  "McpServers": {
    "Servers": [{
      "Url": "http://localhost:8002/mcp",
      "Name": "CustomMcpServer",
      "Enabled": true
    }]
  }
}
```

**ChatStore** - Datalagring
```json
{
  "ChatStore": {
    "Type": "volatile"  // eller "cosmos" for Azure
  }
}
```

## Arkitektur

### Hovudkomponentar

- **Controllers** - REST API endpoints
- **Plugins** - Semantic Kernel plugins (ChatPlugin, FileGenerationPlugin)
- **Services** - Business logic (SemanticKernelProvider, McpPlanService)
- **Storage** - Data access (Repositories, CosmosDbContext)
- **Extensions** - Dependency injection og konfigurasjon

### Semantic Kernel Setup

Backend bruker Semantic Kernel for AI-orkestrering:

1. **KernelBuilder** - Registrerer AI-tenester og plugins
2. **ChatPlugin** - Hovud chat-logikk med minne og kontekst
3. **FileGenerationPlugin** - Genererer og lagrar filer
4. **MCP Integration** - Kallar eksterne MCP-verktøy

## API Endpoints

### Chat
- `POST /chats` - Opprett ny chat
- `GET /chats/{chatId}` - Hent chat-detaljar
- `POST /chats/{chatId}/messages` - Send melding
- `DELETE /chats/{chatId}` - Slett chat

### Dokument
- `POST /chats/{chatId}/documents` - Last opp dokument
- `GET /chats/{chatId}/documents` - Hent dokumentliste
- `POST /chats/{chatId}/documents/{documentId}/pin` - Fest dokument
- `DELETE /chats/{chatId}/documents/{documentId}` - Slett dokument

### Filer
- `GET /files/{fileId}` - Last ned generert fil
- `GET /chats/{chatId}/files` - Hent filliste

## Utvikling

### Visual Studio Code

Bruk launch-konfigurasjon:
1. Opne workspace i VS Code
2. Trykk F5 for å starte debugging
3. Vel `CopilotChatWebApi` launch config

### Visual Studio 2022

1. Opne `CopilotChat.sln`
2. Set `CopilotChatWebApi` som startup project
3. Trykk F5 for debugging

## Testing

```bash
# Køyr alle testar
dotnet test

# Køyr integration-testar
cd ../integration-tests
dotnet test
```

## Deployment

Backend deployast til Azure App Service via GitHub Actions.

Sjå [../GITHUB_ACTIONS_SETUP.md](../GITHUB_ACTIONS_SETUP.md) for detaljar.

## Meir informasjon

- [MCP_INTEGRATION_GUIDE.md](MCP_INTEGRATION_GUIDE.md) - MCP-integrasjon
- [../FEATURE_SUMMARY.md](../FEATURE_SUMMARY.md) - Funksjonsoversikt
- [../scripts/README.md](../scripts/README.md) - Lokal utvikling
