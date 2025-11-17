<#
.SYNOPSIS
Starts the MCP Bridge server for FastMCP to Standard MCP translation.
#>

Write-Host "========================================"
Write-Host " Starting MCP Bridge Server" -ForegroundColor Cyan
Write-Host "========================================"
Write-Host ""

$McpBridgeRoot = Join-Path $PSScriptRoot '..\mcp-bridge'

# Check if Python is installed
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Host "Python is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Python 3.8+ from https://www.python.org/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press Enter to exit..."
    Read-Host
    exit 1
}

# Check Python version
$pythonVersion = & python --version 2>&1
Write-Host "Found: $pythonVersion" -ForegroundColor Green

# Check if mcp-bridge directory exists
if (-not (Test-Path $McpBridgeRoot)) {
    Write-Host "MCP Bridge directory not found: $McpBridgeRoot" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press Enter to exit..."
    Read-Host
    exit 1
}

# Check if requirements are installed
Write-Host ""
Write-Host "Checking Python dependencies..." -ForegroundColor Cyan
$requirementsFile = Join-Path $McpBridgeRoot 'requirements.txt'

try {
    # Try to import required packages
    $checkImports = @"
import sys
try:
    import httpx
    import starlette
    import uvicorn
    sys.exit(0)
except ImportError as e:
    print(f'Missing package: {e.name}')
    sys.exit(1)
"@
    
    $importCheck = $checkImports | python - 2>&1
    $importCheckExitCode = $LASTEXITCODE
    
    if ($importCheckExitCode -ne 0) {
        Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
        & python -m pip install -r $requirementsFile --quiet --user
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to install Python dependencies." -ForegroundColor Red
            Write-Host "Try manually: cd mcp-bridge && pip install -r requirements.txt" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Press Enter to exit..."
            Read-Host
            exit 1
        }
        Write-Host "Dependencies installed successfully!" -ForegroundColor Green
    } else {
        Write-Host "All dependencies are installed." -ForegroundColor Green
    }
} catch {
    Write-Host "Warning: Could not verify dependencies." -ForegroundColor Yellow
}

# Start the bridge
Write-Host ""
Write-Host "Starting MCP Bridge on http://localhost:8002..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the bridge." -ForegroundColor Gray
Write-Host ""
Write-Host "Bridge endpoints:" -ForegroundColor White
Write-Host "  - MCP endpoint:  http://localhost:8002/mcp" -ForegroundColor White
Write-Host "  - Health check:  http://localhost:8002/health" -ForegroundColor White
Write-Host "  - Info:          http://localhost:8002/" -ForegroundColor White
Write-Host ""
Write-Host "Connecting to FastMCP server:" -ForegroundColor White
Write-Host "  https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io" -ForegroundColor White
Write-Host ""
Write-Host "========================================"
Write-Host ""

Set-Location $McpBridgeRoot

try {
    & python bridge.py
} catch {
    Write-Host ""
    Write-Host "MCP Bridge stopped." -ForegroundColor Yellow
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "MCP Bridge has stopped. Press Enter to close this window."
Read-Host

