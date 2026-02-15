<#
.SYNOPSIS
    Creates the mimir-knowledge Azure AI Search index and uploads documentation.

.DESCRIPTION
    This script:
    1. Creates the search index with proper schema and semantic configuration
    2. Reads markdown files from docs/mimir-knowledge/
    3. Uploads documents to the index

.PARAMETER SearchServiceName
    The name of the Azure AI Search service (default: acs-copichat-4kt5uxo2hrzri)

.PARAMETER ApiKey
    The admin API key for the Azure AI Search service

.PARAMETER IndexName
    The name of the index to create (default: mimir-knowledge)

.EXAMPLE
    .\setup-mimir-knowledge-index.ps1 -ApiKey "your-admin-api-key-from-azure-portal"
#>

param(
    [string]$SearchServiceName = "acs-copichat-4kt5uxo2hrzri",
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,
    [string]$IndexName = "mimir-knowledge"
)

$ErrorActionPreference = "Stop"

# Ensure UTF-8 encoding for API calls
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Configuration
$SearchEndpoint = "https://$SearchServiceName.search.windows.net"
$ApiVersion = "2023-11-01"
$DocsPath = Join-Path $PSScriptRoot "..\..\docs\mimir-knowledge"

Write-Host "=== Mimir Knowledge Index Setup ===" -ForegroundColor Cyan
Write-Host "Search Service: $SearchServiceName"
Write-Host "Index Name: $IndexName"
Write-Host "Docs Path: $DocsPath"
Write-Host ""

# Headers for API calls
$headers = @{
    "Content-Type" = "application/json"
    "api-key" = $ApiKey
}

# Step 1: Delete existing index if it exists
Write-Host "Step 1: Checking for existing index..." -ForegroundColor Yellow
try {
    $deleteUrl = "$SearchEndpoint/indexes/$($IndexName)?api-version=$ApiVersion"
    Invoke-RestMethod -Uri $deleteUrl -Method Delete -Headers $headers
    Write-Host "  Deleted existing index." -ForegroundColor Green
    Start-Sleep -Seconds 2
} catch {
    Write-Host "  No existing index found (this is OK)." -ForegroundColor Gray
}

# Step 2: Create the index with schema and semantic configuration
Write-Host "Step 2: Creating index with schema..." -ForegroundColor Yellow

$indexSchema = @{
    name = $IndexName
    fields = @(
        @{
            name = "id"
            type = "Edm.String"
            key = $true
            searchable = $false
            filterable = $false
            sortable = $false
            facetable = $false
        },
        @{
            name = "title"
            type = "Edm.String"
            searchable = $true
            filterable = $true
            sortable = $true
            facetable = $false
            analyzer = "nb.microsoft"
        },
        @{
            name = "content"
            type = "Edm.String"
            searchable = $true
            filterable = $false
            sortable = $false
            facetable = $false
            analyzer = "nb.microsoft"
        },
        @{
            name = "source"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $false
        },
        @{
            name = "category"
            type = "Edm.String"
            searchable = $true
            filterable = $true
            sortable = $false
            facetable = $true
        }
    )
    semantic = @{
        defaultConfiguration = "mimir-semantic-config"
        configurations = @(
            @{
                name = "mimir-semantic-config"
                prioritizedFields = @{
                    titleField = @{
                        fieldName = "title"
                    }
                    prioritizedContentFields = @(
                        @{
                            fieldName = "content"
                        }
                    )
                    prioritizedKeywordsFields = @(
                        @{
                            fieldName = "category"
                        }
                    )
                }
            }
        )
    }
} | ConvertTo-Json -Depth 10

