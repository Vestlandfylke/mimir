#Requires -Version 7.0
<#
.SYNOPSIS
    Manual deployment of Mimir when GitHub Actions is unavailable

.DESCRIPTION
    This script performs a complete deployment equivalent to the GitHub Actions workflow:
    1. Build backend (webapi) with embedded frontend
    2. Deploy to Azure Web App
    3. Configure plugin settings

.PARAMETER SkipBuild
    Skip the build step (use existing webapi.zip)

.PARAMETER SkipDeploy
    Skip deployment (only configure settings)

.PARAMETER SkipConfigure
    Skip configuration step

.EXAMPLE
    # Full deployment
    .\deploy-all-manual.ps1

.EXAMPLE
    # Only configure settings (already deployed)
    .\deploy-all-manual.ps1 -SkipBuild -SkipDeploy

.EXAMPLE
    # Build and deploy, skip configure
    .\deploy-all-manual.ps1 -SkipConfigure
#>

param(
    [switch]$SkipBuild,
    [switch]$SkipDeploy,
    [switch]$SkipConfigure,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Configuration
$ResourceGroup = "RG-SK-Copilot-NPI"
$AppName = "app-copichat-4kt5uxo2hrzri-webapi"
$Subscription = "7f0cd1ae-9586-4d17-8093-8746bafbdc5a" 
$DeploymentName = "SK-Copilot-NPI-MIMIR"
$ScriptDir = $PSScriptRoot

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  MIMIR MANUAL DEPLOYMENT" -ForegroundColor Cyan
Write-Host "  (GitHub Actions alternative)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Check Azure CLI login
Write-Host "[1/4] Checking Azure login..." -ForegroundColor Yellow
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Not logged in. Running 'az login'..." -ForegroundColor Yellow
    az login
    $account = az account show | ConvertFrom-Json
}
Write-Host "  Logged in as: $($account.user.name)" -ForegroundColor Green
Write-Host "  Subscription: $($account.name)" -ForegroundColor Green
Write-Host ""

# Set subscription
az account set --subscription $Subscription
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to set subscription"
    exit 1
}

# ============================================
# STEP 1: BUILD
# ============================================
if (-not $SkipBuild) {
    Write-Host "[2/4] Building webapi with frontend..." -ForegroundColor Yellow
    Write-Host "  This includes: backend (.NET) + frontend (React)" -ForegroundColor DarkGray
    Write-Host ""
    
    # Check for Node.js
    $nodeVersion = node --version 2>$null
    if (-not $nodeVersion) {
        Write-Error "Node.js is required but not found. Install Node.js 22+ first."
        exit 1
    }
    Write-Host "  Node.js: $nodeVersion" -ForegroundColor DarkGray
    
    # Check for .NET
    $dotnetVersion = dotnet --version 2>$null
    if (-not $dotnetVersion) {
        Write-Error ".NET SDK is required but not found. Install .NET 10 SDK first."
        exit 1
    }
    Write-Host "  .NET SDK: $dotnetVersion" -ForegroundColor DarkGray
    Write-Host ""
    
    # Generate version
    $version = (Get-Date -Format "yyyy.MM.dd")
    $infoVersion = "Manual deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    
    Write-Host "  Building with version: $version" -ForegroundColor DarkGray
    
    & "$ScriptDir\package-webapi.ps1" `
        -BuildConfiguration "Release" `
        -DotNetFramework "net10.0" `
        -TargetRuntime "win-x64" `
        -OutputDirectory $ScriptDir `
        -Version $version `
        -InformationalVersion $infoVersion
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed!"
        exit 1
    }
    
    Write-Host "  Build completed!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[2/4] Skipping build (using existing package)" -ForegroundColor DarkGray
    
    # Check if package exists
    $packagePath = "$ScriptDir\out\webapi.zip"
    if (-not (Test-Path $packagePath)) {
        Write-Error "Package not found at $packagePath. Run without -SkipBuild first."
        exit 1
    }
    Write-Host "  Using: $packagePath" -ForegroundColor DarkGray
    Write-Host ""
}

