<#
.SYNOPSIS
Sync configuration from WebAPI to Memory Pipeline
#>

param(
  [Parameter(Mandatory)]
  [string]
  $ResourceGroupName,
    
  [Parameter(Mandatory)]
  [string]
  $WebApiName,
    
  [Parameter(Mandatory)]
  [string]
  $MemoryPipelineName
)

Write-Host "Syncing configuration from $WebApiName to $MemoryPipelineName..."

# Get all KernelMemory settings from webapi
Write-Host "Getting settings from WebAPI..."
$settings = az webapp config appsettings list --name $WebApiName --resource-group $ResourceGroupName | ConvertFrom-Json

# Filter for KernelMemory settings
$kmSettings = $settings | Where-Object { $_.name -like "KernelMemory:*" }

# Build settings hash
$settingsHash = @{}
foreach ($setting in $kmSettings) {
  if (![string]::IsNullOrEmpty($setting.value)) {
    $settingsHash[$setting.name] = $setting.value
  }
}

# Add Application Insights
$appInsights = $settings | Where-Object { $_.name -eq "APPLICATIONINSIGHTS_CONNECTION_STRING" }
if ($appInsights -and ![string]::IsNullOrEmpty($appInsights.value)) {
  $settingsHash["APPLICATIONINSIGHTS_CONNECTION_STRING"] = $appInsights.value
}

# Convert to settings array format
$settingsArray = @()
foreach ($key in $settingsHash.Keys) {
  $settingsArray += "$key=$($settingsHash[$key])"
}

Write-Host "Applying $($settingsArray.Count) settings to Memory Pipeline..."

# Apply all settings
az webapp config appsettings set `
  --name $MemoryPipelineName `
  --resource-group $ResourceGroupName `
  --settings $settingsArray `
  --output none

Write-Host "Configuration sync complete!"
Write-Host "Restarting Memory Pipeline..."

az webapp restart --name $MemoryPipelineName --resource-group $ResourceGroupName --output none

Write-Host "Done! Wait 30-60 seconds for startup, then test: https://$MemoryPipelineName.azurewebsites.net/"

