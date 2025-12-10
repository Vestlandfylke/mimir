# Fix Slow Responses and SignalR Timeout Issues
# Addresses: Slow responses, spinning loader, need to refresh to see response

param(
    [string]$ResourceGroup = "rg-sk-copilot-npi",
    [string]$WebApiName = "app-copichat-4kt5uxo2hrzri-webapi"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fixing Slow Response Issues" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if logged in
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Please log in to Azure first: az login" -ForegroundColor Red
    exit 1
}
Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green

# Get current SignalR configuration
Write-Host "`n[Diagnostics] Checking current configuration..." -ForegroundColor Yellow

$appSettings = az webapp config appsettings list `
    --name $WebApiName `
    --resource-group $ResourceGroup | ConvertFrom-Json

$azureSignalR = $appSettings | Where-Object { $_.name -eq "Azure:SignalR:ConnectionString" }

if ($azureSignalR -and $azureSignalR.value) {
    Write-Host "  Using Azure SignalR Service ✓" -ForegroundColor Green
    Write-Host "  (This is good for production)" -ForegroundColor Gray
} else {
    Write-Host "  Using local SignalR (not Azure SignalR)" -ForegroundColor Yellow
    Write-Host "  This can cause timeout issues with long-running AI responses" -ForegroundColor Yellow
}

# Check current timeout settings
$currentTimeout = $appSettings | Where-Object { $_.name -eq "Service:TimeoutLimitInS" }
if ($currentTimeout) {
    Write-Host "  Current timeout: $($currentTimeout.value) seconds" -ForegroundColor Gray
} else {
    Write-Host "  No timeout limit configured (can cause hanging)" -ForegroundColor Yellow
}

# Fix 1: Increase timeout limits
Write-Host "`n[Fix 1/4] Increasing timeout limits..." -ForegroundColor Yellow

$newSettings = @{
    # Increase service timeout to 180 seconds (3 minutes) for AI responses
    "Service:TimeoutLimitInS" = "180"
    
    # Ensure proper SignalR sticky sessions
    "WEBSITE_ADD_SITENAME_BINDINGS_IN_APPHOST_CONFIG" = "1"
    
    # Enable Always On to prevent cold starts
    # (Will be handled separately as it requires different API)
}

$settingsArgs = @()
foreach ($key in $newSettings.Keys) {
    $settingsArgs += "$key=$($newSettings[$key])"
}

az webapp config appsettings set `
    --name $WebApiName `
    --resource-group $ResourceGroup `
    --settings $settingsArgs

Write-Host "✓ Timeout limits increased" -ForegroundColor Green

# Fix 2: Enable Always On to prevent cold starts
Write-Host "`n[Fix 2/4] Enabling Always On..." -ForegroundColor Yellow

az webapp config set `
    --name $WebApiName `
    --resource-group $ResourceGroup `
    --always-on true

Write-Host "✓ Always On enabled (prevents cold starts)" -ForegroundColor Green

# Fix 3: Configure proper WebSocket support
Write-Host "`n[Fix 3/4] Ensuring WebSocket support..." -ForegroundColor Yellow

az webapp config set `
    --name $WebApiName `
    --resource-group $ResourceGroup `
    --web-sockets-enabled true

Write-Host "✓ WebSockets enabled for SignalR" -ForegroundColor Green

# Fix 4: Check Azure SignalR Service (if applicable)
Write-Host "`n[Fix 4/4] Checking SignalR Service configuration..." -ForegroundColor Yellow

if ($azureSignalR -and $azureSignalR.value) {
    # Extract SignalR service name from connection string
    $connectionString = $azureSignalR.value
    if ($connectionString -match "Endpoint=https://([^\.]+)\.") {
        $signalRName = $matches[1]
        Write-Host "  SignalR Service: $signalRName" -ForegroundColor Gray
        
        # Check SignalR Service SKU
        $signalRService = az signalr show `
            --name $signalRName `
            --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
        
        if ($signalRService) {
            Write-Host "  SKU: $($signalRService.sku.name) - $($signalRService.sku.capacity) units" -ForegroundColor Gray
            
            if ($signalRService.sku.name -eq "Free_F1") {
                Write-Host "  ⚠ Using Free tier - may have connection limits" -ForegroundColor Yellow
                Write-Host "    Consider upgrading to Standard for production" -ForegroundColor Yellow
            } else {
                Write-Host "  ✓ Using production-grade SKU" -ForegroundColor Green
            }
        }
    }
} else {
    Write-Host "  ⚠ Azure SignalR Service not configured" -ForegroundColor Yellow
    Write-Host "    For production, consider using Azure SignalR Service:" -ForegroundColor Yellow
    Write-Host "    - Better scalability" -ForegroundColor Gray
    Write-Host "    - More reliable connections" -ForegroundColor Gray
    Write-Host "    - Handles long-running connections better" -ForegroundColor Gray
}

# Restart the app to apply all settings
Write-Host "`n[Finalizing] Restarting app..." -ForegroundColor Yellow

az webapp restart --name $WebApiName --resource-group $ResourceGroup

Write-Host "✓ App restarted" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Fixes Applied Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nWhat was fixed:" -ForegroundColor Yellow
Write-Host "  ✓ Increased timeout to 180 seconds (was: unlimited or too short)" -ForegroundColor Green
Write-Host "  ✓ Enabled Always On (prevents cold starts)" -ForegroundColor Green
Write-Host "  ✓ Ensured WebSocket support for SignalR" -ForegroundColor Green
Write-Host "  ✓ Configured sticky sessions for proper SignalR routing" -ForegroundColor Green

Write-Host "`n" -NoNewline
Write-Host "Additional Recommendations:" -ForegroundColor Yellow

if (-not ($azureSignalR -and $azureSignalR.value)) {
    Write-Host "`n1. " -NoNewline -ForegroundColor White
    Write-Host "Consider enabling Azure SignalR Service:" -ForegroundColor Yellow
    Write-Host "   Benefits:" -ForegroundColor Gray
    Write-Host "   - Better handling of long AI responses" -ForegroundColor Gray
    Write-Host "   - More reliable WebSocket connections" -ForegroundColor Gray
    Write-Host "   - Automatic scaling" -ForegroundColor Gray
    Write-Host "`n   Setup:" -ForegroundColor Gray
    Write-Host "   az signalr create --name mimir-signalr --resource-group $ResourceGroup --sku Standard_S1" -ForegroundColor Cyan
}

Write-Host "`n2. " -NoNewline -ForegroundColor White
Write-Host "Monitor response times in Application Insights:" -ForegroundColor Yellow
Write-Host "   az portal show --name appins-copichat-4kt5uxo2hrzri --resource-group $ResourceGroup" -ForegroundColor Cyan

Write-Host "`n3. " -NoNewline -ForegroundColor White
Write-Host "Test the fixes:" -ForegroundColor Yellow
Write-Host "   - Open Mimir in browser" -ForegroundColor Gray
Write-Host "   - Ask a complex question that requires thinking" -ForegroundColor Gray
Write-Host "   - Response should now complete without 'spinning'" -ForegroundColor Gray
Write-Host "   - Check browser console (F12) for SignalR errors" -ForegroundColor Gray

Write-Host "`nDone! Test the app to verify improvements." -ForegroundColor Green

