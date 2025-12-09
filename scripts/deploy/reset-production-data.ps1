<#
.SYNOPSIS
Reset all production data - Use with caution!

.DESCRIPTION
Deletes all data from:
- Cosmos DB (chats, messages, participants)
- Azure Blob Storage (uploaded documents)
- Azure Queue Storage (pending processing jobs)
- Azure AI Search (vector embeddings)

THIS WILL DELETE ALL USER DATA. USE ONLY IN BETA/TESTING.

.PARAMETER ResourceGroupName
Resource group containing your resources

.PARAMETER StorageAccountName
Storage account name (for blobs and queues)

.PARAMETER CosmosAccountName
Cosmos DB account name

.PARAMETER CosmosDatabaseName
Cosmos DB database name (default: CopilotChat)

.PARAMETER SearchServiceName
Azure AI Search service name

.PARAMETER ConfirmDelete
Required parameter - must be "YES-DELETE-ALL-DATA" to proceed

.EXAMPLE
.\reset-production-data.ps1 `
  -ResourceGroupName "RG-SK-Copilot-NPI" `
  -StorageAccountName "st4kt5uxo2hrzri" `
  -CosmosAccountName "cosmos-copichat-4kt5uxo2hrzri" `
  -SearchServiceName "acs-copichat-4kt5uxo2hrzri" `
  -ConfirmDelete "YES-DELETE-ALL-DATA"
#>

param(
  [Parameter(Mandatory)]
  [string]$ResourceGroupName,
    
  [Parameter(Mandatory)]
  [string]$StorageAccountName,
    
  [Parameter(Mandatory)]
  [string]$CosmosAccountName,
    
  [string]$CosmosDatabaseName = "CopilotChat",
    
  [Parameter(Mandatory)]
  [string]$SearchServiceName,
    
  [Parameter(Mandatory)]
  [string]$ConfirmDelete
)

# Safety check
if ($ConfirmDelete -ne "YES-DELETE-ALL-DATA") {
  Write-Host "❌ SAFETY CHECK FAILED" -ForegroundColor Red
  Write-Host ""
  Write-Host "This script will DELETE ALL USER DATA including:" -ForegroundColor Yellow
  Write-Host "  - All chat sessions and messages"
  Write-Host "  - All uploaded documents"
  Write-Host "  - All vector embeddings"
  Write-Host "  - All processing queues"
  Write-Host ""
  Write-Host "To proceed, run with: -ConfirmDelete 'YES-DELETE-ALL-DATA'" -ForegroundColor Yellow
  exit 1
}

Write-Host "⚠️  WARNING: DATA DELETION IN PROGRESS" -ForegroundColor Red -BackgroundColor Yellow
Write-Host ""

$ErrorActionPreference = "Continue"
$successCount = 0
$errorCount = 0

# =============================================================================
# 1. COSMOS DB - Delete all containers data
# =============================================================================
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "1. Cosmos DB: Deleting all chat data..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

$containers = @(
  "chatsessions",
  "chatmessages",
  "chatmemorysources",
  "chatparticipants"
)

foreach ($container in $containers) {
  Write-Host "  Deleting container: $container..." -NoNewline
  try {
    # Delete and recreate container to clear all data
    az cosmosdb sql container delete `
      --account-name $CosmosAccountName `
      --database-name $CosmosDatabaseName `
      --name $container `
      --resource-group $ResourceGroupName `
      --yes `
      2>&1 | Out-Null
        
    Start-Sleep -Seconds 2
        
    # Recreate container based on type
    $partitionKey = switch ($container) {
      "chatsessions" { "/id" }
      "chatmessages" { "/chatId" }
      "chatmemorysources" { "/chatId" }
      "chatparticipants" { "/userId" }
    }
        
    az cosmosdb sql container create `
      --account-name $CosmosAccountName `
      --database-name $CosmosDatabaseName `
      --name $container `
      --partition-key-path $partitionKey `
      --partition-key-version 2 `
      --resource-group $ResourceGroupName `
      --throughput 400 `
      2>&1 | Out-Null
        
    Write-Host " ✓" -ForegroundColor Green
    $successCount++
  }
  catch {
    Write-Host " ✗ Error: $_" -ForegroundColor Red
    $errorCount++
  }
}

# =============================================================================
# 2. BLOB STORAGE - Delete all document blobs
# =============================================================================
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "2. Blob Storage: Deleting all uploaded documents..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

$blobContainers = @(
  "memorypipeline",
  "chatmemory"
)

foreach ($blobContainer in $blobContainers) {
  Write-Host "  Checking container: $blobContainer..." -NoNewline
    
  # Check if container exists
  $containerExists = az storage container exists `
    --name $blobContainer `
    --account-name $StorageAccountName `
    --auth-mode login `
    --query "exists" `
    --output tsv 2>&1
    
  if ($containerExists -eq "true") {
    Write-Host ""
    Write-Host "    Deleting all blobs in $blobContainer..." -NoNewline
    try {
      # Delete all blobs in container
      az storage blob delete-batch `
        --source $blobContainer `
        --account-name $StorageAccountName `
        --auth-mode login `
        --output none 2>&1 | Out-Null
            
      Write-Host " ✓" -ForegroundColor Green
      $successCount++
    }
    catch {
      Write-Host " ✗ Error: $_" -ForegroundColor Red
      $errorCount++
    }
  }
  else {
    Write-Host " (not found, skipping)" -ForegroundColor Yellow
  }
}

