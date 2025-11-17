# Model Context Protocol (MCP) Integration Guide

This guide explains how the MCP integration works in Chat Copilot and how to use it effectively.

## Overview

Chat Copilot now supports Model Context Protocol (MCP) servers, allowing you to extend the bot's capabilities with standardized tools and data sources. Your MCP server at `https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io` is already configured and will be automatically loaded when the application starts.

## How It Works

### Architecture

```
┌─────────────────────┐
│   Chat Copilot      │
│   (Semantic Kernel) │
└──────────┬──────────┘
           │
           ├─ Built-in Plugins (ChatPlugin, TimePlugin)
           │
           └─ MCP Plugins (via McpClientManager)
                   │
                   ├─ CustomMcpServer (HTTP)
                   │   └─> https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io
                   │
                   └─ [Additional MCP Servers...]
```

### Startup Flow

1. **Application Startup**: `Program.cs` registers MCP services via `.AddMcpServers()`
2. **Client Manager Initialization**: `McpClientManager` is created as a singleton
3. **Kernel Creation**: When a Kernel is created for a chat request:
   - `RegisterChatCopilotFunctionsAsync` is called
   - MCP plugins are registered via `RegisterMcpPluginsAsync`
4. **MCP Connection**: 
   - Manager connects to configured MCP servers
   - Retrieves list of tools from each server
   - Converts tools to Semantic Kernel functions
   - Adds them as plugins to the Kernel

### Plugin Registration

MCP tools are automatically converted to Semantic Kernel functions using the `.AsKernelFunction()` extension method, which:
- Maps MCP tool schema to Semantic Kernel function metadata
- Creates proper parameter descriptions for LLM understanding
- Enables automatic function calling during chat interactions

## Configuration

### Current Configuration

Your MCP server is configured in `appsettings.json`:

```json
"McpServers": {
  "Servers": [
    {
      "Name": "CustomMcpServer",
      "Transport": "Http",
      "Url": "https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io",
      "Enabled": true,
      "TimeoutSeconds": 60,
      "Description": "Custom MCP server providing additional tools and capabilities for Chat Copilot"
    }
  ]
}
```

### Adding More MCP Servers

To add additional MCP servers, simply add more entries to the `Servers` array:

```json
"McpServers": {
  "Servers": [
    {
      "Name": "CustomMcpServer",
      "Transport": "Http",
      "Url": "https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io",
      "Enabled": true,
      "TimeoutSeconds": 60
    },
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
  ]
}
```

## Usage

### For Users

MCP tools are automatically available to all users - no special configuration or activation required. Users can interact with MCP tools naturally through conversation:

**Example interactions:**
```
User: "Use the tools from CustomMcpServer to [perform task]"
Bot: [Executes appropriate MCP tool and responds]

User: "What tools are available?"
Bot: [Lists available functions including MCP tools]
```

### For Developers

#### Checking Available Tools

To see what tools your MCP server provides, check the application logs during startup:

```
[Information] Connecting to MCP server: CustomMcpServer (Transport: Http)
[Information] MCP server 'CustomMcpServer' provided 5 tools
[Information] Successfully registered MCP plugin 'CustomMcpServer' with 5 functions
```

#### Debugging MCP Integration

Enable detailed logging in `appsettings.json`:

```json
"Logging": {
  "LogLevel": {
    "Default": "Warning",
    "CopilotChat.WebApi": "Information",
    "CopilotChat.WebApi.Extensions.McpExtensions": "Debug"
  }
}
```

#### Testing the Integration

1. **Start the application**:
   ```bash
   cd webapi
   dotnet run
   ```

2. **Check startup logs** for MCP initialization:
   ```
   [Information] Initializing 1 MCP server connections
   [Information] Successfully connected to MCP server: CustomMcpServer
   [Information] MCP initialization complete. 1 servers connected successfully
   ```

3. **Test in Chat**: Start a conversation and try using the tools from your MCP server

#### Troubleshooting

**Problem**: MCP server not connecting

**Solutions**:
- Check that the URL is accessible: `curl https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io`
- Verify the MCP server is running and healthy
- Check firewall rules if deployed in Azure
- Review application logs for connection errors

**Problem**: Tools not appearing in function calls

**Solutions**:
- Verify the MCP server returns tools in the correct format
- Check that `Enabled` is set to `true` in configuration
- Ensure the Semantic Kernel is properly configured for function calling
- Review logs for tool conversion errors

**Problem**: Timeout errors

**Solutions**:
- Increase `TimeoutSeconds` in configuration
- Check MCP server performance
- Verify network latency between Chat Copilot and MCP server

## Code Structure

### Key Files

- **`webapi/Options/McpServerOptions.cs`**: Configuration model for MCP servers
- **`webapi/Extensions/McpExtensions.cs`**: MCP service registration and client management
- **`webapi/Extensions/SemanticKernelExtensions.cs`**: Integration with Semantic Kernel
- **`webapi/Program.cs`**: Service registration in application startup
- **`webapi/appsettings.json`**: MCP server configuration

### Extension Points

If you need to customize MCP integration:

1. **Custom Tool Filtering**: Modify `RegisterMcpPluginsAsync` in `McpExtensions.cs`
2. **Connection Retry Logic**: Enhance `McpClientManager.InitializeAsync`
3. **Dynamic Server Discovery**: Add logic to discover MCP servers at runtime
4. **Tool Authorization**: Add authorization checks before tool execution

## Best Practices

### Security

1. **Secrets Management**: Use Azure Key Vault or user secrets for sensitive data:
   ```bash
   dotnet user-secrets set "McpServers:Servers:0:EnvironmentVariables:API_KEY" "secret-key"
   ```

2. **Network Security**: Deploy MCP servers in the same VNet as Chat Copilot for private communication

3. **Input Validation**: MCP servers should validate all inputs to prevent injection attacks

### Performance

1. **HTTP Transport**: Preferred for production (more scalable than Stdio)
2. **Connection Pooling**: The `McpClientManager` maintains persistent connections
3. **Timeout Configuration**: Set appropriate timeouts based on tool complexity

### Monitoring

1. **Application Insights**: MCP operations are logged and can be tracked in Azure Monitor
2. **Health Checks**: Monitor MCP server availability
3. **Tool Usage Metrics**: Track which tools are being called and their success rates

## Deployment

### Azure App Service

MCP configuration is already in `appsettings.json`. For production, override with Application Settings:

```
McpServers__Servers__0__Name = CustomMcpServer
McpServers__Servers__0__Transport = Http
McpServers__Servers__0__Url = https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io
McpServers__Servers__0__Enabled = true
McpServers__Servers__0__TimeoutSeconds = 60
```

Note: Use `__` (double underscore) for nested configuration in Azure App Service settings.

### Container Deployment

When deploying as a container, ensure:
- Network connectivity between containers
- Environment variables are properly passed
- For Stdio transport: required executables (node, python, etc.) are in the container

## Support and Resources

- [MCP Official Documentation](https://modelcontextprotocol.io/docs)
- [Semantic Kernel MCP Integration Guide](https://devblogs.microsoft.com/semantic-kernel/integrating-model-context-protocol-tools-with-semantic-kernel-a-step-by-step-guide/)
- [MCP Servers Registry](https://github.com/modelcontextprotocol/servers)

## Version History

- **v1.0** (Current): Initial MCP integration with HTTP and Stdio transport support
  - Support for multiple MCP servers
  - Automatic tool discovery and registration
  - Configuration via appsettings.json
  - Your deployed MCP server pre-configured

