# ============================================
# Mimir Rate Limiting - Azure Setup Script
# Ressursgruppe: RG-SK-Copilot-NPI
# ============================================
#
# Dette scriptet opprettar Azure Cache for Redis og konfigurerer
# rate limiting for Mimir-applikasjonen.
#
# Bruk:
#   .\deploy-ratelimiting.ps1
#
# Føresetnader:
#   - Azure CLI installert og innlogga (az login)
#   - Tilgang til ressursgruppa RG-SK-Copilot-NPI
#
# Estimert kostnad: ~100-150 kr/mnd for Basic C0 Redis
# ============================================

param(
    [string]$ResourceGroup = "RG-SK-Copilot-NPI",
    [string]$Location = "swedencentral",
    [string]$RedisName = "redis-mimir-ratelimit",
    [string]$WebAppName = "app-copichat-4kt5uxo2hrzri-webapi",
    [int]$MessagesPerMinute = 20,
    [int]$MessagesPerHour = 200,
    [int]$ConcurrentRequestsPerUser = 5,
    [int]$GlobalRequestsPerMinute = 1000
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Mimir Rate Limiting - Azure Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Konfigurasjon:"
Write-Host "  Ressursgruppe:    $ResourceGroup"
Write-Host "  Lokasjon:         $Location"
Write-Host "  Redis-namn:       $RedisName"
Write-Host "  Web App:          $WebAppName"
Write-Host ""
Write-Host "Rate Limiting-grenser:"
Write-Host "  Meldingar/minutt: $MessagesPerMinute"
Write-Host "  Meldingar/time:   $MessagesPerHour"
Write-Host "  Samtidige/brukar: $ConcurrentRequestsPerUser"
Write-Host "  Globalt/minutt:   $GlobalRequestsPerMinute"
Write-Host ""

# Bekreft at brukar vil fortsetje
$confirm = Read-Host "Vil du fortsetje? (j/n)"
if ($confirm -ne "j" -and $confirm -ne "J" -and $confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Avbrote." -ForegroundColor Yellow
    exit 0
}

# Sjekk om Redis allereie eksisterer
Write-Host ""
Write-Host "🔍 Sjekkar om Redis allereie eksisterer..." -ForegroundColor Yellow
$existingRedis = az redis show --name $RedisName --resource-group $ResourceGroup 2>$null
if ($existingRedis) {
    Write-Host "⚠️  Redis '$RedisName' eksisterer allereie." -ForegroundColor Yellow
    $useExisting = Read-Host "Vil du bruke eksisterande Redis? (j/n)"
    if ($useExisting -ne "j" -and $useExisting -ne "J" -and $useExisting -ne "y" -and $useExisting -ne "Y") {
        Write-Host "Avbrote." -ForegroundColor Yellow
        exit 0
    }
} else {
    # 1. Opprett Redis Cache (Basic C0)
    Write-Host ""
    Write-Host "📦 Opprettar Azure Cache for Redis (Basic C0)..." -ForegroundColor Yellow
    Write-Host "   Dette kan ta 10-20 minutt..." -ForegroundColor Gray
    
    az redis create `
        --name $RedisName `
        --resource-group $ResourceGroup `
        --location $Location `
        --sku Basic `
        --vm-size c0 `
        --enable-non-ssl-port false `
        --minimum-tls-version 1.2 `
        --tags "Purpose=RateLimiting" "App=Mimir"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Feil ved oppretting av Redis." -ForegroundColor Red
        exit 1
    }
    
    # 2. Vent på provisjonering
    Write-Host ""
    Write-Host "⏳ Ventar på at Redis blir klar..." -ForegroundColor Yellow
    $maxAttempts = 40  # Max 20 minutt (40 * 30 sekund)
    $attempt = 0
    
    do {
        Start-Sleep -Seconds 30
        $attempt++
        $state = az redis show --name $RedisName --resource-group $ResourceGroup --query "provisioningState" -o tsv
        Write-Host "   [$attempt/$maxAttempts] Status: $state"
        
        if ($attempt -ge $maxAttempts) {
            Write-Host "❌ Tidsavbrot - Redis brukte for lang tid." -ForegroundColor Red
            exit 1
        }
    } while ($state -ne "Succeeded")
    
    Write-Host "✅ Redis er klar!" -ForegroundColor Green
}

# 3. Hent credentials
Write-Host ""
Write-Host "🔑 Hentar Redis credentials..." -ForegroundColor Yellow
$redisKey = az redis list-keys --name $RedisName --resource-group $ResourceGroup --query "primaryKey" -o tsv
$redisHost = az redis show --name $RedisName --resource-group $ResourceGroup --query "hostName" -o tsv

if (-not $redisKey -or -not $redisHost) {
    Write-Host "❌ Kunne ikkje hente Redis credentials." -ForegroundColor Red
    exit 1
}

$redisConnectionString = "${redisHost}:6380,password=${redisKey},ssl=True,abortConnect=False"
Write-Host "   Host: $redisHost" -ForegroundColor Gray

# 4. Konfigurer App Service
Write-Host ""
Write-Host "⚙️  Konfigurerer App Service med rate limiting..." -ForegroundColor Yellow

az webapp config appsettings set `
    --name $WebAppName `
    --resource-group $ResourceGroup `
    --settings `
        "RateLimiting__Enabled=true" `
        "RateLimiting__MessagesPerMinute=$MessagesPerMinute" `
        "RateLimiting__MessagesPerHour=$MessagesPerHour" `
        "RateLimiting__ConcurrentRequestsPerUser=$ConcurrentRequestsPerUser" `
        "RateLimiting__GlobalRequestsPerMinute=$GlobalRequestsPerMinute" `
        "RateLimiting__RedisConnectionString=$redisConnectionString" `
    --output none

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Feil ved konfigurasjon av App Service." -ForegroundColor Red
    exit 1
}

Write-Host "✅ App Service konfigurert!" -ForegroundColor Green

# 5. Restart app for å ta i bruk nye innstillingar
Write-Host ""
Write-Host "🔄 Restartar App Service..." -ForegroundColor Yellow
az webapp restart --name $WebAppName --resource-group $ResourceGroup

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Åtvaring: Kunne ikkje restarte App Service automatisk." -ForegroundColor Yellow
    Write-Host "   Du må kanskje restarte manuelt i Azure Portal." -ForegroundColor Yellow
} else {
    Write-Host "✅ App Service restarta!" -ForegroundColor Green
}

# Oppsummering
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " ✅ Rate limiting er konfigurert!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ressursar:"
Write-Host "  Redis:      $RedisName ($Location)"
Write-Host "  App:        $WebAppName"
Write-Host ""
Write-Host "Grenser:"
Write-Host "  Meldingar per minutt:  $MessagesPerMinute"
Write-Host "  Meldingar per time:    $MessagesPerHour"
Write-Host "  Samtidige per brukar:  $ConcurrentRequestsPerUser"
Write-Host "  Globalt per minutt:    $GlobalRequestsPerMinute"
Write-Host ""
Write-Host "💰 Estimert kostnad: ~100-150 kr/mnd for Basic C0 Redis"
Write-Host ""
Write-Host "📊 Overvak Redis i Azure Portal:"
Write-Host "   https://portal.azure.com/#resource/subscriptions/sub-ikt-ki/resourceGroups/$ResourceGroup/providers/Microsoft.Cache/Redis/$RedisName/overview"
Write-Host ""