# =============================================================================
# 3. QUEUE STORAGE - Clear all pending jobs
# =============================================================================
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "3. Queue Storage: Clearing all processing queues..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# List all queues
$queuesJson = az storage queue list `
  --account-name $StorageAccountName `
  --auth-mode login `
  --output json 2>&1

if ($queuesJson) {
  $queues = $queuesJson | ConvertFrom-Json
    
  if ($queues.Count -gt 0) {
    foreach ($queue in $queues) {
      Write-Host "  Clearing queue: $($queue.name)..." -NoNewline
      try {
        az storage queue clear `
          --name $queue.name `
          --account-name $StorageAccountName `
          --auth-mode login `
          --output none 2>&1 | Out-Null
                
        Write-Host " ✓" -ForegroundColor Green
        $successCount++
      }
      catch {
        Write-Host " ✗ Error: $_" -ForegroundColor Red
        $errorCount++
      }
    }
  }
  else {
    Write-Host "  No queues found" -ForegroundColor Yellow
  }
}

# =============================================================================
# 4. AZURE AI SEARCH - Delete all indexes
# =============================================================================
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "4. Azure AI Search: Deleting all vector indexes..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Get search admin key
$searchKey = az search admin-key show `
  --resource-group $ResourceGroupName `
  --service-name $SearchServiceName `
  --query "primaryKey" `
  --output tsv 2>&1

if ($searchKey) {
  # List indexes
  $indexListUrl = "https://$SearchServiceName.search.windows.net/indexes?api-version=2023-11-01"
  $headers = @{
    "api-key"      = $searchKey
    "Content-Type" = "application/json"
  }
    
  try {
    $indexes = Invoke-RestMethod -Uri $indexListUrl -Headers $headers -Method Get
        
    if ($indexes.value.Count -gt 0) {
      foreach ($index in $indexes.value) {
        Write-Host "  Deleting index: $($index.name)..." -NoNewline
        $deleteUrl = "https://$SearchServiceName.search.windows.net/indexes/$($index.name)?api-version=2023-11-01"
                
        try {
          Invoke-RestMethod -Uri $deleteUrl -Headers $headers -Method Delete | Out-Null
          Write-Host " ✓" -ForegroundColor Green
          $successCount++
        }
        catch {
          Write-Host " ✗ Error: $_" -ForegroundColor Red
          $errorCount++
        }
      }
    }
    else {
      Write-Host "  No indexes found" -ForegroundColor Yellow
    }
  }
  catch {
    Write-Host "  ✗ Error listing indexes: $_" -ForegroundColor Red
    $errorCount++
  }
}
else {
  Write-Host "  ✗ Could not retrieve search admin key" -ForegroundColor Red
  $errorCount++
}

# =============================================================================
# SUMMARY
# =============================================================================
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "DATA RESET COMPLETE" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "Results:" -ForegroundColor White
Write-Host "  ✓ Successful operations: $successCount" -ForegroundColor Green
if ($errorCount -gt 0) {
  Write-Host "  ✗ Failed operations: $errorCount" -ForegroundColor Red
}
Write-Host ""
Write-Host "Deleted data from:" -ForegroundColor White
Write-Host "  - Cosmos DB: All chat sessions, messages, and participants"
Write-Host "  - Blob Storage: All uploaded documents"
Write-Host "  - Queue Storage: All pending processing jobs"
Write-Host "  - Azure AI Search: All vector indexes"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Restart both services to clear any cached data:"
Write-Host "     az webapp restart --name app-copichat-4kt5uxo2hrzri-webapi --resource-group $ResourceGroupName"
Write-Host "     az webapp restart --name app-copichat-4kt5uxo2hrzri-memorypipeline --resource-group $ResourceGroupName"
Write-Host ""
Write-Host "  2. Test the application - it should start fresh with no existing data"
Write-Host ""
Write-Host "✅ Ready for fresh beta testing!" -ForegroundColor Green

