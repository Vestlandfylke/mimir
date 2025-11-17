<#
.SYNOPSIS
Stops all Chat Copilot services including the MCP Bridge.
#>

Write-Host ""
Write-Host "========================================"
Write-Host " Stopping Chat Copilot Services" -ForegroundColor Yellow
Write-Host "========================================"
Write-Host ""

$stoppedCount = 0

# Stop MCP Bridge (Python)
Write-Host "Stopping MCP Bridge..." -ForegroundColor Cyan
try {
    # Try to find Python processes using port 8002 first
    $port8002 = Get-NetTCPConnection -LocalPort 8002 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    
    if ($port8002) {
        $port8002 | ForEach-Object {
            $process = Get-Process -Id $_ -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "  - Stopping process on port 8002 (PID: $($process.Id), Name: $($process.ProcessName))" -ForegroundColor Gray
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                $stoppedCount++
            }
        }
    }
    
    # Also check for any Python processes with bridge.py
    $pythonProcesses = Get-Process python -ErrorAction SilentlyContinue
    
    if ($pythonProcesses) {
        $pythonProcesses | ForEach-Object {
            Write-Host "  - Stopping Python process (PID: $($_.Id))" -ForegroundColor Gray
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
            $stoppedCount++
        }
    }
    
    if (-not $port8002 -and -not $pythonProcesses) {
        Write-Host "  - No bridge processes found" -ForegroundColor Gray
    }
} catch {
    Write-Host "  - Error stopping bridge: $($_.Exception.Message)" -ForegroundColor Red
}

# Stop Backend (dotnet)
Write-Host "Stopping Backend..." -ForegroundColor Cyan
try {
    $dotnetProcesses = Get-Process dotnet -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*CopilotChatWebApi*" -or $_.Path -like "*webapi*"
    }
    
    if ($dotnetProcesses) {
        $dotnetProcesses | ForEach-Object {
            Write-Host "  - Stopping .NET process (PID: $($_.Id))" -ForegroundColor Gray
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
            $stoppedCount++
        }
    } else {
        Write-Host "  - No backend processes found" -ForegroundColor Gray
    }
} catch {
    Write-Host "  - Error stopping backend: $($_.Exception.Message)" -ForegroundColor Red
}

# Stop Frontend (node/npm)
Write-Host "Stopping Frontend..." -ForegroundColor Cyan
try {
    $nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
    
    if ($nodeProcesses) {
        $nodeProcesses | ForEach-Object {
            Write-Host "  - Stopping Node.js process (PID: $($_.Id))" -ForegroundColor Gray
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
            $stoppedCount++
        }
    } else {
        Write-Host "  - No frontend processes found" -ForegroundColor Gray
    }
} catch {
    Write-Host "  - Error stopping frontend: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================"
if ($stoppedCount -gt 0) {
    Write-Host "Stopped $stoppedCount process(es)." -ForegroundColor Green
} else {
    Write-Host "No running processes found." -ForegroundColor Yellow
}
Write-Host "========================================"
Write-Host ""
Write-Host "All services stopped. Press Enter to close."
Read-Host

