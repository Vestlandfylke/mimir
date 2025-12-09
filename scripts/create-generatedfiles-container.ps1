# Create GeneratedFiles Container in Cosmos DB
# Usage: .\create-generatedfiles-container.ps1

param(
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroupName = "RG-SK-Copilot-NPI",
    
    [Parameter(Mandatory=$false)]
    [string]$CosmosAccountName = "cosmos-copichat-4kt5uxo2hrzri",
    
    [Parameter(Mandatory=$false)]
    [string]$DatabaseName = "CopilotChat",
    
    [Parameter(Mandatory=$false)]
    [string]$ContainerName = "generatedfiles",
    
    [Parameter(Mandatory=$false)]
    [int]$Throughput = 400
)

Write-Host "🚀 Creating GeneratedFiles Container in Cosmos DB..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Resource Group: $ResourceGroupName" -ForegroundColor White
Write-Host "  Cosmos Account: $CosmosAccountName" -ForegroundColor White
Write-Host "  Database: $DatabaseName" -ForegroundColor White
Write-Host "  Container: $ContainerName" -ForegroundColor White
Write-Host "  Throughput: $Throughput RU/s" -ForegroundColor White
Write-Host ""

# Check if container already exists
Write-Host "🔍 Checking if container already exists..." -ForegroundColor Cyan
$existingContainer = az cosmosdb sql container show `
    --resource-group $ResourceGroupName `
    --account-name $CosmosAccountName `
    --database-name $DatabaseName `
    --name $ContainerName `
    2>$null

if ($existingContainer) {
    Write-Host "⚠️  Container '$ContainerName' already exists!" -ForegroundColor Yellow
    Write-Host ""
    $existingContainer | ConvertFrom-Json | Format-List
    
    $response = Read-Host "Do you want to delete and recreate it? (yes/no)"
    if ($response -eq "yes") {
        Write-Host "🗑️  Deleting existing container..." -ForegroundColor Red
        az cosmosdb sql container delete `
            --resource-group $ResourceGroupName `
            --account-name $CosmosAccountName `
            --database-name $DatabaseName `
            --name $ContainerName `
            --yes
        
        Write-Host "✅ Container deleted" -ForegroundColor Green
        Start-Sleep -Seconds 2
    } else {
        Write-Host "❌ Operation cancelled" -ForegroundColor Red
        exit 0
    }
}

# Create the container
Write-Host "📦 Creating container '$ContainerName'..." -ForegroundColor Cyan

try {
    $result = az cosmosdb sql container create `
        --resource-group $ResourceGroupName `
        --account-name $CosmosAccountName `
        --database-name $DatabaseName `
        --name $ContainerName `
        --partition-key-path "/chatId" `
        --throughput $Throughput `
        2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Container created successfully!" -ForegroundColor Green
        Write-Host ""
        
        # Display container info
        Write-Host "📋 Container Details:" -ForegroundColor Cyan
        $result | ConvertFrom-Json | Format-List
        
        Write-Host ""
        Write-Host "🎉 Setup Complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. ✅ Container 'generatedfiles' is ready" -ForegroundColor White
        Write-Host "  2. 📝 Update App Service Configuration:" -ForegroundColor White
        Write-Host "       Cosmos__GeneratedFilesContainer = generatedfiles" -ForegroundColor Gray
        Write-Host "  3. 🚀 Deploy webapi to Azure" -ForegroundColor White
        Write-Host "  4. 🧪 Test file download functionality" -ForegroundColor White
        
    } else {
        Write-Host "❌ Failed to create container!" -ForegroundColor Red
        Write-Host $result
        exit 1
    }
    
} catch {
    Write-Host "❌ Error creating container: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "💰 Cost Estimate:" -ForegroundColor Yellow
Write-Host "  $Throughput RU/s = ~`$$(($Throughput * 0.008 * 730).ToString('F2'))/month" -ForegroundColor White
Write-Host "  (Estimate based on standard pricing)" -ForegroundColor Gray
Write-Host ""

