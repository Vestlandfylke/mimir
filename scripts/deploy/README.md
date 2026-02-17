# Deploying Mimir to Azure

Denne guiden dekker deployment av Mimir sine ressursar til Azure.

## Krav

- [Azure CLI](https://aka.ms/installazurecliwindows) (oppdatert til nyaste versjon)
- [Azure AD Tenant](https://learn.microsoft.com/azure/active-directory/develop/quickstart-create-new-tenant)
- Azure OpenAI-ressurs med modell-deployments
- (Linux) `zip`: `sudo apt install zip`

## App-registreringar (Azure AD)

Du treng to app-registreringar — ein for frontend og ein for backend.

### Frontend

- Plattformtype: **Single-page application (SPA)**
- Redirect URI: `http://localhost:3000` (og produksjons-URL)
- Kontotype: Berre denne organisasjonen (single tenant)
- Noter **Application (client) ID**

### Backend

- Ingen redirect URI
- Kontotype: Berre denne organisasjonen (single tenant)
- Noter **Application (client) ID**

### Kople frontend til backend

1. I backend-registreringa: **Expose an API** → legg til Application ID URI
2. Legg til scope `access_as_user`
3. Legg til frontend sin client ID som autorisert klientapplikasjon
4. I frontend-registreringa: **API Permissions** → legg til backend sin `access_as_user`-tilgang

For Teams SSO, sett Application ID URI til `api://mimir.vlfk.no/{backend-client-id}`.

## Deploy Azure-infrastruktur

### PowerShell

```powershell
./deploy-azure.ps1 `
  -Subscription {SUBSCRIPTION_ID} `
  -DeploymentName {DEPLOYMENT_NAME} `
  -AIService AzureOpenAI `
  -AIApiKey {API_KEY} `
  -AIEndpoint {AZURE_OPENAI_ENDPOINT} `
  -BackendClientId {BACKEND_APP_ID} `
  -FrontendClientId {FRONTEND_APP_ID} `
  -TenantId {TENANT_ID}
```

### Bash

```bash
./deploy-azure.sh \
  --subscription {SUBSCRIPTION_ID} \
  --deployment-name {DEPLOYMENT_NAME} \
  --ai-service AzureOpenAI \
  --ai-service-key {API_KEY} \
  --ai-endpoint {AZURE_OPENAI_ENDPOINT} \
  --client-id {BACKEND_APP_ID} \
  --frontend-client-id {FRONTEND_APP_ID} \
  --tenant-id {TENANT_ID}
```

### Bicep-malen (main.bicep)

Malen oppretter:

| Ressurs | Skildring |
|---------|-----------|
| App Service + Plan | Backend API og statisk frontend |
| Cosmos DB | Samtalar, meldingar, arkiv, genererte filer |
| Azure AI Search | Vektorindeks for semantisk søk |
| Blob Storage | Dokumentlagring |
| Application Insights | Telemetri og logging |
| Front Door + WAF | Valfritt — tryggleik og CDN |

### Front Door + WAF (valfritt)

For å beskytte mot skannarar, bot-åtak og DDoS:

```powershell
az deployment group create `
  --resource-group {RG_NAME} `
  --template-file main.bicep `
  --parameters deployFrontDoor=true name=copichat
```

Sjå [FRONTDOOR-WAF-SETUP.md](FRONTDOOR-WAF-SETUP.md) for komplett guide.

## Deploy applikasjon

### PowerShell

```powershell
# Pakk backend
./package-webapi.ps1

# Deploy backend
./deploy-webapi.ps1 -Subscription {SUB_ID} -ResourceGroupName {RG_NAME} -DeploymentName {NAME}
```

### Bash

```bash
./package-webapi.sh
./deploy-webapi.sh --subscription {SUB_ID} --resource-group {RG_NAME} --deployment-name {NAME}
```

## Deploy Memory Pipeline (valfritt)

Berre nødvendig om `KernelMemory:DataIngestion:OrchestrationType` er sett til `Distributed`.

```powershell
.\package-memorypipeline.ps1
.\deploy-memorypipeline.ps1 -Subscription {SUB_ID} -ResourceGroupName {RG_NAME} -DeploymentName {NAME}
```

## Etter deployment

### Konfigurasjon via App Settings

Viktige innstillingar som må settast i Azure App Service → Configuration:

```
# AI-modellar
Models__DefaultModelId=gpt-5.2-chat
Models__AvailableModels__0__Id=gpt-5.2-chat
Models__AvailableModels__0__Provider=AzureOpenAI
Models__AvailableModels__0__Deployment=gpt-5.2-chat
Models__AvailableModels__0__Endpoint=https://...

# Autentisering
Authentication__Type=AzureAd
Authentication__AzureAd__TenantId=...
Authentication__AzureAd__ClientId=...

# Plugins
SharePointObo__Enabled=true
SharePointObo__ClientSecret=...

# MCP (valfritt)
McpServers__Servers__0__Url=https://mcp-server.azurecontainerapps.io/mcp
McpServers__Servers__0__Enabled=true

# Assistentmalar
Prompts__Templates__leiar__Enabled=true
Prompts__Templates__leiar__AllowedGroups__0=gruppe-id
```

### CosmosDB-behaldarar

Desse behaldarane må eksistere (opprettast automatisk av Bicep):

| Behaldar | Partition Key | Bruk |
|----------|--------------|------|
| `chatsessions` | `/id` | Aktive samtalar |
| `chatmessages` | `/chatId` | Meldingar |
| `chatparticipants` | `/chatId` | Deltakarar |
| `chatmemorysources` | `/chatId` | Dokumentkjelder |
| `archivedchatsessions` | `/deletedBy` | Arkiverte samtalar |
| `archivedchatmessages` | `/originalChatId` | Arkiverte meldingar |
| `archivedchatparticipants` | `/originalChatId` | Arkiverte deltakarar |
| `archivedmemorysources` | `/chatId` | Arkiverte kjelder |
| `generatedfiles` | `/chatId` | Genererte filer |

### CORS

Legg til frontend-URL i CORS om du brukar eige domene:

```powershell
az webapp cors add --name {APP_NAME} --resource-group {RG_NAME} --allowed-origins https://mimir.vlfk.no
```

## Feilsøking

| Problem | Løysing |
|---------|---------|
| 503 etter Front Door | Sjekk at App Service køyrer og `/healthz` returnerer 200 |
| Auth-feil etter deployment | Sjekk redirect URIs i app-registreringar |
| SignalR/WebSocket-problem | Aktiver Web sockets i App Service → Configuration |
| Filnedlasting feiler på mobil | Oppdater til nyaste versjon med token-basert nedlasting |
