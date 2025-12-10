# Setup Azure SignalR Service
# This is the RECOMMENDED FIX for spinning/timeout issues

param(
    [string]$ResourceGroup = "rg-sk-copilot-npi",
    [string]$SignalRName = "signalr-mimir-prod",
    [string]$Location = "swedencentral",
    [string]$SKU = "Standard_S1", # Standard_S1 or Free_F1
    [string]$WebApiName = "app-copichat-4kt5uxo2hrzri-webapi",
    [string]$MemoryPipelineName = "app-copichat-4kt5uxo2hrzri-memorypipeline"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Azure SignalR Service" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nThis will fix the 'spinning forever' issue by using" -ForegroundColor Yellow
Write-Host "a dedicated SignalR service instead of local SignalR." -ForegroundColor Yellow

# Check if logged in
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "`n✗ Please log in to Azure first: az login" -ForegroundColor Red
    exit 1
}

Write-Host "`n✓ Logged in as: $($account.user.name)" -ForegroundColor Green

# Check if SignalR service already exists
Write-Host "`n[1/5] Checking if SignalR service exists..." -ForegroundColor Yellow

$existingSignalR = az signalr show `
    --name $SignalRName `
    --resource-group $ResourceGroup 2>$null | ConvertFrom-Json

if ($existingSignalR) {
    Write-Host "  ✓ SignalR service '$SignalRName' already exists" -ForegroundColor Green
    Write-Host "    SKU: $($existingSignalR.sku.name)" -ForegroundColor Gray
    Write-Host "    Endpoint: $($existingSignalR.hostName)" -ForegroundColor Gray
} else {
    Write-Host "  Creating SignalR service: $SignalRName" -ForegroundColor White
    Write-Host "  Location: $Location" -ForegroundColor Gray
    Write-Host "  SKU: $SKU" -ForegroundColor Gray
    
    if ($SKU -eq "Free_F1") {
        Write-Host "`n  ⚠ Using Free tier - has limitations:" -ForegroundColor Yellow
        Write-Host "    - Max 20 concurrent connections" -ForegroundColor Gray
        Write-Host "    - Max 20,000 messages per day" -ForegroundColor Gray
        Write-Host "    - Good for testing, upgrade to Standard for production" -ForegroundColor Gray
        
        $continue = Read-Host "`n  Continue with Free tier? (y/n)"
        if ($continue -ne "y") {
            Write-Host "  Aborted." -ForegroundColor Red
            exit 0
        }
    }
    
    Write-Host "`n  Creating... (this may take 2-3 minutes)" -ForegroundColor Gray
    
    az signalr create `
        --name $SignalRName `
        --resource-group $ResourceGroup `
        --location $Location `
        --sku $SKU `
        --unit-count 1 `
        --service-mode "Default"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n  ✗ Failed to create SignalR service" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  ✓ SignalR service created" -ForegroundColor Green
}

# Get connection string
Write-Host "`n[2/5] Getting SignalR connection string..." -ForegroundColor Yellow

$keys = az signalr key list `
    --name $SignalRName `
    --resource-group $ResourceGroup | ConvertFrom-Json

$connectionString = $keys.primaryConnectionString

if (-not $connectionString) {
    Write-Host "  ✗ Failed to get connection string" -ForegroundColor Red
    exit 1
}

Write-Host "  ✓ Connection string retrieved" -ForegroundColor Green

# Configure Web API
Write-Host "`n[3/5] Configuring Web API to use Azure SignalR..." -ForegroundColor Yellow

az webapp config appsettings set `
    --name $WebApiName `
    --resource-group $ResourceGroup `
    --settings "Azure:SignalR:ConnectionString=$connectionString"

Write-Host "  ✓ Web API configured" -ForegroundColor Green

# Configure Memory Pipeline (if it exists)
Write-Host "`n[4/5] Configuring Memory Pipeline..." -ForegroundColor Yellow

$memoryPipelineExists = az webapp show `
    --name $MemoryPipelineName `
    --resource-group $ResourceGroup 2>$null

if ($memoryPipelineExists) {
    az webapp config appsettings set `
        --name $MemoryPipelineName `
        --resource-group $ResourceGroup `
        --settings "Azure:SignalR:ConnectionString=$connectionString"
    
    Write-Host "  ✓ Memory Pipeline configured" -ForegroundColor Green
} else {
    Write-Host "  ⊘ Memory Pipeline not found (skipping)" -ForegroundColor Gray
}

# Restart apps
Write-Host "`n[5/5] Restarting apps to apply changes..." -ForegroundColor Yellow

az webapp restart --name $WebApiName --resource-group $ResourceGroup

if ($memoryPipelineExists) {
    az webapp restart --name $MemoryPipelineName --resource-group $ResourceGroup
}

Write-Host "  ✓ Apps restarted" -ForegroundColor Green

# Success summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ✓ Azure SignalR Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nWhat was configured:" -ForegroundColor Yellow
Write-Host "  ✓ Azure SignalR Service: $SignalRName" -ForegroundColor Green
Write-Host "  ✓ SKU: $SKU" -ForegroundColor Green
Write-Host "  ✓ Web API connected to SignalR" -ForegroundColor Green
if ($memoryPipelineExists) {
    Write-Host "  ✓ Memory Pipeline connected to SignalR" -ForegroundColor Green
}

Write-Host "`nBenefits:" -ForegroundColor Yellow
Write-Host "  • More reliable message delivery" -ForegroundColor White
Write-Host "  • Better handling of long-running connections" -ForegroundColor White
Write-Host "  • Automatic scaling and connection management" -ForegroundColor White
Write-Host "  • Fixes 'spinning forever' issue" -ForegroundColor White

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. Test the application" -ForegroundColor White
Write-Host "     - Ask a complex question" -ForegroundColor Gray
Write-Host "     - Response should now appear without refresh" -ForegroundColor Gray
Write-Host "`n  2. Monitor SignalR service" -ForegroundColor White
Write-Host "     - Azure Portal → $SignalRName → Metrics" -ForegroundColor Gray
Write-Host "     - Check: Connection count, Message count" -ForegroundColor Gray
Write-Host "`n  3. If using Free tier, monitor limits" -ForegroundColor White
Write-Host "     - Upgrade to Standard if hitting limits" -ForegroundColor Gray

if ($SKU -eq "Free_F1") {
    Write-Host "`n⚠ Note: You're using the Free tier" -ForegroundColor Yellow
    Write-Host "  Upgrade to Standard for production:" -ForegroundColor Gray
    Write-Host "  az signalr update --name $SignalRName --resource-group $ResourceGroup --sku Standard_S1" -ForegroundColor Cyan
}

Write-Host "`nDone! The 'spinning' issue should now be fixed. 🎉" -ForegroundColor Green

