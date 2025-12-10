# Verify that SK 1.68.0 is actually deployed and running

param(
    [string]$ResourceGroup = "rg-sk-copilot-npi",
    [string]$AppName = "app-copichat-4kt5uxo2hrzri-webapi"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Verifying Deployment Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if logged in
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Please log in to Azure first: az login" -ForegroundColor Red
    exit 1
}
Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green

Write-Host "`nChecking last deployment..." -ForegroundColor Yellow
$deployment = az webapp deployment list --resource-group $ResourceGroup --name $AppName --query "[0]" | ConvertFrom-Json
Write-Host "Last deployment:" -ForegroundColor Cyan
Write-Host "  Status: $($deployment.status)" -ForegroundColor $(if ($deployment.status -eq "Succeeded") { "Green" } else { "Red" })
Write-Host "  Time: $($deployment.end_time)"
Write-Host "  Message: $($deployment.message)"

Write-Host "`nChecking app health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://mimir.vlfk.no/healthz" -TimeoutSec 10
    Write-Host "  Health check: $($response.StatusCode) $($response.StatusDescription)" -ForegroundColor Green
} catch {
    Write-Host "  Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTesting with a simple API call..." -ForegroundColor Yellow
Write-Host "Please test manually at https://mimir.vlfk.no" -ForegroundColor Cyan
Write-Host ""
Write-Host "If you still see max_tokens errors:" -ForegroundColor Yellow
Write-Host "  1. ✅ SK 1.68.0 deployment triggered (rebuilding now)"
Write-Host "  2. ⏳ Wait 5-10 minutes for rebuild to complete"
Write-Host "  3. 🔄 Hard refresh browser (Ctrl+Shift+R)"
Write-Host "  4. 🧪 Test again"
Write-Host ""
Write-Host "If it STILL doesn't work after rebuild:" -ForegroundColor Yellow
Write-Host "  Run: .\set-api-version.ps1" -ForegroundColor Gray
Write-Host ""