# ============================================
# STEP 2: DEPLOY
# ============================================
if (-not $SkipDeploy) {
    Write-Host "[3/4] Deploying to Azure Web App..." -ForegroundColor Yellow
    Write-Host "  Resource Group: $ResourceGroup" -ForegroundColor DarkGray
    Write-Host "  App Name: $AppName" -ForegroundColor DarkGray
    Write-Host ""
    
    $packagePath = "$ScriptDir\out\webapi.zip"
    
    # Enable run from package
    Write-Host "  Configuring run-from-package..." -ForegroundColor DarkGray
    az webapp config appsettings set `
        --resource-group $ResourceGroup `
        --name $AppName `
        --settings WEBSITE_RUN_FROM_PACKAGE="1" `
        --output none
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to configure app settings"
        exit 1
    }
    
    # Deploy the package
    Write-Host "  Uploading and deploying package..." -ForegroundColor DarkGray
    az webapp deployment source config-zip `
        --resource-group $ResourceGroup `
        --name $AppName `
        --src $packagePath
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Deployment failed!"
        exit 1
    }
    
    Write-Host "  Deployment completed!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[3/4] Skipping deployment" -ForegroundColor DarkGray
    Write-Host ""
}

# ============================================
# STEP 3: CONFIGURE
# ============================================
if (-not $SkipConfigure) {
    Write-Host "[4/4] Configuring plugin settings..." -ForegroundColor Yellow
    
    # Plugin settings (matching GitHub Actions workflow)
    $settings = @(
        # LeiarKontekst
        "LeiarKontekst__Enabled=true",
        "LeiarKontekst__Endpoint=https://acs-copichat-4kt5uxo2hrzri.search.windows.net",
        "LeiarKontekst__IndexName=leiar-dokumenter",
        "LeiarKontekst__SemanticConfigurationName=leiar-semantic-config",
        "LeiarKontekst__MaxResults=5",
        "LeiarKontekst__MaxContentLength=30000",
        "LeiarKontekst__ContentFieldName=content",
        "LeiarKontekst__TitleFieldName=title",
        "LeiarKontekst__SourceFieldName=source",
        "LeiarKontekst__RequireApproval=false",
        
        # MimirKnowledge
        "MimirKnowledge__Enabled=true",
        "MimirKnowledge__Endpoint=https://acs-copichat-4kt5uxo2hrzri.search.windows.net",
        "MimirKnowledge__IndexName=mimir-knowledge",
        "MimirKnowledge__SemanticConfigurationName=mimir-semantic-config",
        "MimirKnowledge__MaxResults=5",
        "MimirKnowledge__MaxContentLength=15000",
        "MimirKnowledge__ContentFieldName=content",
        "MimirKnowledge__TitleFieldName=title",
        "MimirKnowledge__SourceFieldName=source",
        "MimirKnowledge__CategoryFieldName=category",
        "MimirKnowledge__RequireApproval=false",
        
        # SharePointObo
        "SharePointObo__Enabled=true",
        "SharePointObo__Authority=https://login.microsoftonline.com",
        "SharePointObo__TenantId=5b14945b-0f87-40dd-acf3-5e5e21e6eb36",
        "SharePointObo__ClientId=db0932b4-3bb7-4b89-a398-85be5940e84f",
        "SharePointObo__SiteUrl=https://vlfksky.sharepoint.com/sites/HR-kvalitet-HMS",
        "SharePointObo__AllowedSites__0=https://vlfksky.sharepoint.com/sites/HR-kvalitet-HMS",
        "SharePointObo__AllowedSites__1=https://vlfksky.sharepoint.com/sites/Omoss",
        "SharePointObo__DefaultScopes=https://graph.microsoft.com/Sites.Read.All https://graph.microsoft.com/Files.Read.All",
        "SharePointObo__MaxContentLength=50000",
        "SharePointObo__RequireApproval=false",
        
        # Lovdata
        "Lovdata__Enabled=true",
        "Lovdata__BaseUrl=https://api.lovdata.no",
        "Lovdata__MaxContentLength=50000",
        "Lovdata__MaxResults=20",
        "Lovdata__TimeoutSeconds=30",
        "Lovdata__RequireApproval=false",
        
        # Core settings
        "FastModel__Enabled=true",
        "FastModel__Deployment=gpt-4o-mini",
        "Models__DefaultModelId=gpt-5.2-chat",
        
        # Rate limiting
        "RateLimiting__Enabled=true",
        "RateLimiting__MessagesPerMinute=20",
        "RateLimiting__MessagesPerHour=200",
        "RateLimiting__ConcurrentRequestsPerUser=5",
        "RateLimiting__GlobalRequestsPerMinute=1000"
    )
    
    # Apply in batches
    $batchSize = 15
    for ($i = 0; $i -lt $settings.Count; $i += $batchSize) {
        $batch = $settings[$i..[Math]::Min($i + $batchSize - 1, $settings.Count - 1)]
        $batchNum = [Math]::Floor($i / $batchSize) + 1
        $totalBatches = [Math]::Ceiling($settings.Count / $batchSize)
        
        Write-Host "  Applying settings batch $batchNum/$totalBatches..." -ForegroundColor DarkGray
        
        az webapp config appsettings set `
            --resource-group $ResourceGroup `
            --name $AppName `
            --settings @batch `
            --output none
        
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Batch $batchNum may have failed, continuing..."
        }
    }
    
    Write-Host "  Configuration completed!" -ForegroundColor Green
    Write-Host ""
    
    # Restart app
    Write-Host "  Restarting web app..." -ForegroundColor DarkGray
    az webapp restart --resource-group $ResourceGroup --name $AppName
    Write-Host "  Restart initiated!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[4/4] Skipping configuration" -ForegroundColor DarkGray
    Write-Host ""
}

# ============================================
# SUMMARY
# ============================================
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  URL: https://$AppName.azurewebsites.net" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Note: API keys (Azure AI Search, SharePoint) are stored" -ForegroundColor Yellow
Write-Host "  separately and should already be configured." -ForegroundColor Yellow
Write-Host ""
Write-Host "  To verify deployment:" -ForegroundColor DarkGray
Write-Host "    az webapp log tail -g $ResourceGroup -n $AppName" -ForegroundColor DarkGray
Write-Host ""
