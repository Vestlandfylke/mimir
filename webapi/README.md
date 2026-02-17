# Mimir Backend (WebAPI)

Backend API-teneste for Mimir, bygd med .NET 10 og Semantic Kernel 1.68+.

## Kjøre lokalt

### Krav

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- Azure OpenAI-ressurs med deployments

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
       "ChatDeploymentName": "gpt-5.2-chat",
       "EmbeddingDeploymentName": "text-embedding-ada-002"
     }
   }
   ```

2. **Legg til API-nøkkel**

   ```bash
   dotnet user-secrets set "AzureOpenAI:Key" "DIN_NØKKEL"
   ```

3. **Bygg og kjør**

   ```bash
   dotnet build
   dotnet run
   ```

   Backend køyrer på `https://localhost:40443`. Verifiser med `/healthz`.

## Konfigurasjon (appsettings.json)

### AI-modellar

```json
"Models": {
  "DefaultModelId": "gpt-5.2-chat",
  "AvailableModels": [
    {
      "Id": "gpt-5.2-chat",
      "DisplayName": "GPT-5.2 Chat",
      "Provider": "AzureOpenAI",
      "Deployment": "gpt-5.2-chat",
      "Endpoint": "https://...",
      "Enabled": true,
      "SupportsReasoning": false
    }
  ]
}
```

Støtta providers: `AzureOpenAI`, `AzureAnthropic`, `OpenAI`, `AzureAIFoundry`.

### Rask modell (intent-ekstraksjon)

```json
"FastModel": {
  "Enabled": true,
  "Deployment": "gpt-4o-mini"
}
```

Brukar ein lettare modell for raske oppgåver medan hovudmodellen brukas for svar.

### Rate Limiting

```json
"RateLimiting": {
  "Enabled": true,
  "MessagesPerMinute": 20,
  "MessagesPerHour": 200,
  "ConcurrentRequestsPerUser": 5,
  "GlobalRequestsPerMinute": 1000
}
```

### Autentisering

```json
"Authentication": {
  "Type": "AzureAd",
  "AzureAd": {
    "Instance": "https://login.microsoftonline.com",
    "TenantId": "DIN_TENANT_ID",
    "ClientId": "DIN_CLIENT_ID",
    "Audience": "api://din-app-id",
    "Scopes": "access_as_user"
  }
}
```

### Plugins

#### SharePoint OBO

```json
"SharePointObo": {
  "Enabled": true,
  "TenantId": "DIN_TENANT",
  "ClientId": "DIN_CLIENT",
  "SiteUrl": "https://tenant.sharepoint.com/sites/Side",
  "AllowedSites": ["https://tenant.sharepoint.com/sites/Side1"],
  "DefaultScopes": "https://graph.microsoft.com/Sites.Read.All https://graph.microsoft.com/Files.Read.All"
}
```

ClientSecret via user-secrets: `dotnet user-secrets set "SharePointObo:ClientSecret" "HEMMELEG"`

#### Lovdata

```json
"Lovdata": {
  "Enabled": true,
  "BaseUrl": "https://lovdata.no/api/",
  "ApiKey": ""
}
```

Fungerer utan API-nøkkel med avgrensa funksjonalitet (vanlege lovtilvisingar, direktelenker).

#### LeiarKontekst (leiardokument)

```json
"LeiarKontekst": {
  "SearchEndpoint": "https://din-ai-search.search.windows.net",
  "IndexName": "leiar-index",
  "SemanticConfigurationName": "din-semantic-config"
}
```

ApiKey via user-secrets: `dotnet user-secrets set "LeiarKontekst:ApiKey" "NØKKEL"`

#### MimirKnowledge (kunnskapsbase)

```json
"MimirKnowledge": {
  "SearchEndpoint": "https://din-ai-search.search.windows.net",
  "IndexName": "mimir-knowledge-index",
  "SemanticConfigurationName": "din-semantic-config"
}
```

#### Filgenerering

```json
"FileGeneration": {
  "TemplatesPath": "templates",
  "DefaultExpirationHours": 168
}
```

Malar ligg i `webapi/templates/` (Word og PowerPoint). Genererte filer lagrast i CosmosDB.

### MCP-serverar

```json
"McpServers": {
  "PlanApprovalMode": "PerServer",
  "Servers": [{
    "Name": "MittVerktøy",
    "Transport": "Http",
    "Url": "http://localhost:8002/mcp",
    "Enabled": true,
    "Templates": ["min-mal"],
    "RequireApproval": true
  }]
}
```

### Assistentmalar

```json
"Prompts": {
  "Templates": {
    "leiar": {
      "DisplayName": "Leiar-assistent",
      "Enabled": true,
      "AllowedGroups": ["gruppe-id"],
      "SystemDescription": "Systemprompt..."
    }
  }
}
```

## Arkitektur

### Hovudkomponentar

- **Controllers** — REST API (ChatController, FileDownloadController)
- **Plugins/Chat** — ChatPlugin, LeiarKontekstPlugin, SharePointOboPlugin, LovdataPlugin, MimirKnowledgePlugin
- **Plugins/FileGeneration** — FileGenerationPlugin, TemplateService, PptxLayoutService, MarkdownToOpenXmlConverter
- **Services** — SemanticKernelProvider, PluginCitationService, DownloadTokenService, PiiSanitizationService
- **Storage** — CosmosDB-repositories for samtalar, meldingar, arkiv og filer

### Plugin-sitat

`PluginCitationService` samlar sitat frå alle plugins under chat-streaming. Kvar sitat har:
- Dokumenttittel, kjelde-URL, utdrag, relevans-score
- `SourceType` for å skilje mellom "Kunnskapsbase", "Leiardokument", "Lovdata", "SharePoint", "Opplasta dokument"

Sitat mergast etter streaming og sendast til frontend via SignalR.

### Filnedlasting (mobil/Teams)

`DownloadTokenService` genererer korttids eingongstoken for filnedlasting. Mobilklientar brukar `window.open(url?dt=token)` i staden for blob-nedlasting som ikkje fungerer i WebViews.

## API-endepunkt

### Chat

- `POST /chats` — opprett ny chat
- `GET /chats/{chatId}` — hent chat
- `POST /chats/{chatId}/messages` — send melding
- `DELETE /chats/{chatId}` — arkiver chat

### Filer

- `GET /files/{fileId}/{filename}` — last ned fil
- `GET /files/my` — mine genererte filer
- `POST /files/{fileId}/download-token` — generer nedlastingstoken (for mobil)
- `DELETE /files/{fileId}` — slett fil
- `GET /chats/{chatId}/files` — filer i ein chat

### Dokument

- `POST /chats/{chatId}/documents` — last opp dokument
- `GET /chats/{chatId}/documents` — dokumentliste

## Utvikling

```bash
# Bygg
dotnet build

# Køyr testar
dotnet test

# Start med hot reload
dotnet watch run
```

## Deployment

Backend deployast til Azure App Service. Sjå [../scripts/deploy/README.md](../scripts/deploy/README.md).