$createIndexUrl = "$SearchEndpoint/indexes?api-version=$ApiVersion"
try {
    $response = Invoke-RestMethod -Uri $createIndexUrl -Method Post -Headers $headers -Body $indexSchema
    Write-Host "  Index created successfully!" -ForegroundColor Green
} catch {
    Write-Host "  Error creating index: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "  Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

Start-Sleep -Seconds 2

# Step 3: Prepare documents from markdown files
Write-Host "Step 3: Reading documentation files..." -ForegroundColor Yellow

# Document metadata mapping
$documentMeta = @{
    "mimir-ui-guide.md" = @{
        id = "mimir-ui-guide"
        title = "Komplett brukarrettleiing for Mimir"
        category = "ui"
    }
    "mimir-prompting-guide.md" = @{
        id = "mimir-prompting-guide"
        title = "Tips for aa faa gode svar fraa Mimir"
        category = "prompting"
    }
    "mimir-history.md" = @{
        id = "mimir-history"
        title = "Historia til Mimir - fraa Copilot-prosjektet til i dag"
        category = "history"
    }
    "mimir-features.md" = @{
        id = "mimir-features"
        title = "Mimir sine funksjonar og evner"
        category = "features"
    }
    "mimir-ki-policy.md" = @{
        id = "mimir-ki-policy"
        title = "KI-tenester i Vestland fylkeskommune - kva kan du bruke?"
        category = "policy"
    }
    "mimir-ki-policy-official.md" = @{
        id = "mimir-ki-policy-official"
        title = "Policy for bruk av kunstig intelligens (KI eller AI)"
        category = "policy"
    }
    "mimir-vestland-info.md" = @{
        id = "mimir-vestland-info"
        title = "Viktig informasjon om Vestland fylkeskommune"
        category = "info"
    }
    "mimir-faq.md" = @{
        id = "mimir-faq"
        title = "Spoersmaal og svar om Mimir"
        category = "faq"
    }
    "mimir-organisasjonsstrategi.md" = @{
        id = "mimir-organisasjonsstrategi"
        title = "Organisasjonsstrategi for Vestland fylkeskommune 2024-2028"
        category = "strategi"
    }
}

$documents = @()

foreach ($file in Get-ChildItem -Path $DocsPath -Filter "*.md") {
    if ($file.Name -eq "README.md") {
        Write-Host "  Skipping README.md" -ForegroundColor Gray
        continue
    }
    
    $meta = $documentMeta[$file.Name]
    if (-not $meta) {
        Write-Host "  Warning: No metadata for $($file.Name), skipping..." -ForegroundColor Yellow
        continue
    }
    
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    
    $doc = @{
        "@search.action" = "upload"
        id = $meta.id
        title = $meta.title
        content = $content
        source = "docs/mimir-knowledge/$($file.Name)"
        category = $meta.category
    }
    
    $documents += $doc
    Write-Host "  Prepared: $($file.Name) (category: $($meta.category))" -ForegroundColor Green
}

Write-Host "  Total documents: $($documents.Count)" -ForegroundColor Cyan

# Step 4: Upload documents
Write-Host "Step 4: Uploading documents to index..." -ForegroundColor Yellow

$uploadPayload = @{
    value = $documents
} | ConvertTo-Json -Depth 10 -EscapeHandling EscapeNonAscii

$uploadUrl = "$SearchEndpoint/indexes/$IndexName/docs/index?api-version=$ApiVersion"

try {
    $response = Invoke-RestMethod -Uri $uploadUrl -Method Post -Headers $headers -Body $uploadPayload
    Write-Host "  Documents uploaded successfully!" -ForegroundColor Green
    Write-Host "  Results:" -ForegroundColor Cyan
    foreach ($result in $response.value) {
        $status = if ($result.status) { "OK" } else { "FAILED" }
        $color = if ($result.status) { "Green" } else { "Red" }
        Write-Host "    - $($result.key): $status" -ForegroundColor $color
    }
} catch {
    Write-Host "  Error uploading documents: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

# Step 5: Verify index
Write-Host "Step 5: Verifying index..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

$statsUrl = "$SearchEndpoint/indexes/$IndexName/stats?api-version=$ApiVersion"
try {
    $stats = Invoke-RestMethod -Uri $statsUrl -Method Get -Headers $headers
    Write-Host "  Document count: $($stats.documentCount)" -ForegroundColor Cyan
    Write-Host "  Storage size: $($stats.storageSize) bytes" -ForegroundColor Cyan
} catch {
    Write-Host "  Could not retrieve stats (index may still be updating)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Set the API key in user secrets:"
Write-Host "   dotnet user-secrets set `"MimirKnowledge:ApiKey`" `"$ApiKey`"" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. Enable the plugin in appsettings.json:"
Write-Host "   Set `"MimirKnowledge:Enabled`": true" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Restart the webapi to load the plugin"
Write-Host ""
