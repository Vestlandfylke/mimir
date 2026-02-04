# Mimir - Chat Copilot Application

A conversational AI assistant built on Microsoft [Semantic Kernel](https://github.com/microsoft/semantic-kernel). This project is a fork of [microsoft/chat-copilot](https://github.com/microsoft/chat-copilot), extended by Vestland fylkeskommune (Norway) with additional features including MCP integration, multi-model selection, assistant templates, and file generation.

The application provides multi-model chat capabilities with document analysis, long-term memory, and extensibility through the Model Context Protocol (MCP).

**Key Features:**
- Multi-model selection (GPT-4o, GPT-4, o1, o3-mini, etc.)
- Assistant templates with role-based access control
- SharePoint document search with On-Behalf-Of authentication
- Norwegian law lookup via Lovdata integration
- File generation (Word, Excel, PowerPoint, PDF)
- Chat archive system with 180-day retention (soft delete with restore)
- Microsoft Teams SSO support
- Mermaid diagram rendering
- LaTeX/KaTeX math formulas

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

### Built-in Plugins

The application includes several native plugins that extend AI capabilities:

| Plugin | Purpose | Configuration |
|--------|---------|---------------|
| **SharePointObo** | Search and access SharePoint documents using On-Behalf-Of authentication. Users can only access content they have SharePoint permissions for. | `SharePointObo` section in appsettings.json |
| **Lovdata** | Look up Norwegian laws and regulations directly from Lovdata's API. | `Lovdata` section (requires API key) |
| **LeiarKontekst** | Access strategic documents for leaders via Azure AI Search. | `LeiarKontekst` section |
| **FileGeneration** | Generate downloadable files (Word, Excel, PowerPoint, PDF, text). | `Cosmos:GeneratedFilesContainer` |

#### SharePoint OBO Configuration

```json
"SharePointObo": {
  "Enabled": true,
  "Authority": "https://login.microsoftonline.com",
  "TenantId": "YOUR_TENANT_ID",
  "ClientId": "YOUR_CLIENT_ID",
  "ClientSecret": "YOUR_SECRET",
  "SiteUrl": "https://yourtenant.sharepoint.com/sites/YourSite",
  "AllowedSites": [
    "https://yourtenant.sharepoint.com/sites/Site1",
    "https://yourtenant.sharepoint.com/sites/Site2"
  ],
  "DefaultScopes": "https://graph.microsoft.com/Sites.Read.All https://graph.microsoft.com/Files.Read.All"
}
```

### Assistant Templates (Personas)

Create specialized AI assistants with custom system prompts and access control:

```json
"Prompts": {
  "Templates": {
    "my-assistant": {
      "DisplayName": "My Assistant",
      "Description": "Description shown in the UI",
      "Icon": "icon-name",
      "Enabled": true,
      "AllowedGroups": ["group-id-1", "group-id-2"],
      "AllowedUsers": ["user-id-1", "user-id-2"],
      "SystemDescription": "Custom system prompt...",
      "InitialBotMessage": "Welcome message shown when starting a new chat"
    }
  }
}
```

**Access Control:**
- `AllowedGroups`: Azure AD group IDs that can access the assistant
- `AllowedUsers`: Azure AD user IDs that can access the assistant
- If both are empty, the assistant is available to all users

**Azure Web App Environment Variables:**
```
Prompts_Templates__my-assistant__Enabled=true
Prompts_Templates__my-assistant__AllowedUsers__0=user-id-1
Prompts_Templates__my-assistant__AllowedUsers__1=user-id-2
```

### Chat Archive System (Papirkorg)

The application includes a soft-delete system for chat conversations. When users delete a chat, it is moved to an archive ("Papirkorg") instead of being permanently removed. This provides:

- **180-day retention period** - Archived chats are kept for 180 days before automatic permanent deletion
- **User self-service restore** - Users can restore their own deleted chats from the trash
- **Permanent delete option** - Users can permanently delete archived chats before the retention period expires
- **Compliance support** - Enables data recovery and audit capabilities

**Accessing the Trash:**
1. Open the user menu (top right)
2. Click "Administrer samtalar" (Manage conversations)
3. Switch to the "Papirkorg" tab to view and restore deleted chats

**Configuration:**
```json
"ChatArchive": {
  "RetentionDays": 180,
  "CleanupIntervalHours": 24
}
```

**Required CosmosDB Containers:**
The archive system requires these additional containers:
- `archivedchatsessions` (partition key: `/deletedBy`)
- `archivedchatmessages` (partition key: `/originalChatId`)
- `archivedchatparticipants` (partition key: `/originalChatId`)
- `archivedmemorysources` (partition key: `/chatId`)

These are automatically created when deploying with the Bicep templates. For manual deployments, create them in your CosmosDB database.

### Microsoft Teams Integration

The application supports Microsoft Teams SSO authentication:

1. Register your app in Azure AD with Teams SSO configuration
2. Set the Application ID URI (e.g., `api://your-app-id`)
3. Configure the backend:

```json
"Authentication": {
  "AzureAd": {
    "Audience": "api://your-app-id"
  }
}
```

For detailed Teams deployment, see the [Teams documentation](https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/authentication/tab-sso-overview).

---

## Deployment

To deploy the application to Azure, see [scripts/deploy/README.md](./scripts/deploy/README.md).

### Azure Resources

| Resource | Purpose |
|----------|---------|
| App Service | Backend API and static frontend |
| Container App | MCP Bridge (optional) |
| Cosmos DB | Chat sessions, messages, metadata, and archived chats |
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

### SharePoint plugin: BadRequest error

Ensure that:
1. `AllowedSites` is configured with valid SharePoint site URLs
2. The app registration has the required Graph API permissions (`Sites.Read.All`, `Files.Read.All`)
3. The `DefaultScopes` matches the permissions granted to the app

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
