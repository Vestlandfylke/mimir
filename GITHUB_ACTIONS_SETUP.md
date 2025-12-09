# GitHub Actions Setup - Mimir (Existing Resources)

## 🎯 Mål
Sette opp GitHub Actions for automatisk deployment til **eksisterande** Azure-ressursar (INGEN rename).

---

## 📋 Oversikt over eksisterande ressursar

| Type | Navn |
|------|------|
| Resource Group | `RG-SK-Copilot-NPI` |
| App Service (Backend) | `app-copichat-4kt5uxo2hrzri-webapi` |
| App Service (Memory Pipeline) | `app-copichat-4kt5uxo2hrzri-memorypipeline` |
| Cosmos DB | `cosmos-copichat-4kt5uxo2hrzri` |
| Storage Account | `st4kt5uxo2hrzri` |
| Search Service | `acs-copichat-4kt5uxo2hrzri` |
| SignalR | `signalr-mimir-prod` |
| MCP Bridge | (må deployast) |

---

## 🔧 Steg 1: Opprett Azure Service Principal

Dette gir GitHub Actions tilgang til å deploye til Azure.

```bash
# Erstatt med din Subscription ID
SUBSCRIPTION_ID="7f0cd1ae-9586-4d17-8093-8746bafbdc5a"

az ad sp create-for-rbac \
  --name "github-actions-mimir" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/RG-SK-Copilot-NPI \
  --json-auth

# KOPIER OUTPUT - du treng det i neste steg!
```

**Output ser omtrent slik ut:**
```json
{
  "clientId": "abc123...",
  "clientSecret": "xyz789...",
  "subscriptionId": "7f0cd1ae-9586-4d17-8093-8746bafbdc5a",
  "tenantId": "def456...",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  ...
}
```

---

## 🔑 Steg 2: Legg til GitHub Secrets

Gå til: **GitHub Repository → Settings → Secrets and variables → Actions → Secrets**

Klikk **New repository secret** for kvar av desse:

### Secrets (hemmelege verdiar)

| Namn | Verdi | Kommentar |
|------|-------|-----------|
| `AZURE_CREDENTIALS` | (Heile JSON-output frå steg 1) | Full auth-info |
| `AZURE_OPENAI_API_KEY` | (Finn i Azure Portal) | Azure OpenAI key |
| `AZURE_COSMOS_CONNECTION_STRING` | (Finn i Cosmos DB → Keys) | Cosmos DB tilkopling |
| `AZURE_STORAGE_CONNECTION_STRING` | (Finn i Storage Account → Access keys) | Storage tilkopling |

**Korleis finne verdiane:**
```bash
# Azure OpenAI Key
az cognitiveservices account keys list \
  --name <openai-name> \
  --resource-group <openai-rg> \
  --query key1 -o tsv

# Cosmos DB Connection String
az cosmosdb keys list \
  --name cosmos-copichat-4kt5uxo2hrzri \
  --resource-group RG-SK-Copilot-NPI \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" -o tsv

# Storage Connection String
az storage account show-connection-string \
  --name st4kt5uxo2hrzri \
  --resource-group RG-SK-Copilot-NPI \
  --query connectionString -o tsv
```

---

## 📊 Steg 3: Legg til GitHub Variables

Gå til: **GitHub Repository → Settings → Secrets and variables → Actions → Variables**

Klikk **New repository variable** for kvar av desse:

### Variables (ikkje-hemmelege verdiar)

| Namn | Verdi | Kommentar |
|------|-------|-----------|
| `AZURE_SUBSCRIPTION_ID` | `7f0cd1ae-9586-4d17-8093-8746bafbdc5a` | Din subscription ID |
| `AZURE_GITHUB_ACCESS_APP_ID` | (clientId frå steg 1) | Service Principal ID |
| `AZURE_GITHUB_ACCESS_TENANT_ID` | (tenantId frå steg 1) | Tenant ID |
| `AZURE_GITHUB_ACCESS_SUB_ID` | `7f0cd1ae-9586-4d17-8093-8746bafbdc5a` | Same som AZURE_SUBSCRIPTION_ID |
| `CC_DEPLOYMENT_GROUP_NAME` | `RG-SK-Copilot-NPI` | Resource group namn |
| `CC_DEPLOYMENT_NAME` | `mimir-prod` | Deployment prefix |
| `CC_DEPLOYMENT_REGION` | `swedencentral` | Azure region |
| `AZURE_OPENAI_NAME` | (Namnet på OpenAI-ressursen) | T.d. `openai-vlfk` |
| `AZURE_OPENAI_ENDPOINT` | `https://<name>.openai.azure.com/` | Full endpoint URL |
| `AZURE_OPENAI_DEPLOYMENT` | `gpt-4o` | Deployment name for main model |
| `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` | `text-embedding-ada-002` | Embedding model name |
| `AZUREOPENAI_DEPLOYMENT_GROUP_NAME` | (RG for OpenAI, same som CC_DEPLOYMENT_GROUP_NAME?) | Resource group for OpenAI |
| `BACKEND_CLIENT_ID` | (Finn i Azure AD App Registration) | Backend app client ID |
| `APPLICATION_CLIENT_ID` | (Finn i Azure AD App Registration) | Frontend app client ID |
| `APPLICATION_TENANT_ID` | (tenantId) | Same som AZURE_GITHUB_ACCESS_TENANT_ID |
| `AZURE_INSTANCE` | `https://login.microsoftonline.com` | Azure AD instance |
| `WEBAPP_API_SKU` | `P2V3` | App Service SKU |

---

## 🔌 Steg 4: Deploy MCP Bridge

MCP Bridge må deployast til Azure. Du har to alternativ:

### Alternativ A: Azure Container Apps (anbefalt)

