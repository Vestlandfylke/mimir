<#
.SYNOPSIS
Initializes and runs both the backend and frontend for Chat Copilot, with error logging.
#>

# Set the error log file path
$ErrorLogFile = Join-Path "$PSScriptRoot" "error.log"

# Function to log errors to the file
function Log-Error {
    param (
        [string]$Message
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $ErrorLogFile -Value "$timestamp ERROR: $Message"
}

# Verify "Core" version of PowerShell installed (not "Desktop"): https://aka.ms/powershell
$ErrorActionPreference = 'Ignore'
$cmd = Get-Command 'pwsh'
$ErrorActionPreference = 'Continue'

if (!$cmd) {
    $warningMessage = "Please update your PowerShell installation: https://aka.ms/powershell"
    Write-Warning $warningMessage
    Log-Error $warningMessage
    return
}

$BackendScript = Join-Path "$PSScriptRoot" 'Start-Backend.ps1'
$FrontendScript = Join-Path "$PSScriptRoot" 'Start-Frontend.ps1'

# Start backend (in new PS process)
try {
    Start-Process pwsh -ArgumentList "-command ""& '$BackendScript'"""
} catch {
    Log-Error "Failed to start backend script: $($_.Exception.Message)"
    return
}

# Check if the backend is running before proceeding
$backendRunning = $false

# Get the port from the REACT_APP_BACKEND_URI env variable
$envFilePath = Join-Path $PSScriptRoot '..\webapp\.env'

try {
    $envContent = Get-Content -Path $envFilePath -ErrorAction Stop
    $port = [regex]::Match($envContent, ':(\d+)/').Groups[1].Value
} catch {
    Log-Error "Failed to read .env file or extract the port: $($_.Exception.Message)"
    return
}

$maxRetries = 5
$retryCount = 0
$retryWait = 5 # Set the number of seconds to wait before retrying

# Check if the backend is running and retry if necessary
while (-not $backendRunning -and $retryCount -lt $maxRetries) {
    $retryCount++
    try {
        $backendRunning = Test-NetConnection -ComputerName localhost -Port $port -InformationLevel Quiet
    } catch {
        Log-Error "Error checking backend connection: $($_.Exception.Message)"
    }
    if (-not $backendRunning) {
        Start-Sleep -Seconds $retryWait
    }
}

# If the backend is running, start the frontend
if ($backendRunning) {
    try {
        & $FrontendScript
    } catch {
        Log-Error "Failed to start frontend script: $($_.Exception.Message)"
    }
} else {
    # Otherwise, write to the console and log the error
    $errorMessage = @"
*************************************************
Backend is not running, and we have exceeded 
the maximum number of retries. Exiting.
*************************************************
"@
    Write-Host $errorMessage
    Log-Error "Backend failed to start after $maxRetries retries."
}

Write-Host "Script execution complete. Press Enter to close."
Read-Host
