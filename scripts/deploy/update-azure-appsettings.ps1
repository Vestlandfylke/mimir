#Requires -Version 7.0
<#
.SYNOPSIS
    Updates Azure Web App settings to match local appsettings.json

.DESCRIPTION
    This script updates the Azure Web App configuration to include:
    - LeiarKontekst plugin settings
    - MimirKnowledge plugin settings
    - SharePointObo settings
    - Lovdata settings
    - Other plugin configurations
    
    NOTE: System prompts (Prompts section) are deployed WITH the app in appsettings.json
    since they're too long for environment variables.

.PARAMETER ResourceGroup
    The Azure resource group name

.PARAMETER AppName
    The Azure Web App name

.PARAMETER SkipSecrets
    Skip setting secret values (API keys, connection strings)

.EXAMPLE
    .\update-azure-appsettings.ps1 -ResourceGroup "rg-copichat-4kt5uxo2hrzri" -AppName "app-copichat-4kt5uxo2hrzri"
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$ResourceGroup = "rg-copichat-4kt5uxo2hrzri",
    
    [Parameter(Mandatory = $false)]
    [string]$AppName = "app-copichat-4kt5uxo2hrzri",
    
    [switch]$SkipSecrets
)

$ErrorActionPreference = "Stop"

Write-Host "=== Azure App Settings Update Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if logged in to Azure
Write-Host "Checking Azure login status..." -ForegroundColor Yellow
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Not logged in to Azure. Running 'az login'..." -ForegroundColor Yellow
    az login
}
Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green
Write-Host ""

# Get current settings
Write-Host "Fetching current app settings from Azure..." -ForegroundColor Yellow
$currentSettings = az webapp config appsettings list --name $AppName --resource-group $ResourceGroup | ConvertFrom-Json
$currentSettingsHash = @{}
foreach ($setting in $currentSettings) {
    $currentSettingsHash[$setting.name] = $setting.value
}
Write-Host "Found $($currentSettings.Count) existing settings" -ForegroundColor Green
Write-Host ""

# Define settings to update (non-secret configuration values)
$settingsToUpdate = @{
    # LeiarKontekst Plugin
    "LeiarKontekst__Enabled" = "true"
    "LeiarKontekst__Endpoint" = "https://acs-copichat-4kt5uxo2hrzri.search.windows.net"
    "LeiarKontekst__IndexName" = "leiar-dokumenter"
    "LeiarKontekst__SemanticConfigurationName" = "leiar-semantic-config"
    "LeiarKontekst__MaxResults" = "5"
    "LeiarKontekst__MaxContentLength" = "30000"
    "LeiarKontekst__ContentFieldName" = "content"
    "LeiarKontekst__TitleFieldName" = "title"
    "LeiarKontekst__SourceFieldName" = "source"
    "LeiarKontekst__RequireApproval" = "false"
    
    # MimirKnowledge Plugin
    "MimirKnowledge__Enabled" = "true"
    "MimirKnowledge__Endpoint" = "https://acs-copichat-4kt5uxo2hrzri.search.windows.net"
    "MimirKnowledge__IndexName" = "mimir-knowledge"
    "MimirKnowledge__SemanticConfigurationName" = "mimir-semantic-config"
    "MimirKnowledge__MaxResults" = "5"
    "MimirKnowledge__MaxContentLength" = "15000"
    "MimirKnowledge__ContentFieldName" = "content"
    "MimirKnowledge__TitleFieldName" = "title"
    "MimirKnowledge__SourceFieldName" = "source"
    "MimirKnowledge__CategoryFieldName" = "category"
    "MimirKnowledge__RequireApproval" = "false"
    
    # SharePointObo Plugin
    "SharePointObo__Enabled" = "true"
    "SharePointObo__Authority" = "https://login.microsoftonline.com"
    "SharePointObo__TenantId" = "5b14945b-0f87-40dd-acf3-5e5e21e6eb36"
    "SharePointObo__ClientId" = "db0932b4-3bb7-4b89-a398-85be5940e84f"
    "SharePointObo__SiteUrl" = "https://vlfksky.sharepoint.com/sites/HR-kvalitet-HMS"
    "SharePointObo__DefaultScopes" = "https://graph.microsoft.com/Sites.Read.All https://graph.microsoft.com/Files.Read.All"
    "SharePointObo__MaxContentLength" = "50000"
    "SharePointObo__RequireApproval" = "false"
    
    # Lovdata Plugin
    "Lovdata__Enabled" = "true"
    "Lovdata__BaseUrl" = "https://api.lovdata.no"
    "Lovdata__MaxContentLength" = "50000"
    "Lovdata__MaxResults" = "20"
    "Lovdata__TimeoutSeconds" = "30"
    "Lovdata__RequireApproval" = "false"
    
    # Fast Model
    "FastModel__Enabled" = "true"
    "FastModel__Deployment" = "gpt-4o-mini"
    
    # Rate Limiting
    "RateLimiting__Enabled" = "true"
    "RateLimiting__MessagesPerMinute" = "20"
    "RateLimiting__MessagesPerHour" = "200"
    "RateLimiting__ConcurrentRequestsPerUser" = "5"
    "RateLimiting__GlobalRequestsPerMinute" = "1000"
    
    # Models Configuration
    "Models__DefaultModelId" = "gpt-5.2-chat"
    
    # Allowed Origins (add production URLs)
    "AllowedOrigins__0" = "http://localhost:3000"
    "AllowedOrigins__1" = "https://localhost:3000"
    "AllowedOrigins__2" = "https://mimir.vlfk.no"
    "AllowedOrigins__3" = "https://app-copichat-4kt5uxo2hrzri.azurewebsites.net"
}

