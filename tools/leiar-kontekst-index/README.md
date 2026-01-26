# Leiar Kontekst - Azure AI Search Index Setup

This guide helps you set up the Azure AI Search index for the Leader assistant's strategic document retrieval.

## Prerequisites

1. An Azure subscription
2. An Azure AI Search service (Basic tier or higher for semantic search)
3. Azure CLI installed (`az` command)
4. PowerShell or Bash

## Quick Start

```powershell
# 1. Set your variables
$SEARCH_SERVICE_NAME = "your-search-service"
$RESOURCE_GROUP = "your-resource-group"
$INDEX_NAME = "leiar-dokumenter"

# 2. Get your admin key
az search admin-key show --service-name $SEARCH_SERVICE_NAME --resource-group $RESOURCE_GROUP

# 3. Run the setup script
.\create-index.ps1 -SearchServiceName $SEARCH_SERVICE_NAME -ApiKey "YOUR_ADMIN_KEY"
```

## Index Schema Design

### Recommended Fields

| Field | Type | Purpose |
|-------|------|---------|
| `id` | string | Unique document identifier |
| `title` | string | Document title (searchable) |
| `content` | string | Main document content (searchable) |
| `source` | string | Source URL or file path |
| `category` | string | Document category for filtering |
| `lastUpdated` | DateTimeOffset | When document was last updated |
| `contentVector` | Collection(Single) | Vector embedding for semantic search |

### Best Practices Applied

1. **Semantic Configuration** - Enables AI-powered semantic ranking
2. **Norwegian Language Analyzer** - Uses `nb.microsoft` for better Norwegian text handling
3. **Vector Search** - Hybrid search combining keywords + semantic vectors
4. **Faceting** - Category field is facetable for filtering
5. **Suggester** - Title field for autocomplete suggestions

## Document Categories

Recommended categories for leader documents:

- `strategi` - Strategic plans and goals
- `retningslinjer` - Guidelines and procedures  
- `policy` - Policies and regulations
- `hr` - HR-related documents
- `okonomi` - Budget and financial documents
- `organisasjon` - Organizational structure
- `kvalitet` - Quality management

## Chunking Strategy

For large documents, split into chunks of ~500-1000 tokens:

```python
# Recommended chunk settings
CHUNK_SIZE = 512  # tokens
CHUNK_OVERLAP = 50  # tokens overlap between chunks
```

Each chunk becomes a separate document in the index with:

- Same `title` as parent document
- `source` pointing to original
- `chunkId` field to identify position

## Embedding Model

For vector search, use Azure OpenAI embeddings:

- **Model**: `text-embedding-ada-002` or `text-embedding-3-small`
- **Dimensions**: 1536 (ada-002) or 1536 (3-small default)

## Testing the Index

After setup, test with:

```powershell
# Simple search
.\test-search.ps1 -Query "sjukefråvær retningslinjer"

# Semantic search
.\test-search.ps1 -Query "korleis handtere konfliktar på arbeidsplassen" -Semantic
```

## Updating Documents

Use the `upload-documents.ps1` script to add or update documents:

```powershell
.\upload-documents.ps1 -DocumentsPath ".\documents\" -SearchServiceName $SEARCH_SERVICE_NAME -ApiKey "YOUR_KEY"
```

## Integration with Mimir

After setting up the index, configure in `appsettings.json`:

```json
"LeiarKontekst": {
  "Enabled": true,
  "Endpoint": "https://your-search-service.search.windows.net",
  "IndexName": "leiar-dokumenter",
  "SemanticConfigurationName": "leiar-semantic-config",
  "MaxResults": 5,
  "ContentFieldName": "content",
  "TitleFieldName": "title", 
  "SourceFieldName": "source",
  "VectorFieldName": "contentVector"
}
```

And set the API key:

```powershell
dotnet user-secrets set "LeiarKontekst:ApiKey" "YOUR_QUERY_KEY"
```

**Note**: Use a **Query Key** (read-only) for the application, not the Admin Key.
