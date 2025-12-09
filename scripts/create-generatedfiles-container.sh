#!/bin/bash
# Create GeneratedFiles Container in Cosmos DB
# Usage: ./create-generatedfiles-container.sh

# Configuration
RESOURCE_GROUP=${1:-"RG-SK-Copilot-NPI"}
COSMOS_ACCOUNT=${2:-"cosmos-copichat-4kt5uxo2hrzri"}
DATABASE_NAME=${3:-"CopilotChat"}
CONTAINER_NAME=${4:-"generatedfiles"}
THROUGHPUT=${5:-400}

echo "🚀 Creating GeneratedFiles Container in Cosmos DB..."
echo ""
echo "Configuration:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Cosmos Account: $COSMOS_ACCOUNT"
echo "  Database: $DATABASE_NAME"
echo "  Container: $CONTAINER_NAME"
echo "  Throughput: $THROUGHPUT RU/s"
echo ""

# Check if container already exists
echo "🔍 Checking if container already exists..."
if az cosmosdb sql container show \
    --resource-group "$RESOURCE_GROUP" \
    --account-name "$COSMOS_ACCOUNT" \
    --database-name "$DATABASE_NAME" \
    --name "$CONTAINER_NAME" \
    2>/dev/null; then
    
    echo "⚠️  Container '$CONTAINER_NAME' already exists!"
    echo ""
    read -p "Do you want to delete and recreate it? (yes/no): " response
    
    if [ "$response" = "yes" ]; then
        echo "🗑️  Deleting existing container..."
        az cosmosdb sql container delete \
            --resource-group "$RESOURCE_GROUP" \
            --account-name "$COSMOS_ACCOUNT" \
            --database-name "$DATABASE_NAME" \
            --name "$CONTAINER_NAME" \
            --yes
        
        echo "✅ Container deleted"
        sleep 2
    else
        echo "❌ Operation cancelled"
        exit 0
    fi
fi

# Create the container
echo "📦 Creating container '$CONTAINER_NAME'..."

if az cosmosdb sql container create \
    --resource-group "$RESOURCE_GROUP" \
    --account-name "$COSMOS_ACCOUNT" \
    --database-name "$DATABASE_NAME" \
    --name "$CONTAINER_NAME" \
    --partition-key-path "/chatId" \
    --throughput "$THROUGHPUT"; then
    
    echo ""
    echo "✅ Container created successfully!"
    echo ""
    echo "🎉 Setup Complete!"
    echo ""
    echo "Next steps:"
    echo "  1. ✅ Container 'generatedfiles' is ready"
    echo "  2. 📝 Update App Service Configuration:"
    echo "       Cosmos__GeneratedFilesContainer = generatedfiles"
    echo "  3. 🚀 Deploy webapi to Azure"
    echo "  4. 🧪 Test file download functionality"
    
else
    echo "❌ Failed to create container!"
    exit 1
fi

echo ""
echo "💰 Cost Estimate:"
echo "  $THROUGHPUT RU/s = ~\$$(echo "scale=2; $THROUGHPUT * 0.008 * 730" | bc)/month"
echo "  (Estimate based on standard pricing)"
echo ""

