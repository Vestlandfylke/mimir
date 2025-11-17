# Fix for Local Development - Backend Not Starting

## Problem
The backend is failing to start because **user secrets are not configured**. The error log shows:
```
Backend failed to start after 5 retries.
```

This happens because the backend requires Azure OpenAI API keys that are not set in your local environment.

---

## Quick Fix - Configure User Secrets

You need to set up the user secrets for local development. Here's how:

### Step 1: Set Azure OpenAI Key

```powershell
# Navigate to webapi directory
cd webapi

# Set the Azure OpenAI API key (get this from your Azure Portal)
dotnet user-secrets set "KernelMemory:Services:AzureOpenAIText:APIKey" "YOUR_AZURE_OPENAI_KEY"
dotnet user-secrets set "KernelMemory:Services:AzureOpenAIEmbedding:APIKey" "YOUR_AZURE_OPENAI_KEY"
```

### Step 2: Verify Secrets Are Set

```powershell
dotnet user-secrets list
```

You should see output like:
```
KernelMemory:Services:AzureOpenAIText:APIKey = sk-...
KernelMemory:Services:AzureOpenAIEmbedding:APIKey = sk-...
```

### Step 3: Optional - Set Other Secrets (if needed)

```powershell
# If using Cosmos DB locally (optional - it defaults to volatile storage)
dotnet user-secrets set "ChatStore:Cosmos:ConnectionString" "YOUR_COSMOS_CONNECTION_STRING"

# If using Azure Blob Storage locally (optional - defaults to SimpleFileStorage)
dotnet user-secrets set "KernelMemory:Services:AzureBlobs:ConnectionString" "YOUR_STORAGE_CONNECTION_STRING"

# If using Azure Queue Storage locally (optional)
dotnet user-secrets set "KernelMemory:Services:AzureQueue:ConnectionString" "YOUR_STORAGE_CONNECTION_STRING"

# If using Azure AI Search locally (optional - defaults to SimpleVectorDb)
dotnet user-secrets set "KernelMemory:Services:AzureAISearch:APIKey" "YOUR_SEARCH_API_KEY"

# If using Azure AI Document Intelligence (optional)
dotnet user-secrets set "KernelMemory:Services:AzureAIDocIntel:APIKey" "YOUR_DOC_INTEL_KEY"

# If using Application Insights (optional)
dotnet user-secrets set "APPLICATIONINSIGHTS_CONNECTION_STRING" "YOUR_APP_INSIGHTS_CONNECTION_STRING"
```

---

## Alternative - Use Environment Variables

Instead of user secrets, you can set environment variables in PowerShell:

```powershell
# Set in current PowerShell session
$env:KernelMemory__Services__AzureOpenAIText__APIKey = "YOUR_AZURE_OPENAI_KEY"
$env:KernelMemory__Services__AzureOpenAIEmbedding__APIKey = "YOUR_AZURE_OPENAI_KEY"

# Then run the start script
.\scripts\Start.ps1
```

---

## How to Get Your Azure OpenAI Key

### From Azure Portal:

