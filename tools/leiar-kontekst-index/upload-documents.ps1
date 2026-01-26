<#
.SYNOPSIS
    Uploads documents to the Leiar Kontekst search index.

.DESCRIPTION
    Reads documents from a folder and uploads them to Azure AI Search.
    Supports: .txt, .md, .json files
    
    For JSON files, expects format:
    {
        "title": "Document Title",
        "content": "Document content...",
        "category": "strategi",
        "source": "https://..."
    }

.PARAMETER DocumentsPath
    Path to folder containing documents

.PARAMETER SearchServiceName
    Name of your Azure AI Search service

.PARAMETER ApiKey
    Admin API key for the search service

.PARAMETER IndexName
    Name of the index (default: leiar-dokumenter)

.PARAMETER DefaultCategory
    Default category for documents without one (default: generelt)

.EXAMPLE
    .\upload-documents.ps1 -DocumentsPath ".\docs" -SearchServiceName "my-search" -ApiKey "abc123"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$DocumentsPath,

    [Parameter(Mandatory = $true)]
    [string]$SearchServiceName,

    [Parameter(Mandatory = $true)]
    [string]$ApiKey,

    [string]$IndexName = "leiar-dokumenter",

    [string]$DefaultCategory = "generelt"
)

$ErrorActionPreference = "Stop"

$SearchEndpoint = "https://$SearchServiceName.search.windows.net"
$ApiVersion = "2024-07-01"

Write-Host "Uploading documents to '$IndexName'..." -ForegroundColor Cyan

if (-not (Test-Path $DocumentsPath)) {
    Write-Host "Error: Path '$DocumentsPath' not found" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Content-Type" = "application/json"
    "api-key" = $ApiKey
}

$documents = @()
$files = Get-ChildItem -Path $DocumentsPath -Include "*.txt", "*.md", "*.json" -Recurse

Write-Host "Found $($files.Count) files to process..." -ForegroundColor Yellow

foreach ($file in $files) {
    Write-Host "  Processing: $($file.Name)" -ForegroundColor Gray
    
    $doc = @{
        "@search.action" = "mergeOrUpload"
        lastUpdated = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    }
    
    if ($file.Extension -eq ".json") {
        # JSON file - parse structure
        $jsonContent = Get-Content $file.FullName -Raw | ConvertFrom-Json
        
        $doc.id = if ($jsonContent.id) { $jsonContent.id } else { [guid]::NewGuid().ToString() }
        $doc.title = if ($jsonContent.title) { $jsonContent.title } else { $file.BaseName }
        $doc.content = if ($jsonContent.content) { $jsonContent.content } else { "" }
        $doc.category = if ($jsonContent.category) { $jsonContent.category } else { $DefaultCategory }
        $doc.source = if ($jsonContent.source) { $jsonContent.source } else { $file.FullName }
        
        if ($jsonContent.metadata) {
            $doc.metadata = $jsonContent.metadata | ConvertTo-Json -Compress
        }
    }
    else {
        # Text/Markdown file
        $content = Get-Content $file.FullName -Raw
        
        # Try to extract title from first line (# heading or first line)
        $lines = $content -split "`n"
        $title = $file.BaseName
        if ($lines[0] -match "^#\s+(.+)$") {
            $title = $matches[1].Trim()
        }
        
        $doc.id = [guid]::NewGuid().ToString()
        $doc.title = $title
        $doc.content = $content
        $doc.category = $DefaultCategory
        $doc.source = $file.FullName
    }
    
    $documents += $doc
}

if ($documents.Count -eq 0) {
    Write-Host "No documents found to upload" -ForegroundColor Yellow
    exit 0
}

# Upload in batches of 100
$batchSize = 100
$totalBatches = [math]::Ceiling($documents.Count / $batchSize)

for ($i = 0; $i -lt $documents.Count; $i += $batchSize) {
    $batch = $documents[$i..([math]::Min($i + $batchSize - 1, $documents.Count - 1))]
    $batchNum = [math]::Floor($i / $batchSize) + 1
    
    Write-Host "Uploading batch $batchNum of $totalBatches ($($batch.Count) documents)..." -ForegroundColor Cyan
    
    $body = @{
        value = $batch
    } | ConvertTo-Json -Depth 10
    
    $uri = "$SearchEndpoint/indexes/$IndexName/docs/index?api-version=$ApiVersion"
    
    try {
        $response = Invoke-RestMethod -Uri $uri -Headers $headers -Method Post -Body $body
        
        $succeeded = ($response.value | Where-Object { $_.status -eq $true }).Count
        $failed = ($response.value | Where-Object { $_.status -eq $false }).Count
        
        Write-Host "  Succeeded: $succeeded, Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Yellow" } else { "Green" })
        
        if ($failed -gt 0) {
            $response.value | Where-Object { $_.status -eq $false } | ForEach-Object {
                Write-Host "    Failed: $($_.key) - $($_.errorMessage)" -ForegroundColor Red
            }
        }
    }
    catch {
        Write-Host "Error uploading batch: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host $_.ErrorDetails.Message -ForegroundColor Red
        }
    }
}

Write-Host "`nUpload complete!" -ForegroundColor Green
Write-Host "Total documents processed: $($documents.Count)" -ForegroundColor Cyan
