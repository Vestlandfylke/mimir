# Plugins

> **IMPORTANT:** This sample is for educational purposes only and is not recommended for production deployments.

Plugins are cool! They allow Chat Copilot to talk to the internet. Read more about plugins here [Understanding AI plugins in Semantic Kernel](https://learn.microsoft.com/en-us/semantic-kernel/ai-orchestration/plugins/?tabs=Csharp) and here [ChatGPT Plugins](https://platform.openai.com/docs/plugins/introduction).

## Available Plugins

> These plugins in this project can be optionally deployed with the Chat Copilot [WebApi](../webapi/README.md)

- [WebSearcher](./web-searcher/README.md): A plugin that allows the chat bot to perform Bing search.
- More to come. Stay tuned!

## Model Context Protocol (MCP) Servers

Chat Copilot now supports **Model Context Protocol (MCP)** servers! MCP is an open protocol that standardizes how applications provide context to LLMs, promoting interoperability and enhanced contextual understanding.

### What is MCP?

Model Context Protocol enables AI models to seamlessly interface with various data sources and tools through a standardized protocol. MCP tools are specifically designed for LLM use, making them highly optimized for AI reasoning and function calling.

Learn more:
- [Official MCP Documentation](https://modelcontextprotocol.io/docs)
- [MCP Integration Guide for Semantic Kernel](https://devblogs.microsoft.com/semantic-kernel/integrating-model-context-protocol-tools-with-semantic-kernel-a-step-by-step-guide/)

### Benefits of MCP Integration

- **Standardized Interface**: Consistent way to connect to various tools and data sources
- **Optimized for LLMs**: Tools are designed specifically for AI reasoning
- **Interoperability**: Works across different AI platforms and frameworks
- **Easy Deployment**: Supports both HTTP and Stdio transports
- **Always Available**: MCP plugins are automatically loaded for all users

### Configuring MCP Servers

MCP servers are configured in `appsettings.json` under the `McpServers` section:

```json
"McpServers": {
  "Servers": [
    {
      "Name": "CustomMcpServer",
      "Transport": "Http",
      "Url": "https://your-mcp-server.azurecontainerapps.io",
      "Enabled": true,
      "TimeoutSeconds": 60,
      "Description": "Description of what this server provides"
    }
  ]
}
```

#### Configuration Options

- **Name**: Unique identifier for the MCP server (will be used as the plugin name in Semantic Kernel)
- **Transport**: Connection type - `"Http"` for HTTP/REST APIs or `"Stdio"` for process-based servers
- **Url**: Endpoint URL (required for HTTP transport)
- **Command**: Executable command (required for Stdio transport, e.g., `"npx"`)
- **Arguments**: Command-line arguments array (for Stdio transport, e.g., `["-y", "@modelcontextprotocol/server-github"]`)
- **EnvironmentVariables**: Dictionary of environment variables to pass to the MCP server (useful for API keys)
- **Enabled**: Whether this server should be loaded (default: `true`)
- **TimeoutSeconds**: Connection timeout in seconds (default: `30`)
- **Description**: Optional description of the server's capabilities

### Example Configurations

#### HTTP Transport (Deployed MCP Server)

```json
{
  "Name": "CustomTools",
  "Transport": "Http",
  "Url": "https://my-mcp-server.azurecontainerapps.io",
  "Enabled": true,
  "TimeoutSeconds": 60
}
```

#### Stdio Transport (Local Process)

```json
{
  "Name": "GitHub",
  "Transport": "Stdio",
  "Command": "npx",
  "Arguments": ["-y", "@modelcontextprotocol/server-github"],
  "EnvironmentVariables": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "your-token-here"
  },
  "Enabled": true
}
```

#### Stdio Transport (Custom Script)

```json
{
  "Name": "FileSystem",
  "Transport": "Stdio",
  "Command": "python",
  "Arguments": ["mcp_server.py", "--data-dir", "/data"],
  "Enabled": true
}
```

### Available MCP Servers

There are many pre-built MCP servers available:

- **GitHub MCP Server**: Repository operations, issue management, code search
- **Filesystem MCP Server**: File operations and directory browsing
- **Database MCP Servers**: PostgreSQL, MySQL, SQLite connectors
- **API Integration Servers**: Custom API wrappers and integrations

Find more at the [MCP Servers Registry](https://github.com/modelcontextprotocol/servers)

### Deployment Considerations

When deploying to production:

1. **Security**: Use Azure Key Vault or user secrets for sensitive configuration like API keys
2. **Node.js Requirement**: Stdio transport with `npx` requires Node.js installed on the server
3. **Process Management**: Each Stdio MCP server runs as a separate process
4. **HTTP Transport**: Recommended for production deployments as it's more scalable
5. **Error Handling**: MCP servers that fail to connect will log warnings but won't prevent app startup

### Adding Secrets via User Secrets

For local development, use dotnet user-secrets to store sensitive MCP configuration:

```bash
dotnet user-secrets set "McpServers:Servers:0:EnvironmentVariables:GITHUB_PERSONAL_ACCESS_TOKEN" "your-github-token"
dotnet user-secrets set "McpServers:Servers:1:Url" "https://your-private-mcp-server.com"
```

### Azure Deployment

For Azure deployments, add MCP configuration to Application Settings:

1. Navigate to your Web App resource in Azure Portal
2. Go to **Configuration** → **Application settings**
3. Add settings with the following pattern:

```
McpServers:Servers:0:Name = CustomMcpServer
McpServers:Servers:0:Transport = Http
McpServers:Servers:0:Url = https://your-mcp-server.azurecontainerapps.io
McpServers:Servers:0:Enabled = true
McpServers:Servers:0:TimeoutSeconds = 60
```

## Third Party plugins

You can also configure Chat Copilot to use third party plugins.

> All no-auth plugins will be supported.

> All service-level-auth and user-level-auth plugins will be supported.

> OAuth plugins will NOT be supported.

Read more about plugin authentication here: [Plugin authentication](https://platform.openai.com/docs/plugins/authentication)

## Plugin Configuration in Chat Copilot

### Prerequisites

1. The name of your plugin. This should be identical to the `NameForHuman` in your plugin manifest.
   > Please refer to OpenAI for the [manifest requirements](https://platform.openai.com/docs/plugins/getting-started/plugin-manifest).
2. Url of your plugin.
   > This should be the root url to your API. Not the manifest url nor the OpenAPI spec url.
3. (Optional) Key of the plugin if it requires one.

### Local dev

In `appsettings.json` or `appsettings.development.json` under `../webapi/`, add your plugin to the existing **Plugins** list with the required information.

### Deployment

1. Go to your webapi resource in Azure portal.
2. Go to **Configuration** -> **Application settings**.
3. Look for Plugins:[*index*]:\* in the names that has the largest index.
4. Add the following names and their corresponding values:

```
Plugins[*index+1*]:Name
Plugins[*index+1*]:Url
Plugins[*index+1*]:Key (only if the plugin requires it)
```
