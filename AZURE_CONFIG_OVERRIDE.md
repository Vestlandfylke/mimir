# Azure Environment Variables to Add - IMMEDIATE FIX

## Problem Identified
Your Cosmos DB is configured correctly ✅, but KernelMemory is still using file-based storage which causes crashes with concurrent users.

## Solution: Override in Azure App Settings

Add these environment variables to your Azure App Service. Since you already have Cosmos working, you just need to fix the KernelMemory configuration.

---

## Option 1: If You Have Azure Storage Account + Azure AI Search (RECOMMENDED)

Add these to your Azure App Service → Settings → Environment variables:

```
KernelMemory__DocumentStorageType=AzureBlobs
KernelMemory__DataIngestion__DistributedOrchestration__QueueType=AzureQueue
KernelMemory__DataIngestion__MemoryDbTypes__0=AzureAISearch
KernelMemory__Retrieval__MemoryDbType=AzureAISearch
KernelMemory__Services__AzureBlobs__ConnectionString=<your-storage-connection-string>
KernelMemory__Services__AzureQueue__ConnectionString=<your-storage-connection-string>
KernelMemory__Services__AzureAISearch__Endpoint=<your-search-endpoint>
KernelMemory__Services__AzureAISearch__APIKey=<your-search-api-key>
```

---

## Option 2: If You DON'T Have Azure Resources Yet (QUICK FIX)

**Change to In-Process orchestration** (no queues needed, but less scalable):

Add these to Azure App Service:

```
KernelMemory__DataIngestion__OrchestrationType=InProcess
KernelMemory__Retrieval__MemoryDbType=Volatile
```

⚠️ **Note**: This stores vector data in memory. It will work for testing but you'll lose document embeddings on restart.

---

## Detailed Steps to Add Environment Variables in Azure Portal

1. Go to your Azure App Service: `app-copichat-4kt5uxo2hrzri-webapi`
2. Click **Settings** → **Environment variables** (you're already there in your screenshot)
3. Click **+ Add** button
4. For each variable above:
   - Enter the **Name** (e.g., `KernelMemory__DocumentStorageType`)
   - Enter the **Value** (e.g., `AzureBlobs`)
   - Set **Deployment slot setting**: Leave unchecked
   - Click **Apply**
5. After adding all variables, click **Apply** at the bottom
6. **Restart** your app service

---

## How to Get the Required Azure Resources

### If You Need to Create Azure Storage Account:

```bash
# Create storage account (if you don't have one)
az storage account create \
  --name mimirstorage<random> \
  --resource-group <your-resource-group> \
  --location swedencentral \
  --sku Standard_LRS

# Get connection string
az storage account show-connection-string \
  --name mimirstorage<random> \
  --resource-group <your-resource-group> \
  --query connectionString --output tsv

# Create container
az storage container create \
  --name memorypipeline \
  --account-name mimirstorage<random> \
  --connection-string "<connection-string>"
```

### If You Need to Create Azure AI Search:

```bash
# Create Azure AI Search
az search service create \
  --name mimir-search-<random> \
  --resource-group <your-resource-group> \
  --location swedencentral \
  --sku basic

# Get admin key
az search admin-key show \
  --service-name mimir-search-<random> \
  --resource-group <your-resource-group>
```

---

## Quick Test After Configuration

After making these changes and restarting:

1. Check the app logs:
   ```bash
   az webapp log tail --name app-copichat-4kt5uxo2hrzri-webapi --resource-group <your-rg>
   ```

2. Look for:
   - ✅ "Using Cosmos DB for chat storage"
   - ✅ "Using Azure Blobs for document storage" (or similar)
   - ❌ Any errors mentioning "SimpleVectorDb" or file access issues

3. Test with a few users logging in simultaneously

---

## Additional Configurations (After Fixing Storage)

Once the storage is fixed, you should also add these for better performance:

### 1. Add Request Timeout
```
Service__TimeoutLimitInS=120
```

### 2. Configure App Service Scale-Out
- Go to **Settings** → **Scale out (App Service plan)**
- Set minimum instances: 2
- Set maximum instances: 5
- Enable auto-scale rules based on CPU (scale out at 70%)

### 3. Enable Always On
- Go to **Settings** → **Configuration** → **General settings**
- Set **Always On**: On

---

## Monitoring After Changes

After deploying these changes, monitor:

1. **Application Insights** → **Failures**
   - Should see decrease in errors

2. **Application Insights** → **Performance**
   - Check response times under load

3. **App Service** → **Diagnose and solve problems** → **Availability and Performance**
   - Check for crashes

---

## Cost Estimate for Required Resources

If you need to add Azure Storage + AI Search:

- **Azure Storage Account (Standard LRS)**: ~$1-2/month for small usage
- **Azure AI Search (Basic tier)**: ~$75/month
- **Alternative**: Use Qdrant (free tier) or keep in-memory for testing

---

## Summary: What to Do RIGHT NOW

**OPTION A - If you have Azure Storage + AI Search:**
1. Add the environment variables from "Option 1" above
2. Restart the app service
3. Test with multiple users

**OPTION B - If you DON'T have resources yet:**
1. Add the two environment variables from "Option 2" (InProcess mode)
2. Restart the app service
3. Test with multiple users
4. Plan to create Azure resources for production

**OPTION C - Create resources first (recommended for production):**
1. Create Azure Storage Account
2. Create Azure AI Search (Basic tier)
3. Add all environment variables from "Option 1"
4. Restart the app service
5. Test thoroughly

---

## Questions to Answer

Before you proceed, please tell me:

1. **Do you already have an Azure Storage Account?** (Look in your resource group)
2. **Do you have Azure AI Search / Cognitive Search?** (Look in your resource group)
3. **What's your budget/timeline?** 
   - Need immediate fix? → Use Option 2 (InProcess)
   - Can create resources? → Use Option 1 (Full Azure)

Let me know and I can help you implement the right solution!

