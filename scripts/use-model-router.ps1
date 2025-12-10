# Switch to model-router deployment which handles max_tokens → max_completion_tokens translation
# This is the quickest fix for gpt-5-mini compatibility

param(
    [string]$ResourceGroup = "rg-sk-copilot-npi",
    [string]$AppName = "app-copichat-4kt5uxo2hrzri-webapi"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Switching to Model Router" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if logged in
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Please log in to Azure first: az login" -ForegroundColor Red
    exit 1
}
Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green

Write-Host "`nUpdating deployment to use model-router..." -ForegroundColor Yellow

az webapp config appsettings set `
    --resource-group $ResourceGroup `
    --name $AppName `
    --settings `
        KernelMemory__Services__AzureOpenAIText__Deployment="model-router" `
    --output none

Write-Host "✅ Deployment updated" -ForegroundColor Green

Write-Host "`nRestarting WebAPI..." -ForegroundColor Yellow
az webapp restart `
    --resource-group $ResourceGroup `
    --name $AppName

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Switch Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Production is now using model-router which should handle:" -ForegroundColor Cyan
Write-Host "  ✅ max_tokens → max_completion_tokens translation"
Write-Host "  ✅ API version compatibility"
Write-Host "  ✅ Works with gpt-5-mini and other models"
Write-Host ""
Write-Host "Test it at https://mimir.vlfk.no" -ForegroundColor Yellow
Write-Host ""

