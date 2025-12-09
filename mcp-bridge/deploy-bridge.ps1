# Deploy MCP Bridge to Azure App Service
# Usage: .\deploy-bridge.ps1

param(
    [string]$ResourceGroup = "rg-sk-copilot-npi",
    [string]$AppServicePlan = "asp-copichat-4kt5uxo2hrzri-webapi",  # Reuse existing plan
    [string]$AppName = "app-mcp-bridge-mimir",
    [string]$Location = "norwayeast",
    [string]$FastMcpUrl = "https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deploying MCP Bridge to Azure" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if logged in
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Please log in to Azure first: az login" -ForegroundColor Red
    exit 1
}
Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green

# Step 1: Create App Service (if not exists)
Write-Host "`n[1/4] Creating App Service..." -ForegroundColor Yellow

$appExists = az webapp show --name $AppName --resource-group $ResourceGroup 2>$null
if (-not $appExists) {
    Write-Host "Creating new App Service: $AppName"
    az webapp create `
        --name $AppName `
        --resource-group $ResourceGroup `
        --plan $AppServicePlan `
        --runtime "PYTHON:3.11" `
        --https-only true
} else {
    Write-Host "App Service already exists: $AppName" -ForegroundColor Green
}

# Step 2: Configure App Settings
Write-Host "`n[2/4] Configuring App Settings..." -ForegroundColor Yellow

az webapp config appsettings set `
    --name $AppName `
    --resource-group $ResourceGroup `
    --settings `
        FASTMCP_SERVER_URL=$FastMcpUrl `
        BRIDGE_HOST="0.0.0.0" `
        BRIDGE_PORT="8000" `
        SCM_DO_BUILD_DURING_DEPLOYMENT="true" `
        WEBSITES_PORT="8000"

# Step 3: Configure startup command
Write-Host "`n[3/4] Configuring startup command..." -ForegroundColor Yellow

az webapp config set `
    --name $AppName `
    --resource-group $ResourceGroup `
    --startup-file "gunicorn -w 2 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 bridge:app"

# Step 4: Deploy the code
Write-Host "`n[4/4] Deploying code..." -ForegroundColor Yellow

# Create a zip of the bridge files
$zipPath = "$env:TEMP\mcp-bridge.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath }

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Create zip with required files
Compress-Archive -Path @(
    "$scriptDir\bridge.py",
    "$scriptDir\requirements.txt"
) -DestinationPath $zipPath -Force

Write-Host "Deploying from: $zipPath"

az webapp deploy `
    --name $AppName `
    --resource-group $ResourceGroup `
    --src-path $zipPath `
    --type zip

# Clean up
Remove-Item $zipPath -ErrorAction SilentlyContinue

# Get the URL
$appUrl = az webapp show --name $AppName --resource-group $ResourceGroup --query "defaultHostName" -o tsv

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Bridge URL: https://$appUrl" -ForegroundColor Cyan
Write-Host "MCP Endpoint: https://$appUrl/mcp" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update WebAPI appsettings.json to use: https://$appUrl/mcp"
Write-Host "2. Restart WebAPI"
Write-Host ""
Write-Host "Test the bridge:"
Write-Host "  curl https://$appUrl/health"

