# Verify Mimir Knowledge Index
# This script checks that the Azure AI Search index is properly populated

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,
    
    [string]$SearchService = "acs-copichat-4kt5uxo2hrzri",
    [string]$IndexName = "mimir-knowledge"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseUrl = "https://$SearchService.search.windows.net"
$apiVersion = "2023-11-01"

$headers = @{
    "api-key" = $ApiKey
    "Content-Type" = "application/json"
}

Write-Host "`n=== Mimir Knowledge Index Verification ===" -ForegroundColor Cyan
Write-Host "Search Service: $SearchService"
Write-Host "Index Name: $IndexName`n"

# Step 1: Get index statistics
Write-Host "Step 1: Checking index statistics..." -ForegroundColor Yellow
try {
    $statsUrl = "$baseUrl/indexes/$IndexName/docs/`$count?api-version=$apiVersion"
    $docCount = Invoke-RestMethod -Uri $statsUrl -Headers $headers -Method Get
    
    if ($docCount -eq 0) {
        Write-Host "  WARNING: Document count is 0!" -ForegroundColor Red
        Write-Host "  The index may still be indexing, or documents were not uploaded correctly."
        Write-Host "  Try running setup-mimir-knowledge-index.ps1 again."
    } else {
        Write-Host "  Document count: $docCount" -ForegroundColor Green
    }
} catch {
    Write-Host "  Error getting count: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 2: List all documents
Write-Host "`nStep 2: Listing all documents..." -ForegroundColor Yellow
try {
    $searchUrl = "$baseUrl/indexes/$IndexName/docs/search?api-version=$apiVersion"
    $searchBody = @{
        search = "*"
        select = "id,title,category,source"
        top = 20
    } | ConvertTo-Json

    $results = Invoke-RestMethod -Uri $searchUrl -Headers $headers -Method Post -Body $searchBody
    
    if ($results.value.Count -eq 0) {
        Write-Host "  No documents found in index!" -ForegroundColor Red
    } else {
        Write-Host "  Found $($results.value.Count) documents:" -ForegroundColor Green
        foreach ($doc in $results.value) {
            Write-Host "    - [$($doc.category)] $($doc.title)" -ForegroundColor White
            Write-Host "      ID: $($doc.id)" -ForegroundColor DarkGray
        }
    }
} catch {
    Write-Host "  Error listing documents: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 3: Test search for "tidslinje" (timeline)
Write-Host "`nStep 3: Testing search for 'tidslinje'..." -ForegroundColor Yellow
try {
    $searchBody = @{
        search = "tidslinje prosjekt"
        select = "id,title,category"
        top = 5
        queryType = "simple"
    } | ConvertTo-Json

    $results = Invoke-RestMethod -Uri $searchUrl -Headers $headers -Method Post -Body $searchBody
    
    if ($results.value.Count -eq 0) {
        Write-Host "  No results for 'tidslinje' search" -ForegroundColor Red
    } else {
        Write-Host "  Found $($results.value.Count) results:" -ForegroundColor Green
        foreach ($doc in $results.value) {
            Write-Host "    - [$($doc.category)] $($doc.title)" -ForegroundColor White
        }
    }
} catch {
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 4: Test search in history category
Write-Host "`nStep 4: Testing history category filter..." -ForegroundColor Yellow
try {
    $searchBody = @{
        search = "*"
        filter = "category eq 'history'"
        select = "id,title,category"
        top = 5
    } | ConvertTo-Json

    $results = Invoke-RestMethod -Uri $searchUrl -Headers $headers -Method Post -Body $searchBody
    
    if ($results.value.Count -eq 0) {
        Write-Host "  No documents in 'history' category!" -ForegroundColor Red
    } else {
        Write-Host "  Found $($results.value.Count) history documents:" -ForegroundColor Green
        foreach ($doc in $results.value) {
            Write-Host "    - $($doc.title)" -ForegroundColor White
        }
    }
} catch {
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 5: Check content of history document
Write-Host "`nStep 5: Checking history document content..." -ForegroundColor Yellow
try {
    $searchBody = @{
        search = "*"
        filter = "category eq 'history'"
        select = "id,title,content"
        top = 1
    } | ConvertTo-Json

    $results = Invoke-RestMethod -Uri $searchUrl -Headers $headers -Method Post -Body $searchBody
    
    if ($results.value.Count -gt 0) {
        $content = $results.value[0].content
        Write-Host "  Title: $($results.value[0].title)" -ForegroundColor Green
        Write-Host "  Content length: $($content.Length) characters" -ForegroundColor Green
        
        # Check if timeline content is present
        if ($content -match "Tidslinje") {
            Write-Host "  Timeline section: FOUND" -ForegroundColor Green
        } else {
            Write-Host "  Timeline section: NOT FOUND" -ForegroundColor Red
        }
        
        if ($content -match "februar 2024") {
            Write-Host "  Start date (februar 2024): FOUND" -ForegroundColor Green
        } else {
            Write-Host "  Start date (februar 2024): NOT FOUND" -ForegroundColor Red
        }
        
        if ($content -match "Fase 1" -and $content -match "Fase 2") {
            Write-Host "  Project phases: FOUND" -ForegroundColor Green
        } else {
            Write-Host "  Project phases: NOT FOUND" -ForegroundColor Red
        }
        
        # Show first 500 chars
        Write-Host "`n  Content preview (first 500 chars):" -ForegroundColor Cyan
        Write-Host "  $($content.Substring(0, [Math]::Min(500, $content.Length)))..." -ForegroundColor DarkGray
    }
} catch {
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 6: Test semantic search (if configured)
Write-Host "`nStep 6: Testing semantic search..." -ForegroundColor Yellow
try {
    $searchBody = @{
        search = "kva var tidslinja for copilot prosjektet"
        queryType = "semantic"
        semanticConfiguration = "mimir-semantic-config"
        select = "id,title,category"
        top = 3
        captions = "extractive"
        answers = "extractive"
    } | ConvertTo-Json

    $results = Invoke-RestMethod -Uri $searchUrl -Headers $headers -Method Post -Body $searchBody
    
    if ($results.value.Count -eq 0) {
        Write-Host "  No semantic search results" -ForegroundColor Red
    } else {
        Write-Host "  Semantic search returned $($results.value.Count) results:" -ForegroundColor Green
        foreach ($doc in $results.value) {
            Write-Host "    - [$($doc.category)] $($doc.title)" -ForegroundColor White
        }
        
        # Show semantic answers if available
        if ($results.'@search.answers' -and $results.'@search.answers'.Count -gt 0) {
            Write-Host "`n  Semantic answers found:" -ForegroundColor Green
            foreach ($answer in $results.'@search.answers') {
                Write-Host "    Score: $($answer.score)" -ForegroundColor Cyan
                Write-Host "    Text: $($answer.text.Substring(0, [Math]::Min(200, $answer.text.Length)))..." -ForegroundColor DarkGray
            }
        } else {
            Write-Host "  No semantic answers extracted" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "  Semantic search error (may not be configured): $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n=== Verification Complete ===" -ForegroundColor Cyan
Write-Host "`nIf document count is 0 or documents are missing:"
Write-Host "1. Run: .\setup-mimir-knowledge-index.ps1 -ApiKey `"$ApiKey`""
Write-Host "2. Wait 1-2 minutes for indexing"
Write-Host "3. Run this verification script again"
