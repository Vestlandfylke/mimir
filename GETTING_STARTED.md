# Getting Started with Mimir

Get Mimir running locally in under 10 minutes.

## Prerequisites

You need:
- **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop/)
- **Azure OpenAI API key** - From your Azure OpenAI resource

That's it! No need to install .NET, Node.js, or Python.

## Quick Start

### Step 1: Clone and Configure

```bash
# Clone the repository
git clone https://github.com/Vestlandfylke/mimir.git
cd mimir

# Copy the environment template
cp .env.example .env
```

### Step 2: Add Your Azure OpenAI Credentials

Edit `.env` and fill in your Azure OpenAI details:

```env
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002
```

> **Where to find these values:**
> 1. Go to [Azure Portal](https://portal.azure.com)
> 2. Navigate to your Azure OpenAI resource
> 3. Under "Keys and Endpoint", copy the endpoint and key
> 4. Under "Model deployments", note your deployment names

### Step 3: Start Mimir

```bash
docker compose -f docker-compose.dev.yml up --build
```

First run takes 3-5 minutes to build. Subsequent starts are fast.

### Step 4: Open the App

Open your browser to **http://localhost:3000**

You're done! Start chatting with Mimir.

---

## Stopping Mimir

Press `Ctrl+C` in the terminal, or run:

```bash
docker compose -f docker-compose.dev.yml down
```

## Optional: Enable MCP Tools (Klarsprak)

To enable the MCP-based Klarsprak tools:

1. Edit `.env`:
   ```env
   MCP_ENABLED=true
   FASTMCP_SERVER_URL=https://your-mcp-server.azurecontainerapps.io
   ```

2. Start with the MCP profile:
   ```bash
   docker compose -f docker-compose.dev.yml --profile mcp up --build
   ```

## Optional: Enable Authentication

To enable Azure AD authentication:

1. Edit `.env`:
   ```env
   AUTH_TYPE=AzureAd
   AZURE_AD_TENANT_ID=your-tenant-id
   AZURE_AD_CLIENT_ID=your-client-id
   AZURE_AD_FRONTEND_CLIENT_ID=your-frontend-client-id
   ```

2. Restart the containers.

---

## Troubleshooting

### "Cannot connect to Docker daemon"

Make sure Docker Desktop is running.

### "Port 3000 already in use"

Stop other services using port 3000, or change the port in `docker-compose.dev.yml`.

### "Azure OpenAI error: 401 Unauthorized"

Check that your API key is correct in `.env`.

### "Build failed"

Try rebuilding from scratch:
```bash
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml build --no-cache
docker compose -f docker-compose.dev.yml up
```

### Viewing Logs

```bash
# All services
docker compose -f docker-compose.dev.yml logs -f

# Just backend
docker compose -f docker-compose.dev.yml logs -f backend

# Just frontend
docker compose -f docker-compose.dev.yml logs -f frontend
```

---

## What's Running?

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | React web interface |
| Backend | http://localhost:8080 | ASP.NET Core API |
| MCP Bridge | http://localhost:8002 | MCP tools (optional) |

---

## Next Steps

- **User Guide**: See [FAQ_MIMIR.md](FAQ_MIMIR.md) for how to use Mimir
- **MCP Tools**: See [webapi/MCP_INTEGRATION_GUIDE.md](webapi/MCP_INTEGRATION_GUIDE.md) for MCP integration
- **Production Deployment**: See [scripts/deploy/README.md](scripts/deploy/README.md) for Azure deployment

---

## Native Development (Without Docker)

If you prefer running services natively (for debugging, etc.):

### Requirements
- .NET 8.0 SDK
- Node.js 18+ with Yarn
- Python 3.11+ (for MCP Bridge)

### Start Services

```powershell
# Start everything
.\scripts\Start.ps1

# Or start individually:
.\scripts\Start-Backend.ps1
.\scripts\Start-Frontend.ps1
.\scripts\Start-Bridge.ps1
```

See [scripts/README.md](scripts/README.md) for details.
