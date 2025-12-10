# Test MCP Bridge and MCP Server Connectivity
# This script verifies that MCP services are operational

param(
    [string]$McpServerUrl = "https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io",
    [string]$ResourceGroup = "rg-sk-copilot-npi",
    [string]$WebApiName = "app-copichat-4kt5uxo2hrzri-webapi"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Testing MCP Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$allTestsPassed = $true

# Test 1: Check MCP Server (FastMCP)
Write-Host "`n[Test 1/5] Testing MCP Server connectivity..." -ForegroundColor Yellow
Write-Host "URL: $McpServerUrl" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest -Uri $McpServerUrl -Method Get -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✓ MCP Server is responding (Status: $($response.StatusCode))" -ForegroundColor Green
    
    # Try to get server info
    Write-Host "  Checking server details..." -ForegroundColor Gray
    $serverInfo = $response.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($serverInfo) {
        Write-Host "  Server info retrieved successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ MCP Server is NOT responding" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    $allTestsPassed = $false
}

# Test 2: Check MCP Server health endpoint
Write-Host "`n[Test 2/5] Testing MCP Server health endpoint..." -ForegroundColor Yellow

$healthUrls = @(
    "$McpServerUrl/health",
    "$McpServerUrl/healthz",
    "$McpServerUrl/"
)

$healthCheckPassed = $false
foreach ($healthUrl in $healthUrls) {
    try {
        $response = Invoke-WebRequest -Uri $healthUrl -Method Get -TimeoutSec 5 -ErrorAction Stop
        Write-Host "✓ Health check passed: $healthUrl (Status: $($response.StatusCode))" -ForegroundColor Green
        $healthCheckPassed = $true
        break
    } catch {
        Write-Host "  Tried: $healthUrl - No response" -ForegroundColor Gray
    }
}

if (-not $healthCheckPassed) {
    Write-Host "⚠ No standard health endpoint found (this may be normal for MCP servers)" -ForegroundColor Yellow
}

# Test 3: Check if Container Apps are running
Write-Host "`n[Test 3/5] Checking Azure Container Apps status..." -ForegroundColor Yellow

$account = az account show 2>$null | ConvertFrom-Json
if ($account) {
    Write-Host "  Logged in as: $($account.user.name)" -ForegroundColor Gray
    
    # Find container apps in the resource group
    $containerApps = az containerapp list --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
    
    if ($containerApps -and $containerApps.Count -gt 0) {
        Write-Host "  Found $($containerApps.Count) Container App(s):" -ForegroundColor Green
        
        foreach ($app in $containerApps) {
            $status = $app.properties.runningStatus
            $fqdn = $app.properties.configuration.ingress.fqdn
            
            if ($status -eq "Running") {
                Write-Host "  ✓ $($app.name): Running" -ForegroundColor Green
            } else {
                Write-Host "  ✗ $($app.name): $status" -ForegroundColor Red
                $allTestsPassed = $false
            }
            
            if ($fqdn) {
                Write-Host "    URL: https://$fqdn" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "  No Container Apps found in resource group" -ForegroundColor Yellow
        Write-Host "  (MCP server may be deployed elsewhere)" -ForegroundColor Gray
    }
} else {
    Write-Host "  Not logged in to Azure - skipping Container Apps check" -ForegroundColor Yellow
    Write-Host "  Run 'az login' to enable this check" -ForegroundColor Gray
}

# Test 4: Check WebAPI MCP Configuration
Write-Host "`n[Test 4/5] Checking WebAPI MCP configuration..." -ForegroundColor Yellow

if ($account) {
    try {
        $appSettings = az webapp config appsettings list `
            --name $WebApiName `
            --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
        
        $mcpSettings = $appSettings | Where-Object { $_.name -like "*Mcp*" }
        
        if ($mcpSettings.Count -gt 0) {
            Write-Host "  Found MCP settings in WebAPI:" -ForegroundColor Green
            foreach ($setting in $mcpSettings) {
                if ($setting.name -like "*Url*") {
                    Write-Host "  - $($setting.name): $($setting.value)" -ForegroundColor Gray
                } else {
                    Write-Host "  - $($setting.name)" -ForegroundColor Gray
                }
            }
        } else {
            Write-Host "  ⚠ No MCP settings found in WebAPI app settings" -ForegroundColor Yellow
            Write-Host "    (May be using appsettings.json defaults)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  Could not retrieve WebAPI settings: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Test 5: Test MCP Server tools endpoint
Write-Host "`n[Test 5/5] Testing MCP Server tools endpoint..." -ForegroundColor Yellow

try {
    # MCP protocol typically uses POST with JSON-RPC
    $mcpRequest = @{
        jsonrpc = "2.0"
        id = 1
        method = "tools/list"
    } | ConvertTo-Json
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-WebRequest -Uri $McpServerUrl `
        -Method Post `
        -Body $mcpRequest `
        -Headers $headers `
        -TimeoutSec 10 `
        -ErrorAction Stop
    
    $result = $response.Content | ConvertFrom-Json
    
    if ($result.result -and $result.result.tools) {
        $toolCount = $result.result.tools.Count
        Write-Host "✓ MCP Server returned $toolCount tool(s):" -ForegroundColor Green
        foreach ($tool in $result.result.tools) {
            Write-Host "  - $($tool.name): $($tool.description)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  Response received but no tools found in standard format" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Could not retrieve tools list (this may be normal for some MCP implementations)" -ForegroundColor Yellow
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Gray
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
if ($allTestsPassed) {
    Write-Host "  ✓ MCP Services Test: PASSED" -ForegroundColor Green
} else {
    Write-Host "  ✗ MCP Services Test: FAILED" -ForegroundColor Red
}
Write-Host "========================================" -ForegroundColor Cyan

# Additional recommendations
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Check application logs for MCP connection status:" -ForegroundColor White
Write-Host "   az webapp log tail --name $WebApiName --resource-group $ResourceGroup" -ForegroundColor Cyan
Write-Host "`n2. Look for these log entries:" -ForegroundColor White
Write-Host "   - 'Connecting to MCP server: CustomMcpServer'" -ForegroundColor Gray
Write-Host "   - 'Successfully connected to MCP server'" -ForegroundColor Gray
Write-Host "   - 'MCP server provided X tools'" -ForegroundColor Gray
Write-Host "`n3. Test MCP functionality in the chat:" -ForegroundColor White
Write-Host "   - Ask: 'What tools are available?'" -ForegroundColor Gray
Write-Host "   - Try using a Klarspråk tool" -ForegroundColor Gray

Write-Host "`nMCP Server URL: $McpServerUrl" -ForegroundColor Cyan

exit $(if ($allTestsPassed) { 0 } else { 1 })

