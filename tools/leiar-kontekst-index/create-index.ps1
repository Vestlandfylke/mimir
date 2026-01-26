<#
.SYNOPSIS
    Creates the Azure AI Search index for Leiar Kontekst plugin.

.DESCRIPTION
    Sets up the search index with:
    - Norwegian language analyzer
    - Semantic search configuration
    - Vector search (optional)
    - Proper field types and attributes

.PARAMETER SearchServiceName
    Name of your Azure AI Search service

.PARAMETER ApiKey
    Admin API key for the search service

.PARAMETER IndexName
    Name of the index to create (default: leiar-dokumenter)

.PARAMETER EnableVectorSearch
    Enable vector search fields (requires embedding pipeline)

.EXAMPLE
    .\create-index.ps1 -SearchServiceName "my-search" -ApiKey "abc123"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$SearchServiceName,

    [Parameter(Mandatory = $true)]
    [string]$ApiKey,

    [string]$IndexName = "leiar-dokumenter",

    [switch]$EnableVectorSearch
)

$ErrorActionPreference = "Stop"

$SearchEndpoint = "https://$SearchServiceName.search.windows.net"
$ApiVersion = "2023-11-01"

Write-Host "Creating index '$IndexName' on $SearchEndpoint..." -ForegroundColor Cyan

# Build the index schema
$indexSchema = @{
    name = $IndexName
    fields = @(
        @{
            name = "id"
            type = "Edm.String"
            key = $true
            filterable = $true
        },
        @{
            name = "title"
            type = "Edm.String"
            searchable = $true
            filterable = $true
            sortable = $true
            analyzer = "nb.microsoft"  # Norwegian Bokmål analyzer
        },
        @{
            name = "content"
            type = "Edm.String"
            searchable = $true
            analyzer = "nb.microsoft"
        },
        @{
            name = "source"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $true
        },
        @{
            name = "category"
            type = "Edm.String"
            searchable = $true
            filterable = $true
            facetable = $true
            sortable = $true
        },
        @{
            name = "lastUpdated"
            type = "Edm.DateTimeOffset"
            filterable = $true
            sortable = $true
        },
        @{
            name = "metadata"
            type = "Edm.String"
            searchable = $false
            filterable = $false
        }
    )
    suggesters = @(
        @{
            name = "sg"
            searchMode = "analyzingInfixMatching"
            sourceFields = @("title")
        }
    )
    semantic = @{
        defaultConfiguration = "leiar-semantic-config"
        configurations = @(
            @{
                name = "leiar-semantic-config"
                prioritizedFields = @{
                    titleField = @{
                        fieldName = "title"
                    }
                    prioritizedContentFields = @(
                        @{
                            fieldName = "content"
                        }
                    )
                }
            }
        )
    }
}

# Add vector search configuration if enabled
if ($EnableVectorSearch) {
    Write-Host "Enabling vector search..." -ForegroundColor Yellow
    
    # Add vector field
    $indexSchema.fields += @{
        name = "contentVector"
        type = "Collection(Edm.Single)"
        searchable = $true
        dimensions = 1536  # text-embedding-ada-002 dimensions
        vectorSearchProfile = "vector-profile"
    }
    
    # Add vector search configuration
    $indexSchema.vectorSearch = @{
        algorithms = @(
            @{
                name = "hnsw-algorithm"
                kind = "hnsw"
                hnswParameters = @{
                    m = 4
                    efConstruction = 400
                    efSearch = 500
                    metric = "cosine"
                }
            }
        )
        profiles = @(
            @{
                name = "vector-profile"
                algorithm = "hnsw-algorithm"
            }
        )
    }
}

$body = $indexSchema | ConvertTo-Json -Depth 10

$headers = @{
    "Content-Type" = "application/json"
    "api-key" = $ApiKey
}

$uri = "$SearchEndpoint/indexes/$($IndexName)?api-version=$ApiVersion"

try {
    # Check if index exists
    $checkUri = "$SearchEndpoint/indexes/$($IndexName)?api-version=$ApiVersion"
    try {
        $existing = Invoke-RestMethod -Uri $checkUri -Headers $headers -Method Get
        Write-Host "Index '$IndexName' already exists. Deleting and recreating..." -ForegroundColor Yellow
        Invoke-RestMethod -Uri $checkUri -Headers $headers -Method Delete | Out-Null
        Start-Sleep -Seconds 2
    }
    catch {
        # Index doesn't exist, which is fine
    }

    # Create the index
    $response = Invoke-RestMethod -Uri $uri -Headers $headers -Method Put -Body $body
    
    Write-Host "`nIndex '$IndexName' created successfully!" -ForegroundColor Green
    Write-Host "`nIndex details:" -ForegroundColor Cyan
    Write-Host "  - Fields: $($indexSchema.fields.Count)"
    Write-Host "  - Semantic config: leiar-semantic-config"
    Write-Host "  - Vector search: $(if ($EnableVectorSearch) { 'Enabled' } else { 'Disabled' })"
    Write-Host "  - Language analyzer: nb.microsoft (Norwegian)"
    
    Write-Host "`nNext steps:" -ForegroundColor Yellow
    Write-Host "  1. Upload documents using upload-documents.ps1"
    Write-Host "  2. Configure Mimir with the index settings"
    Write-Host "  3. Set API key in user-secrets"
}
catch {
    Write-Host "Error creating index: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
    exit 1
}
