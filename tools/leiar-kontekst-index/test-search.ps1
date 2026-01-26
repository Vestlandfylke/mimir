<#
.SYNOPSIS
    Tests the Leiar Kontekst search index.

.DESCRIPTION
    Runs test queries against the search index to verify it's working correctly.

.PARAMETER Query
    The search query to test

.PARAMETER SearchServiceName
    Name of your Azure AI Search service

.PARAMETER ApiKey
    API key for the search service (query key is sufficient)

.PARAMETER IndexName
    Name of the index (default: leiar-dokumenter)

.PARAMETER Semantic
    Use semantic search mode

.PARAMETER Top
    Number of results to return (default: 5)

.EXAMPLE
    .\test-search.ps1 -Query "sjukefråvær" -SearchServiceName "my-search" -ApiKey "abc123"

.EXAMPLE
    .\test-search.ps1 -Query "korleis handtere konfliktar" -SearchServiceName "my-search" -ApiKey "abc123" -Semantic
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Query,

    [Parameter(Mandatory = $true)]
    [string]$SearchServiceName,

    [Parameter(Mandatory = $true)]
    [string]$ApiKey,

    [string]$IndexName = "leiar-dokumenter",

    [switch]$Semantic,

    [int]$Top = 5
)

$ErrorActionPreference = "Stop"

$SearchEndpoint = "https://$SearchServiceName.search.windows.net"
$ApiVersion = "2024-07-01"

Write-Host "`nSearching for: '$Query'" -ForegroundColor Cyan
Write-Host "Mode: $(if ($Semantic) { 'Semantic' } else { 'Keyword' })" -ForegroundColor Gray
Write-Host "-------------------------------------------" -ForegroundColor Gray

$headers = @{
    "Content-Type" = "application/json"
    "api-key" = $ApiKey
}

$searchBody = @{
    search = $Query
    top = $Top
    select = "id,title,content,category,source"
    count = $true
    highlight = "content"
    highlightPreTag = ">>>"
    highlightPostTag = "<<<"
}

if ($Semantic) {
    $searchBody.queryType = "semantic"
    $searchBody.semanticConfiguration = "leiar-semantic-config"
    $searchBody.captions = "extractive"
    $searchBody.answers = "extractive"
}

$body = $searchBody | ConvertTo-Json -Depth 5
$uri = "$SearchEndpoint/indexes/$IndexName/docs/search?api-version=$ApiVersion"

try {
    $response = Invoke-RestMethod -Uri $uri -Headers $headers -Method Post -Body $body
    
    Write-Host "`nFound $($response.'@odata.count') results" -ForegroundColor Green
    
    # Show semantic answers if available
    if ($response.'@search.answers' -and $response.'@search.answers'.Count -gt 0) {
        Write-Host "`n=== Semantic Answers ===" -ForegroundColor Yellow
        foreach ($answer in $response.'@search.answers') {
            Write-Host "`nAnswer (score: $([math]::Round($answer.score, 2))):" -ForegroundColor Cyan
            Write-Host $answer.text -ForegroundColor White
        }
    }
    
    Write-Host "`n=== Search Results ===" -ForegroundColor Yellow
    
    $resultNum = 1
    foreach ($result in $response.value) {
        Write-Host "`n[$resultNum] $($result.title)" -ForegroundColor Cyan
        Write-Host "    Category: $($result.category)" -ForegroundColor Gray
        Write-Host "    Source: $($result.source)" -ForegroundColor Gray
        
        if ($result.'@search.score') {
            Write-Host "    Score: $([math]::Round($result.'@search.score', 4))" -ForegroundColor Gray
        }
        
        if ($result.'@search.rerankerScore') {
            Write-Host "    Semantic Score: $([math]::Round($result.'@search.rerankerScore', 4))" -ForegroundColor Gray
        }
        
        # Show captions if available
        if ($result.'@search.captions' -and $result.'@search.captions'.Count -gt 0) {
            Write-Host "    Caption: $($result.'@search.captions'[0].text)" -ForegroundColor White
        }
        # Otherwise show highlights
        elseif ($result.'@search.highlights' -and $result.'@search.highlights'.content) {
            $highlight = $result.'@search.highlights'.content[0]
            if ($highlight.Length -gt 200) {
                $highlight = $highlight.Substring(0, 200) + "..."
            }
            Write-Host "    Highlight: $highlight" -ForegroundColor White
        }
        # Otherwise show content preview
        else {
            $preview = $result.content
            if ($preview.Length -gt 200) {
                $preview = $preview.Substring(0, 200) + "..."
            }
            Write-Host "    Preview: $preview" -ForegroundColor White
        }
        
        $resultNum++
    }
    
    Write-Host "`n-------------------------------------------" -ForegroundColor Gray
}
catch {
    Write-Host "Error searching: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
    exit 1
}
