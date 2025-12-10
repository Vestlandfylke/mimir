# Check what Semantic Kernel version is actually running in production

param(
    [string]$ResourceGroup = "rg-sk-copilot-npi",
    [string]$AppName = "app-copichat-4kt5uxo2hrzri-webapi"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Checking Production Package Versions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if logged in
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Please log in to Azure first: az login" -ForegroundColor Red
    exit 1
}
Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green

Write-Host "`nFetching deployment logs..." -ForegroundColor Yellow
az webapp log tail --resource-group $ResourceGroup --name $AppName --query "[].message" -o tsv | Select-String -Pattern "Microsoft.SemanticKernel" | Select-Object -First 10

Write-Host "`nAlternatively, checking app settings for any version indicators..." -ForegroundColor Yellow
$settings = az webapp config appsettings list --resource-group $ResourceGroup --name $AppName | ConvertFrom-Json

Write-Host "`nCurrent Azure OpenAI settings:" -ForegroundColor Cyan
$settings | Where-Object { $_.name -like "*AzureOpenAI*" } | ForEach-Object {
    Write-Host "  $($_.name) = $($_.value)"
}

Write-Host "`nTo force a clean rebuild with SK 1.68.0:" -ForegroundColor Yellow
Write-Host "  git commit --allow-empty -m 'chore: force rebuild with SK 1.68.0'" -ForegroundColor Gray
Write-Host "  git push" -ForegroundColor Gray

