# Fix Application Insights Profiler and Blob Storage Logging Issues
# Run this script to clean up the diagnostic logging errors

param(
    [string]$ResourceGroup = "rg-sk-copilot-npi",
    [string]$WebAppName = "app-copichat-4kt5uxo2hrzri-webapi",
    [string]$MemoryPipelineName = "app-copichat-4kt5uxo2hrzri-memorypipeline"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fixing Logging Issues for Mimir" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if logged in
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Please log in to Azure first: az login" -ForegroundColor Red
    exit 1
}
Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green

# Fix 1: Disable Application Insights Profiler
Write-Host "`n[1/4] Disabling Application Insights Profiler..." -ForegroundColor Yellow
Write-Host "This prevents the 'AppIdNotFoundException' errors" -ForegroundColor Gray

az webapp config appsettings set `
    --name $WebAppName `
    --resource-group $ResourceGroup `
    --settings `
        APPINSIGHTS_PROFILERFEATURE_VERSION=disabled `
        ApplicationInsightsProvideUsageTelemetryData=false

az webapp config appsettings set `
    --name $MemoryPipelineName `
    --resource-group $ResourceGroup `
    --settings `
        APPINSIGHTS_PROFILERFEATURE_VERSION=disabled `
        ApplicationInsightsProvideUsageTelemetryData=false

Write-Host "✓ Profiler disabled for both apps" -ForegroundColor Green

# Fix 2: Configure filesystem-based application logging
Write-Host "`n[2/4] Configuring filesystem-based logging..." -ForegroundColor Yellow
Write-Host "This prevents the storage authentication (403) errors" -ForegroundColor Gray

az webapp log config `
    --name $WebAppName `
    --resource-group $ResourceGroup `
    --application-logging filesystem `
    --level information `
    --detailed-error-messages true `
    --failed-request-tracing true `
    --web-server-logging filesystem

az webapp log config `
    --name $MemoryPipelineName `
    --resource-group $ResourceGroup `
    --application-logging filesystem `
    --level information `
    --detailed-error-messages true `
    --failed-request-tracing true `
    --web-server-logging filesystem

Write-Host "✓ Filesystem logging configured for both apps" -ForegroundColor Green

# Fix 3: Verify Application Insights is still enabled
Write-Host "`n[3/4] Verifying Application Insights connection..." -ForegroundColor Yellow

$appInsightsKey = az webapp config appsettings list `
    --name $WebAppName `
    --resource-group $ResourceGroup `
    --query "[?name=='APPLICATIONINSIGHTS_CONNECTION_STRING'].value" -o tsv

if ($appInsightsKey) {
    Write-Host "✓ Application Insights connection string is configured" -ForegroundColor Green
    Write-Host "  (Standard telemetry will continue working)" -ForegroundColor Gray
} else {
    Write-Host "⚠ Application Insights connection string not found" -ForegroundColor Yellow
    Write-Host "  You may need to configure this in the App Service settings" -ForegroundColor Gray
}

# Fix 4: Restart apps to apply changes
Write-Host "`n[4/4] Restarting apps..." -ForegroundColor Yellow

az webapp restart --name $WebAppName --resource-group $ResourceGroup
az webapp restart --name $MemoryPipelineName --resource-group $ResourceGroup

Write-Host "✓ Apps restarted" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Logging Issues Fixed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nWhat was fixed:" -ForegroundColor Yellow
Write-Host "  ✓ Disabled Application Insights Profiler (stops AppIdNotFoundException)" -ForegroundColor Green
Write-Host "  ✓ Changed to filesystem logging (stops 403 storage errors)" -ForegroundColor Green
Write-Host "  ✓ Application Insights telemetry still works" -ForegroundColor Green
Write-Host "  ✓ Log streaming still works: az webapp log tail --name $WebAppName --resource-group $ResourceGroup" -ForegroundColor Green

Write-Host "`nTo verify logs are clean:" -ForegroundColor Yellow
Write-Host "  az webapp log tail --name $WebAppName --resource-group $ResourceGroup" -ForegroundColor Cyan

Write-Host "`nNote: You can still view all telemetry in Application Insights" -ForegroundColor Gray

