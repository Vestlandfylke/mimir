# Check Azure OpenAI configuration in production
# This helps diagnose if the base Azure OpenAI settings are missing

param(
    [string]$ResourceGroup = "rg-sk-copilot-npi",
    [string]$AppName = "app-copichat-4kt5uxo2hrzri-webapi"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Checking Azure OpenAI Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if logged in
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Please log in to Azure first: az login" -ForegroundColor Red
    exit 1
}
Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green

Write-Host "`nChecking current settings..." -ForegroundColor Yellow

# Get all settings
$settings = az webapp config appsettings list `
    --resource-group $ResourceGroup `
    --name $AppName `
    --output json | ConvertFrom-Json

# Check for critical Azure OpenAI settings
$criticalSettings = @(
    "KernelMemory__Services__AzureOpenAIText__Endpoint",
    "KernelMemory__Services__AzureOpenAIText__Deployment",
    "KernelMemory__Services__AzureOpenAIText__APIKey",
    "KernelMemory__Services__AzureOpenAIEmbedding__Endpoint",
    "KernelMemory__Services__AzureOpenAIEmbedding__Deployment",
    "KernelMemory__Services__AzureOpenAIEmbedding__APIKey",
    "FastModel__Enabled",
    "FastModel__Deployment"
)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Configuration Status:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$missingSettings = @()

foreach ($settingName in $criticalSettings) {
    $setting = $settings | Where-Object { $_.name -eq $settingName }
    
    if ($setting) {
        if ($settingName -like "*APIKey*") {
            Write-Host "✅ $settingName = [HIDDEN]" -ForegroundColor Green
        } else {
            Write-Host "✅ $settingName = $($setting.value)" -ForegroundColor Green
        }
    } else {
        Write-Host "❌ $settingName = [NOT SET]" -ForegroundColor Red
        $missingSettings += $settingName
    }
}

if ($missingSettings.Count -gt 0) {
    Write-Host "`n========================================" -ForegroundColor Yellow
    Write-Host "  ACTION REQUIRED" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "`nThe following settings are missing:" -ForegroundColor Yellow
    foreach ($missing in $missingSettings) {
        Write-Host "  - $missing" -ForegroundColor Yellow
    }
    Write-Host "`nThese settings are required for Azure OpenAI to work." -ForegroundColor Yellow
    Write-Host "`nExpected values from appsettings.json:" -ForegroundColor Cyan
    Write-Host "  Endpoint: https://ao-ai-swecent.openai.azure.com/"
    Write-Host "  Text Deployment: model-router"
    Write-Host "  Embedding Deployment: text-embedding-ada-002"
    Write-Host "  API Key: [FROM AZURE KEY VAULT OR SECRETS]"
    Write-Host ""
    
    Write-Host "Would you like to add these settings now? (Y/N): " -NoNewline -ForegroundColor Yellow
    $response = Read-Host
    
    if ($response -eq "Y" -or $response -eq "y") {
        Write-Host "`nPlease provide the Azure OpenAI API Key: " -NoNewline -ForegroundColor Yellow
        $apiKey = Read-Host -AsSecureString
        $apiKeyPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($apiKey))
        
        Write-Host "`nUpdating settings..." -ForegroundColor Yellow
        
        az webapp config appsettings set `
            --resource-group $ResourceGroup `
            --name $AppName `
            --settings `
                KernelMemory__Services__AzureOpenAIText__Endpoint="https://ao-ai-swecent.openai.azure.com/" `
                KernelMemory__Services__AzureOpenAIText__Deployment="model-router" `
                KernelMemory__Services__AzureOpenAIText__APIType="ChatCompletion" `
                KernelMemory__Services__AzureOpenAIText__MaxRetries="10" `
                KernelMemory__Services__AzureOpenAIText__Auth="ApiKey" `
                KernelMemory__Services__AzureOpenAIText__APIKey="$apiKeyPlain" `
                KernelMemory__Services__AzureOpenAIEmbedding__Endpoint="https://ao-ai-swecent.openai.azure.com/" `
                KernelMemory__Services__AzureOpenAIEmbedding__Deployment="text-embedding-ada-002" `
                KernelMemory__Services__AzureOpenAIEmbedding__Auth="ApiKey" `
                KernelMemory__Services__AzureOpenAIEmbedding__APIKey="$apiKeyPlain" `
            --output none
        
        Write-Host "✅ Settings updated!" -ForegroundColor Green
        
        Write-Host "`nRestarting WebAPI..." -ForegroundColor Yellow
        az webapp restart `
            --resource-group $ResourceGroup `
            --name $AppName
        
        Write-Host "✅ WebAPI restarted!" -ForegroundColor Green
    }
} else {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "  All Settings Configured ✅" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`nAll required Azure OpenAI settings are present." -ForegroundColor Green
}

Write-Host ""

