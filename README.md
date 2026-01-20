# Mimir - Chat Copilot Application

A conversational AI assistant built on Microsoft [Semantic Kernel](https://github.com/microsoft/semantic-kernel). This project is a fork of [microsoft/chat-copilot](https://github.com/microsoft/chat-copilot), extended by Vestland fylkeskommune (Norway) with additional features including MCP integration, multi-model selection, assistant templates, and file generation.

The application provides multi-model chat capabilities with document analysis, long-term memory, and extensibility through the Model Context Protocol (MCP).

> **Note:** Each chat interaction will call Azure OpenAI/OpenAI which will use tokens that you may be billed for.

## Components

The application consists of:

1. **[Frontend](./webapp/)** - React web application with Fluent UI
2. **[Backend](./webapi/)** - ASP.NET Core 8 REST API using Semantic Kernel
3. **[Memory Pipeline](./memorypipeline/)** - .NET worker service for async document processing
4. **[MCP Bridge](./mcp-bridge/)** - Python service for Model Context Protocol tool integration

## Quick Start (Docker)

The fastest way to get running. Requires only Docker Desktop and an Azure OpenAI API key.

```bash
# 1. Clone the repository
git clone https://github.com/Vestlandfylke/mimir.git
cd mimir

# 2. Copy environment template and add your Azure OpenAI credentials
cp .env.example .env
# Edit .env with your AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY

# 3. Start all services
docker compose -f docker-compose.dev.yml up --build

# 4. Open http://localhost:3000
```

For detailed Docker setup instructions, see **[GETTING_STARTED.md](GETTING_STARTED.md)**.

---

## Requirements

You will need the following to run the application:

### For Docker Development (Recommended)

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- AI Service (see below)

### For Native Development

- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 18+](https://nodejs.org/en/download)
- [Yarn](https://classic.yarnpkg.com/docs/install)
- [Python 3.11+](https://www.python.org/) (for MCP Bridge)
- [Git](https://www.git-scm.com/downloads)
- AI Service (see below)

### AI Service

| AI Service | Requirements |
|------------|-------------|
| Azure OpenAI | - [Access](https://aka.ms/oai/access)<br>- [Resource](https://learn.microsoft.com/azure/ai-services/openai/how-to/create-resource)<br>- Deployed models (`gpt-4o` and `text-embedding-ada-002`)<br>- [Endpoint and API key](https://learn.microsoft.com/azure/ai-services/openai/tutorials/embeddings?tabs=command-line#retrieve-key-and-endpoint) |
| OpenAI | - [Account](https://platform.openai.com)<br>- [API key](https://platform.openai.com/api-keys) |

---

## Native Development Instructions

If you prefer to run services without Docker, follow the instructions below.

### Windows

1. Open PowerShell as administrator (requires [PowerShell Core 6+](https://github.com/PowerShell/PowerShell))

2. Clone and navigate to the repository:

   ```powershell
   git clone https://github.com/Vestlandfylke/mimir.git
   cd mimir
   ```

3. (Optional) Install dependencies using the setup script:

   ```powershell
   cd scripts
   .\Install.ps1
   ```

   > This installs `dotnet-8.0-sdk`, `nodejs`, and `yarn` via Chocolatey.

4. Configure the application:

   ```powershell
   .\Configure.ps1 -AIService AzureOpenAI -APIKey {API_KEY} -Endpoint {AZURE_OPENAI_ENDPOINT}
   ```

   For OpenAI (non-Azure):

   ```powershell
   .\Configure.ps1 -AIService OpenAI -APIKey {API_KEY}
   ```

   If you deployed models with custom names:

   ```powershell
   .\Configure.ps1 -AIService AzureOpenAI -APIKey {API_KEY} -Endpoint {ENDPOINT} -CompletionModel {DEPLOYMENT_NAME} -EmbeddingModel {DEPLOYMENT_NAME}
   ```

5. Run the application:

   ```powershell
   .\Start.ps1
   ```

### Linux/macOS

1. Clone and navigate to the repository:

   ```bash
   git clone https://github.com/Vestlandfylke/mimir.git
   cd mimir/scripts
   ```

2. (Optional) Install dependencies:

   **Ubuntu/Debian:**

   ```bash
   ./install-apt.sh
   ```

   **macOS:**

   ```bash
   ./install-brew.sh
   ```

3. Configure the application:

   ```bash
   ./configure.sh --aiservice AzureOpenAI --apikey {API_KEY} --endpoint {AZURE_OPENAI_ENDPOINT}
   ```

   For OpenAI (non-Azure):

   ```bash
   ./configure.sh --aiservice OpenAI --apikey {API_KEY}
   ```

4. Run the application:

   ```bash
   ./start.sh
   ```

### Verify Setup

Run the verification script to check your environment:

```powershell
.\scripts\verify-setup.ps1   # Windows
./scripts/verify-setup.sh    # Linux/macOS
```

---

## Optional Configuration

### Memory Pipeline

By default, document processing is synchronous. For async processing of large documents, configure and run the memory pipeline service. See [memorypipeline/README.md](./memorypipeline/README.md).

### Authentication via Azure AD

By default, the application runs without authentication. To enable Azure AD authentication:

1. Create application registrations for frontend and backend in Azure AD
2. Configure the registrations with appropriate redirect URIs and API permissions
3. Run the Configure script with authentication parameters:

   ```powershell
   .\Configure.ps1 -AIService {AI_SERVICE} -APIKey {API_KEY} -Endpoint {ENDPOINT} `
     -FrontendClientId {FRONTEND_APP_ID} `
     -BackendClientId {BACKEND_APP_ID} `
     -TenantId {TENANT_ID}
   ```

For detailed Azure AD setup instructions, see the [original chat-copilot documentation](https://github.com/microsoft/chat-copilot#optional-enable-backend-authentication-via-azure-ad).

### MCP Tools Integration

The application supports extending capabilities through Model Context Protocol servers. See [webapi/MCP_INTEGRATION_GUIDE.md](./webapi/MCP_INTEGRATION_GUIDE.md) and [mcp-bridge/README.md](./mcp-bridge/README.md).

---

## Deployment

To deploy the application to Azure, see [scripts/deploy/README.md](./scripts/deploy/README.md).

### Azure Resources

| Resource | Purpose |
|----------|---------|
| App Service | Backend API and static frontend |
| Container App | MCP Bridge (optional) |
| Cosmos DB | Chat sessions, messages, metadata |
| Azure AI Search | Vector index for semantic search |
| Azure OpenAI | Language models and embeddings |
| Blob Storage | Document storage |
| Application Insights | Telemetry and logging |

---

## Documentation

| Document | Description |
|----------|-------------|
| [GETTING_STARTED.md](GETTING_STARTED.md) | Docker-based quick start guide |
| [FAQ_MIMIR.md](FAQ_MIMIR.md) | End-user guide and FAQ |
| [scripts/README.md](scripts/README.md) | Script documentation |
| [scripts/deploy/README.md](scripts/deploy/README.md) | Azure deployment guide |
| [webapi/README.md](webapi/README.md) | Backend API documentation |
| [webapi/MCP_INTEGRATION_GUIDE.md](webapi/MCP_INTEGRATION_GUIDE.md) | MCP server integration |
| [mcp-bridge/README.md](mcp-bridge/README.md) | MCP Bridge setup |
| [memorypipeline/README.md](memorypipeline/README.md) | Document processing pipeline |

---

## Troubleshooting

### Unable to load chats / "interaction_in_progress" error

This occurs when the browser is logged into a different Azure AD tenant than configured. Use a private/incognito browser tab or clear browser credentials.

### SSL certificate errors / CORS errors

1. Verify the backend is running: navigate to `https://localhost:40443/healthz`
2. Accept any certificate warnings in your browser
3. Refresh the frontend at `http://localhost:3000`

### Yarn version errors

Ensure you're using Yarn Classic (v1.x):

```bash
npm install -g yarn
yarn set version classic
```

### Docker: "Cannot connect to Docker daemon"

Ensure Docker Desktop is running before starting the containers.

### Azure OpenAI: 401 Unauthorized

Verify your API key and endpoint in the `.env` file or user secrets.

---

## Related Projects

| Repository | Description |
|------------|-------------|
| [Semantic Kernel](https://github.com/microsoft/semantic-kernel) | SDK for integrating LLM technology into applications |
| [Chat Copilot](https://github.com/microsoft/chat-copilot) | Original sample this project is based on |
| [Kernel Memory](https://github.com/microsoft/kernel-memory) | Service for document ingestion and semantic search |

---

## Contributing

This project was developed for Vestland fylkeskommune. Contributions are welcome via pull requests.

- Read the [CONTRIBUTING.md](CONTRIBUTING.md) guidelines
- Review the [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

---

## License

Copyright (c) Microsoft Corporation and contributors. All rights reserved.

Licensed under the [MIT](LICENSE) license.
