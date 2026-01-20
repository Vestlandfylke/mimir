<#
.SYNOPSIS
Verifies that your development environment is ready to run Mimir.

.DESCRIPTION
Checks:
- Docker is running
- .env file exists and has required values
- Required ports are available
- Azure OpenAI endpoint is reachable

.EXAMPLE
.\scripts\verify-setup.ps1
#>

$ErrorActionPreference = "Continue"

function Write-Check {
    param([string]$Message, [bool]$Success)
    if ($Success) {
        Write-Host "[OK] " -ForegroundColor Green -NoNewline
    } else {
        Write-Host "[FAIL] " -ForegroundColor Red -NoNewline
    }
    Write-Host $Message
}

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "=== $Message ===" -ForegroundColor Cyan
}

$allPassed = $true

Write-Host ""
Write-Host "Mimir Setup Verification" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan

# ============================================
# Check Docker
# ============================================
Write-Header "Docker"

$dockerRunning = $false
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dockerRunning = $true
    }
} catch {
    $dockerRunning = $false
}

Write-Check "Docker is running" $dockerRunning
if (-not $dockerRunning) {
    Write-Host "  -> Start Docker Desktop and try again" -ForegroundColor Yellow
    $allPassed = $false
}

# ============================================
# Check .env file
# ============================================
Write-Header "Configuration"

$envPath = Join-Path $PSScriptRoot "..\.env"
$envExists = Test-Path $envPath
Write-Check ".env file exists" $envExists

if (-not $envExists) {
    Write-Host "  -> Run: cp .env.example .env" -ForegroundColor Yellow
    $allPassed = $false
} else {
    # Check required variables
    $envContent = Get-Content $envPath -Raw
    
    $hasEndpoint = $envContent -match "AZURE_OPENAI_ENDPOINT=https://[^\s]+"
    $hasKey = $envContent -match "AZURE_OPENAI_API_KEY=(?!your-api-key-here)[^\s]+"
    $hasChatDeployment = $envContent -match "AZURE_OPENAI_CHAT_DEPLOYMENT=[^\s]+"
    $hasEmbedDeployment = $envContent -match "AZURE_OPENAI_EMBEDDING_DEPLOYMENT=[^\s]+"
    
    Write-Check "AZURE_OPENAI_ENDPOINT is set" $hasEndpoint
    Write-Check "AZURE_OPENAI_API_KEY is set (not placeholder)" $hasKey
    Write-Check "AZURE_OPENAI_CHAT_DEPLOYMENT is set" $hasChatDeployment
    Write-Check "AZURE_OPENAI_EMBEDDING_DEPLOYMENT is set" $hasEmbedDeployment
    
    if (-not $hasEndpoint) {
        Write-Host "  -> Add your Azure OpenAI endpoint to .env" -ForegroundColor Yellow
        $allPassed = $false
    }
    if (-not $hasKey) {
        Write-Host "  -> Add your Azure OpenAI API key to .env" -ForegroundColor Yellow
        $allPassed = $false
    }
}

# ============================================
# Check ports
# ============================================
Write-Header "Ports"

function Test-Port {
    param([int]$Port)
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        $listener.Stop()
        return $true
    } catch {
        return $false
    }
}

$port3000Free = Test-Port 3000
$port8080Free = Test-Port 8080

Write-Check "Port 3000 is available (frontend)" $port3000Free
Write-Check "Port 8080 is available (backend)" $port8080Free

if (-not $port3000Free) {
    Write-Host "  -> Stop the service using port 3000, or change the port in docker-compose.dev.yml" -ForegroundColor Yellow
    $allPassed = $false
}
if (-not $port8080Free) {
    Write-Host "  -> Stop the service using port 8080, or change the port in docker-compose.dev.yml" -ForegroundColor Yellow
    $allPassed = $false
}

# ============================================
# Check Azure OpenAI connectivity (optional)
# ============================================
if ($envExists -and $hasEndpoint) {
    Write-Header "Azure OpenAI Connectivity"
    
    $endpoint = [regex]::Match($envContent, "AZURE_OPENAI_ENDPOINT=([^\s]+)").Groups[1].Value
    
    try {
        $response = Invoke-WebRequest -Uri $endpoint -Method Head -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
        $reachable = $true
    } catch {
        # 401/403 is fine - it means the endpoint is reachable but auth is needed
        if ($_.Exception.Response.StatusCode -in @(401, 403, 404)) {
            $reachable = $true
        } else {
            $reachable = $false
        }
    }
    
    Write-Check "Azure OpenAI endpoint is reachable" $reachable
    if (-not $reachable) {
        Write-Host "  -> Check your internet connection and endpoint URL" -ForegroundColor Yellow
    }
}

# ============================================
# Summary
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "All checks passed! You're ready to go." -ForegroundColor Green
    Write-Host ""
    Write-Host "Run: docker compose -f docker-compose.dev.yml up --build" -ForegroundColor White
    Write-Host "Then open: http://localhost:3000" -ForegroundColor White
} else {
    Write-Host "Some checks failed. Fix the issues above and try again." -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
