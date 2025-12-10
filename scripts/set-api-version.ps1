# Set explicit Azure OpenAI API version to avoid max_tokens issues
# Uses 2024-08-01-preview which supports both old and new parameter names

param(
    [string]$ResourceGroup = "rg-sk-copilot-npi",
    [string]$AppName = "app-copichat-4kt5uxo2hrzri-webapi",
    [string]$ApiVersion = "2024-08-01-preview"  # This version is more forgiving
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setting Azure OpenAI API Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if logged in
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Please log in to Azure first: az login" -ForegroundColor Red
    exit 1
}
Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green

Write-Host "`nSetting API version to: $ApiVersion" -ForegroundColor Yellow
Write-Host "This version should handle max_tokens compatibility automatically." -ForegroundColor Gray

az webapp config appsettings set `
    --resource-group $ResourceGroup `
    --name $AppName `
    --settings `
        "KernelMemory__Services__AzureOpenAIText__APIVersion=$ApiVersion" `
    --output none

Write-Host "✅ API version set" -ForegroundColor Green

Write-Host "`nRestarting WebAPI..." -ForegroundColor Yellow
az webapp restart `
    --resource-group $ResourceGroup `
    --name $AppName

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  API Version Updated!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Test at: https://mimir.vlfk.no" -ForegroundColor Yellow
Write-Host ""
Write-Host "If this doesn't work, we may need to:" -ForegroundColor Cyan
Write-Host "  1. Wait for the GitHub Actions rebuild to complete"
Write-Host "  2. Check if SK 1.68.0 was actually deployed"
Write-Host "  3. Consider using a different deployment model with higher TPM"
Write-Host ""