# Secret settings (only set if not skipping and not already present)
$secretSettings = @{
    "LeiarKontekst__ApiKey" = "[SET MANUALLY - Azure AI Search API Key]"
    "MimirKnowledge__ApiKey" = "[SET MANUALLY - Azure AI Search API Key]"
    "SharePointObo__ClientSecret" = "[SET MANUALLY - App Registration Secret]"
}

# Compare and identify changes
Write-Host "=== Settings Comparison ===" -ForegroundColor Cyan
Write-Host ""

$toAdd = @()
$toUpdate = @()
$unchanged = @()

foreach ($key in $settingsToUpdate.Keys) {
    $newValue = $settingsToUpdate[$key]
    if ($currentSettingsHash.ContainsKey($key)) {
        if ($currentSettingsHash[$key] -ne $newValue) {
            $toUpdate += @{ name = $key; oldValue = $currentSettingsHash[$key]; newValue = $newValue }
        } else {
            $unchanged += $key
        }
    } else {
        $toAdd += @{ name = $key; value = $newValue }
    }
}

# Check for missing secrets
$missingSecrets = @()
foreach ($key in $secretSettings.Keys) {
    if (-not $currentSettingsHash.ContainsKey($key) -or [string]::IsNullOrEmpty($currentSettingsHash[$key])) {
        $missingSecrets += $key
    }
}

# Display results
if ($toAdd.Count -gt 0) {
    Write-Host "NEW SETTINGS TO ADD ($($toAdd.Count)):" -ForegroundColor Green
    foreach ($item in $toAdd) {
        Write-Host "  + $($item.name) = $($item.value)" -ForegroundColor Green
    }
    Write-Host ""
}

if ($toUpdate.Count -gt 0) {
    Write-Host "SETTINGS TO UPDATE ($($toUpdate.Count)):" -ForegroundColor Yellow
    foreach ($item in $toUpdate) {
        Write-Host "  ~ $($item.name)" -ForegroundColor Yellow
        Write-Host "    Old: $($item.oldValue)" -ForegroundColor DarkGray
        Write-Host "    New: $($item.newValue)" -ForegroundColor White
    }
    Write-Host ""
}

if ($missingSecrets.Count -gt 0) {
    Write-Host "MISSING SECRETS ($($missingSecrets.Count)):" -ForegroundColor Red
    foreach ($key in $missingSecrets) {
        Write-Host "  ! $key" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "  Set these manually in Azure Portal or using:" -ForegroundColor DarkGray
    Write-Host "  az webapp config appsettings set --name $AppName --resource-group $ResourceGroup --settings `"$key=YOUR_VALUE`"" -ForegroundColor DarkGray
    Write-Host ""
}

Write-Host "UNCHANGED SETTINGS: $($unchanged.Count)" -ForegroundColor DarkGray
Write-Host ""

# Apply changes
if ($toAdd.Count -eq 0 -and $toUpdate.Count -eq 0) {
    Write-Host "No changes needed!" -ForegroundColor Green
    exit 0
}

$totalChanges = $toAdd.Count + $toUpdate.Count
Write-Host "Ready to apply $totalChanges changes to Azure Web App." -ForegroundColor Cyan
$confirm = Read-Host "Continue? (y/n)"

if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

# Build settings string for az command
$allSettings = @()
foreach ($item in $toAdd) {
    $allSettings += "$($item.name)=$($item.value)"
}
foreach ($item in $toUpdate) {
    $allSettings += "$($item.name)=$($item.newValue)"
}

# Apply in batches (az has limits on command line length)
$batchSize = 10
for ($i = 0; $i -lt $allSettings.Count; $i += $batchSize) {
    $batch = $allSettings[$i..[Math]::Min($i + $batchSize - 1, $allSettings.Count - 1)]
    $settingsArg = $batch -join " "
    
    Write-Host "Applying batch $([Math]::Floor($i / $batchSize) + 1)..." -ForegroundColor Yellow
    az webapp config appsettings set --name $AppName --resource-group $ResourceGroup --settings $batch | Out-Null
}

Write-Host ""
Write-Host "=== Settings Updated Successfully! ===" -ForegroundColor Green
Write-Host ""

# Reminder about deployment
Write-Host "=== IMPORTANT: System Prompts ===" -ForegroundColor Cyan
Write-Host "System prompts (Vestland verdiar, assistant descriptions, etc.) are stored in" -ForegroundColor White
Write-Host "appsettings.json and must be deployed WITH the application." -ForegroundColor White
Write-Host ""
Write-Host "To deploy the updated appsettings.json, either:" -ForegroundColor Yellow
Write-Host "  1. Push to GitHub and let CI/CD redeploy the app" -ForegroundColor White
Write-Host "  2. Run: az webapp deploy --resource-group $ResourceGroup --name $AppName --src-path ./publish.zip" -ForegroundColor White
Write-Host ""

if ($missingSecrets.Count -gt 0) {
    Write-Host "=== Don't forget to set these secrets! ===" -ForegroundColor Red
    foreach ($key in $missingSecrets) {
        Write-Host "  - $key" -ForegroundColor Red
    }
}