```bash
# Opprett Container App Environment
az containerapp env create \
  --name mimir-mcp-env \
  --resource-group RG-SK-Copilot-NPI \
  --location swedencentral

# Deploy MCP Bridge
cd D:\mimir_experimental\mimir\mcp-bridge

az containerapp up \
  --name mcp-bridge-mimir \
  --resource-group RG-SK-Copilot-NPI \
  --environment mimir-mcp-env \
  --source . \
  --target-port 8002 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1.0Gi

# Få URL
az containerapp show \
  --name mcp-bridge-mimir \
  --resource-group RG-SK-Copilot-NPI \
  --query properties.configuration.ingress.fqdn -o tsv
```

### Alternativ B: Azure App Service

```bash
# Opprett App Service (Python)
az webapp create \
  --name mcp-bridge-mimir \
  --resource-group RG-SK-Copilot-NPI \
  --plan asp-copichat-4kt5uxo2hrzri \
  --runtime "PYTHON:3.11"

# Deploy kode
cd D:\mimir_experimental\mimir\mcp-bridge
az webapp up \
  --name mcp-bridge-mimir \
  --resource-group RG-SK-Copilot-NPI \
  --runtime "PYTHON:3.11"
```

---

## ⚙️ Steg 5: Oppdater WebAPI Configuration

Legg til MCP Bridge URL i App Service Configuration:

**Azure Portal:**
1. Gå til **App Service → app-copichat-4kt5uxo2hrzri-webapi**
2. **Configuration → Application settings**
3. Legg til/oppdater:

```
McpServers__Servers__0__Url = https://mcp-bridge-mimir.azurecontainerapps.io/mcp
McpServers__Servers__0__Name = CustomMcpServer
McpServers__Servers__0__Enabled = true
McpServers__Servers__0__TimeoutSeconds = 120

Cosmos__GeneratedFilesContainer = generatedfiles
```

**Via Azure CLI:**
```bash
WEBAPP_NAME="app-copichat-4kt5uxo2hrzri-webapi"
MCP_URL="https://mcp-bridge-mimir.azurecontainerapps.io"

az webapp config appsettings set \
  --resource-group RG-SK-Copilot-NPI \
  --name $WEBAPP_NAME \
  --settings \
    McpServers__Servers__0__Url="${MCP_URL}/mcp" \
    McpServers__Servers__0__Name="CustomMcpServer" \
    McpServers__Servers__0__Enabled="true" \
    Cosmos__GeneratedFilesContainer="generatedfiles"
```

---

## 📦 Steg 6: Opprett Cosmos DB Container

Opprett `generatedfiles` container for file download feature:

```bash
az cosmosdb sql container create \
  --resource-group RG-SK-Copilot-NPI \
  --account-name cosmos-copichat-4kt5uxo2hrzri \
  --database-name CopilotChat \
  --name generatedfiles \
  --partition-key-path "/chatId" \
  --throughput 400
```

---

## 🚀 Steg 7: Test GitHub Actions

### 7.1 Commit og push

```bash
cd D:\mimir_experimental\mimir

git add .
git commit -m "Setup GitHub Actions deployment"
git push origin main
```

### 7.2 Trigger manuelt (første gong)

1. Gå til **GitHub → Actions**
2. Velg **copilot-deploy-backend** (eller ny workflow)
3. Klikk **Run workflow**
4. Velg `main` branch
5. Klikk **Run workflow**

### 7.3 Monitor deployment

Følg med på:
- GitHub Actions logs
- Azure Portal → App Service → Deployment Center

---

## ✅ Verifiser at alt fungerer

```bash
# Test backend
curl https://app-copichat-4kt5uxo2hrzri-webapi.azurewebsites.net/healthz

# Test MCP bridge
curl https://mcp-bridge-mimir.azurecontainerapps.io/health

# Test frontend
# Open i nettlesar
```

---

## 📋 Sjekkliste

- [ ] Opprett Azure Service Principal
- [ ] Legg til GitHub Secrets (4 stk)
- [ ] Legg til GitHub Variables (17 stk)
- [ ] Deploy MCP Bridge (Container App eller App Service)
- [ ] Oppdater WebAPI Configuration med MCP URL
- [ ] Opprett `generatedfiles` Cosmos DB container
- [ ] Commit og push endringer
- [ ] Test GitHub Actions deployment
- [ ] Verifiser at alle funksjonar fungerer:
  - [ ] Chat
  - [ ] Filnedlasting
  - [ ] Pinned documents
  - [ ] Matematikk-rendering
  - [ ] MCP tools (klarspråk)

---

## 🔧 Troubleshooting

### Problem: GitHub Actions feiler med auth error
```bash
# Verifiser Service Principal
az ad sp list --display-name "github-actions-mimir"

# Sjekk permissions
az role assignment list --assignee <service-principal-id>
```

### Problem: MCP Bridge connection feiler
1. Sjekk at Container App er running
2. Verifiser ingress er external
3. Test URL direkte: `curl https://mcp-bridge-mimir.azurecontainerapps.io/health`
4. Sjekk logs: `az containerapp logs show --name mcp-bridge-mimir --resource-group RG-SK-Copilot-NPI`

### Problem: Cosmos DB connection feiler
```bash
# Test connection string
az cosmosdb keys list \
  --name cosmos-copichat-4kt5uxo2hrzri \
  --resource-group RG-SK-Copilot-NPI \
  --type connection-strings
```

---

## 📚 Neste Steg

1. **Automatisering**: Konfigurer automatic deployment på push til `main`
2. **Staging**: Sett opp staging environment
3. **Monitoring**: Konfigurer alerts i Application Insights
4. **Backup**: Sett opp automatisk backup av Cosmos DB

---

🎉 **GitHub Actions er no konfigurert!**

