# MCP Bridge Server

This bridge translates between:
- **FastMCP Streamable HTTP** (your server at Azure Container Apps)
- **Standard MCP JSON-RPC over HTTP** (what Microsoft Semantic Kernel expects)

## Quick Start

### 1. Install Dependencies

```bash
cd mcp-bridge
pip install -r requirements.txt
```

### 2. Run the Bridge

```bash
python bridge.py
```

The bridge will start on `http://localhost:8000` by default.

### 3. Configure Chat Copilot

Update `webapi/appsettings.json`:

```json
"McpServers": {
  "Servers": [
    {
      "Name": "CustomMcpServer",
      "Transport": "Http",
      "Url": "http://localhost:8000/mcp",
      "Enabled": true,
      "TimeoutSeconds": 60,
      "Description": "FastMCP server via bridge"
    }
  ]
}
```

### 4. Test It

```bash
# Check bridge health
curl http://localhost:8000/health

# Check Chat Copilot logs for:
# [Information] Successfully connected to MCP server: CustomMcpServer
# [Information] MCP server 'CustomMcpServer' provided X tools
```

## Configuration

Environment variables:

- `FASTMCP_SERVER_URL` - Your FastMCP server URL (default: your Azure server)
- `BRIDGE_HOST` - Bridge host (default: `0.0.0.0`)
- `BRIDGE_PORT` - Bridge port (default: `8000`)

Example:

```bash
export FASTMCP_SERVER_URL="https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io"
python bridge.py
```

## Endpoints

- `GET /` - Bridge information
- `POST /mcp` - MCP JSON-RPC endpoint (for Microsoft client)
- `GET /health` - Health check

## How It Works

```
┌─────────────────────┐
│  Chat Copilot       │
│  (C# MCP Client)    │
└──────────┬──────────┘
           │ Standard MCP JSON-RPC
           │ http://localhost:8000/mcp
           ↓
┌─────────────────────┐
│  MCP Bridge (this)  │
│  Python/Starlette   │
└──────────┬──────────┘
           │ FastMCP Streamable HTTP
           │ https://your-server.azurecontainerapps.io
           ↓
┌─────────────────────┐
│  Your FastMCP       │
│  Server (Azure)     │
└─────────────────────┘
```

The bridge:
1. Receives standard MCP JSON-RPC requests from Chat Copilot
2. Translates them to FastMCP Python client calls
3. Forwards to your FastMCP server using Streamable HTTP
4. Translates responses back to standard MCP format
5. Returns to Chat Copilot

## Deployment

### Option 1: Run Locally (Development)

```bash
python bridge.py
```

### Option 2: Deploy to Azure App Service (Recommended for Production)

Use the included deployment script:

```powershell
cd mcp-bridge
.\deploy-bridge.ps1
```

This will:
1. Create an App Service `app-mcp-bridge-mimir`
2. Configure environment variables
3. Deploy the bridge code
4. Output the URL to use

**After deployment**, update WebAPI to use the bridge URL:

```json
// webapi/appsettings.json
"McpServers": {
  "Servers": [
    {
      "Name": "CustomMcpServer",
      "Transport": "Http",
      "Url": "https://app-mcp-bridge-mimir.azurewebsites.net/mcp",
      "Enabled": true
    }
  ]
}
```

### Option 3: Deploy to Azure Container Apps

Create `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bridge.py .

ENV BRIDGE_HOST=0.0.0.0
ENV BRIDGE_PORT=8080

EXPOSE 8080

CMD ["gunicorn", "-w", "2", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8080", "bridge:app"]
```

Deploy:

```bash
# Build and push
docker build -t mcp-bridge .
docker tag mcp-bridge:latest <your-registry>/mcp-bridge:latest
docker push <your-registry>/mcp-bridge:latest

# Deploy to Azure Container Apps
az containerapp create \
  --name mcp-bridge \
  --resource-group <your-rg> \
  --environment <your-env> \
  --image <your-registry>/mcp-bridge:latest \
  --target-port 8080 \
  --ingress external \
  --env-vars FASTMCP_SERVER_URL=https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io
```

Then update Chat Copilot to use the bridge URL.

## Troubleshooting

**Bridge won't connect to FastMCP server:**
```bash
# Test your FastMCP server
curl https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io

# Check bridge logs
python bridge.py  # Look for connection errors
```

**Chat Copilot can't connect to bridge:**
```bash
# Make sure bridge is running
curl http://localhost:8000/health

# Check Chat Copilot logs for connection errors
```

**Tools not showing up:**
```bash
# Check what the bridge sees
curl http://localhost:8000/health
```

## Future: When Microsoft Adds Native Support

Once Microsoft adds native FastMCP Streamable HTTP support to Semantic Kernel, you can:
1. Remove this bridge
2. Point Chat Copilot directly to your FastMCP server
3. Enjoy the performance benefits of direct connection!

Until then, this bridge works perfectly! 🌉

