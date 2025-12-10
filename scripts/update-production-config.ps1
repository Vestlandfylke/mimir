# Fix missing appsettings in production
# This script adds missing settings like FastModel, MCP approval, Service config, etc.

param(
    [string]$ResourceGroup = "rg-sk-copilot-npi",
    [string]$AppName = "app-copichat-4kt5uxo2hrzri-webapi"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Updating Production Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if logged in
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Please log in to Azure first: az login" -ForegroundColor Red
    exit 1
}
Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green

# Update app settings
Write-Host "`nUpdating configuration settings..." -ForegroundColor Yellow

az webapp config appsettings set `
    --resource-group $ResourceGroup `
    --name $AppName `
    --settings `
        FastModel__Enabled="true" `
        FastModel__Deployment="gpt-4o-mini" `
        Service__SemanticPluginsDirectory="./Plugins/SemanticPlugins" `
        Service__NativePluginsDirectory="./Plugins/NativePlugins" `
        McpServers__PlanApprovalMode="PerServer" `
        McpServers__Servers__0__RequireApproval="true" `
        McpServers__Servers__0__Description="Klarspråk MCP server - provides text analysis and simplification tools" `
        McpServers__Servers__0__Templates__0="klarsprak" `
        DocumentMemory__DocumentLineSplitMaxTokens="72" `
        DocumentMemory__DocumentChunkMaxTokens="512" `
        DocumentMemory__FileSizeLimit="10000000" `
        DocumentMemory__FileCountLimit="20" `
    --output none

Write-Host "✅ Settings updated" -ForegroundColor Green

# Restart the app
Write-Host "`nRestarting WebAPI..." -ForegroundColor Yellow
az webapp restart `
    --resource-group $ResourceGroup `
    --name $AppName

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Configuration Update Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Updated settings:" -ForegroundColor Cyan
Write-Host "  ✅ FastModel - Enabled with gpt-4o-mini for faster extraction"
Write-Host "  ✅ MCP Approval - Tools now require user approval"
Write-Host "  ✅ Service - Plugin directories configured"
Write-Host "  ✅ DocumentMemory - Limits and token settings configured"
Write-Host ""
Write-Host "Test it:" -ForegroundColor Yellow
Write-Host "1. Go to https://mimir.vlfk.no"
Write-Host "2. Open the Klarspråk assistant"
Write-Host "3. Use an MCP tool - you should now see the approval prompt"
Write-Host "4. Notice faster response times for extraction tasks (FastModel)"
Write-Host ""

