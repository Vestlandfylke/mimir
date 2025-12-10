# Production Configuration Checklist

This document lists all the settings that should be configured in the production Azure WebAPI.

## 📋 Current Production Settings

Run `scripts/update-production-config.ps1` to apply all of these settings at once.

### ⚡ FastModel Settings
Performance optimization using a faster model for extraction tasks.

```json
"FastModel": {
  "Enabled": true,
  "Deployment": "gpt-4o-mini"
}
```

**Azure App Settings:**
- `FastModel__Enabled` = `"true"`
- `FastModel__Deployment` = `"gpt-4o-mini"`

**Benefit:** Faster response times for intent extraction, audience detection, and other quick tasks.

---

### 🔧 Service Settings
Plugin directory configuration.

```json
"Service": {
  "SemanticPluginsDirectory": "./Plugins/SemanticPlugins",
  "NativePluginsDirectory": "./Plugins/NativePlugins"
}
```

**Azure App Settings:**
- `Service__SemanticPluginsDirectory` = `"./Plugins/SemanticPlugins"`
- `Service__NativePluginsDirectory` = `"./Plugins/NativePlugins"`

---

### 🔐 MCP Server Settings
Model Context Protocol configuration with approval requirements.

```json
"McpServers": {
  "PlanApprovalMode": "PerServer",
  "Servers": [
    {
      "Name": "CustomMcpServer",
      "Url": "https://mcp-bridge-url/mcp",
      "Enabled": true,
      "TimeoutSeconds": 120,
      "RequireApproval": true,
      "Description": "Klarspråk MCP server - provides text analysis and simplification tools",
      "Templates": ["klarsprak"]
    }
  ]
}
```

**Azure App Settings:**
- `McpServers__PlanApprovalMode` = `"PerServer"`
- `McpServers__Servers__0__Name` = `"CustomMcpServer"`
- `McpServers__Servers__0__Url` = `"https://[bridge-url]/mcp"` (set by deployment)
- `McpServers__Servers__0__Enabled` = `"true"`
- `McpServers__Servers__0__TimeoutSeconds` = `"120"`
- `McpServers__Servers__0__RequireApproval` = `"true"`
- `McpServers__Servers__0__Description` = `"Klarspråk MCP server - provides text analysis and simplification tools"`
- `McpServers__Servers__0__Templates__0` = `"klarsprak"`

**Critical:** Without these settings, MCP tools execute automatically without user approval! 🚨

---

### 📄 Document Memory Settings
Configuration for document import and chunking.

```json
"DocumentMemory": {
  "DocumentLineSplitMaxTokens": 72,
  "DocumentChunkMaxTokens": 512,
  "FileSizeLimit": 10000000,
  "FileCountLimit": 20
}
```

**Azure App Settings:**
- `DocumentMemory__DocumentLineSplitMaxTokens` = `"72"`
- `DocumentMemory__DocumentChunkMaxTokens` = `"512"`
- `DocumentMemory__FileSizeLimit` = `"10000000"` (10 MB)
- `DocumentMemory__FileCountLimit` = `"20"`

---

## 🚀 How to Apply These Settings

### Option 1: Run the Update Script (Recommended)

```powershell
cd scripts
.\update-production-config.ps1
```

This will:
1. Update all missing settings in Azure WebAPI
2. Restart the application
3. Verify the settings were applied

### Option 2: Manual Configuration

Go to Azure Portal → App Services → `app-copichat-4kt5uxo2hrzri-webapi` → Configuration → Application settings

Add each setting manually.

### Option 3: Automatic via GitHub Actions

These settings are now included in `.github/workflows/mimir-deploy-production.yml` and will be automatically applied on future deployments.

---

## ✅ Verification

After applying settings, verify they're working:

1. **FastModel:** 
   - Check logs for "Using fast model for extraction"
   - Response times should be faster for non-chat interactions

2. **MCP Approval:**
   - Go to https://mimir.vlfk.no
   - Open Klarspråk assistant
   - Use any MCP tool (e.g., text analysis)
   - **You should see an approval prompt** ✅

3. **Document Memory:**
   - Try uploading a document
   - Verify size limits are enforced

---

## 🔄 Settings Status

| Setting | Configured in appsettings.json | Deployed to Production | Auto-deployed by CI/CD |
|---------|-------------------------------|------------------------|----------------------|
| FastModel | ✅ | ⚠️ Run script | ✅ Future deployments |
| Service directories | ✅ | ⚠️ Run script | ✅ Future deployments |
| MCP PlanApprovalMode | ✅ | ⚠️ Run script | ✅ Future deployments |
| MCP RequireApproval | ✅ | ⚠️ Run script | ✅ Future deployments |
| DocumentMemory | ✅ | ⚠️ Run script | ✅ Future deployments |

**⚠️ Action Required:** Run `scripts/update-production-config.ps1` to sync production with your local configuration!

---

## 📝 Notes

- **appsettings.json is NOT deployed** - Azure App Services use Configuration → Application settings instead
- Settings in Azure override settings in appsettings.json
- Always update both appsettings.json AND the deployment workflow when adding new features
- Use double underscores (`__`) in Azure setting names to represent JSON hierarchy

---

## 🔍 Troubleshooting

### How to check current production settings:

```powershell
az webapp config appsettings list `
    --resource-group rg-sk-copilot-npi `
    --name app-copichat-4kt5uxo2hrzri-webapi `
    --output table
```

### How to check a specific setting:

```powershell
az webapp config appsettings list `
    --resource-group rg-sk-copilot-npi `
    --name app-copichat-4kt5uxo2hrzri-webapi `
    --query "[?name=='FastModel__Enabled'].value" `
    --output tsv
```

### If MCP tools still auto-execute:

1. Verify `McpServers__PlanApprovalMode` = `"PerServer"`
2. Verify `McpServers__Servers__0__RequireApproval` = `"true"`
3. Restart the WebAPI
4. Clear browser cache

---

Last updated: December 2024