1. Go to **Azure Portal** (portal.azure.com)
2. Navigate to your **Azure OpenAI resource** (looks like it's `ao-ai-swecent`)
3. Click **Keys and Endpoint** in the left menu
4. Copy **KEY 1** or **KEY 2**

### From Azure CLI:

```powershell
# List your OpenAI resources
az cognitiveservices account list --query "[?kind=='OpenAI']" -o table

# Get keys for your resource
az cognitiveservices account keys list --name ao-ai-swecent --resource-group <your-resource-group>
```

---

## After Setting Secrets - Test the Backend

### Test Backend Only:

```powershell
cd webapi
dotnet run
```

You should see:
```
Building...
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: https://localhost:40443
info: Microsoft.Hosting.Lifetime[0]
      Application started.
```

Then open a browser and go to:
- https://localhost:40443/healthz

You should see: `Healthy`

---

## Run Full Application

After configuring secrets:

```powershell
# From the root directory
.\scripts\Start.ps1
```

This will:
1. Start the backend (webapi) in a new window
2. Wait for backend to be ready on port 40443
3. Start the frontend (webapp) in the current window

---

## Troubleshooting

### Issue 1: "Backend failed to start after 5 retries"

**Cause**: Backend isn't starting because of missing configuration or errors.

**Solution**:
1. Check the backend window for error messages
2. Verify user secrets are set: `cd webapi && dotnet user-secrets list`
3. Try running backend manually to see errors: `cd webapi && dotnet run`

### Issue 2: Backend starts but shows certificate warnings

**Cause**: Development certificate not trusted.

**Solution**:
```powershell
dotnet dev-certs https --trust
```
Then restart the backend.

### Issue 3: Frontend shows "Cannot connect to backend"

**Cause**: CORS or backend URL misconfigured.

**Solution**: 
Check that `webapp\.env` has:
```
REACT_APP_BACKEND_URI=https://localhost:40443/
```

### Issue 4: "The SSL connection could not be established"

**Cause**: Development SSL certificate issues.

**Solution**:
```powershell
# Remove existing cert
dotnet dev-certs https --clean

# Create new cert
dotnet dev-certs https --trust
```

---

## Configuration for Local vs Production

### For Local Development:
- Use **user secrets** for API keys
- Use **volatile** or **filesystem** storage (configured in appsettings.json)
- No need for full Azure resources

### For Azure Production:
- Use **Environment Variables** in Azure App Service
- Use **Cosmos DB** for chat storage
- Use **Azure Blobs + AI Search** for memory storage

---

## Quick Start Summary

**Minimum Configuration to Run Locally:**

```powershell
# 1. Set Azure OpenAI key
cd webapi
dotnet user-secrets set "KernelMemory:Services:AzureOpenAIText:APIKey" "YOUR_KEY"
dotnet user-secrets set "KernelMemory:Services:AzureOpenAIEmbedding:APIKey" "YOUR_KEY"

# 2. Trust development certificate (one-time)
dotnet dev-certs https --trust

# 3. Go back to root and start
cd ..
.\scripts\Start.ps1
```

That's it! The backend should start successfully and then the frontend will automatically start.

---

## What the Start Script Does

Looking at `Start.ps1`:

1. **Starts Backend** in a new PowerShell window
2. **Checks if backend is running** on port 40443 (tries 5 times, waits 5 seconds between attempts)
3. **If backend is ready**, starts the frontend in the current window
4. **If backend fails**, logs error and exits

The script reads the port from `webapp\.env` file:
```
REACT_APP_BACKEND_URI=https://localhost:40443/
```

---

## Need More Help?

Check the backend window for specific error messages. Common errors:

1. **"Unable to configure HTTPS"** → Run `dotnet dev-certs https --trust`
2. **"Missing configuration"** → Set user secrets
3. **"OpenAI API error"** → Check API key is valid
4. **"Port already in use"** → Kill existing process on port 40443

To kill existing backend process:
```powershell
Get-Process -Name "CopilotChatWebApi" -ErrorAction SilentlyContinue | Stop-Process
```

Or kill anything on port 40443:
```powershell
# Find process using port 40443
$port = 40443
$processId = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess
if ($processId) {
    Stop-Process -Id $processId -Force
}
```

---

## Configuration Files Reference

### For Backend:
- `webapi/appsettings.json` - Default configuration (for local dev)
- `webapi/appsettings.Development.json` - Development overrides
- User secrets - Sensitive keys (recommended for local)

### For Frontend:
- `webapp/.env` - Contains backend URL
- `webapp/.env.example` - Template

---

## Important Note About Your Code Changes

The Cosmos DB optimization changes you just made **only affect production** when Cosmos DB is configured. 

For **local development**, the app uses:
- `ChatStore:Type = "volatile"` (in-memory, from appsettings.json)
- `SimpleFileStorage`, `SimpleQueues`, `SimpleVectorDb` (file-based)

This is fine for testing locally! The important thing is that your Azure deployment has the proper configuration, which it does based on your screenshots.

