# Quick Start Guide: MCP Integration

## ✅ Integration Complete!

Your Chat Copilot application now has full MCP (Model Context Protocol) support integrated using **Semantic Kernel 1.45.0** with built-in MCP support. Your deployed MCP server at `https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io` is pre-configured and ready to use.

## 🚀 Getting Started

### Step 1: Restore NuGet Packages

```bash
cd webapi
dotnet restore
```

This will download the new `ModelContextProtocol` package (v0.6.0) that was added.

### Step 2: Run the Application

```bash
dotnet run
```

or from the project root:

```bash
cd webapi
dotnet run
```

### Step 3: Watch the Logs

During startup, you should see:

```
[Information] Initializing 1 MCP server connections
[Information] Connecting to MCP server: CustomMcpServer (Transport: Http)
[Information] Successfully connected to MCP server: CustomMcpServer
[Information] MCP server 'CustomMcpServer' provided X tools
[Information] Successfully registered MCP plugin 'CustomMcpServer' with X functions
[Information] MCP initialization complete. 1 servers connected successfully
```

✅ If you see these messages, the integration is working!

### Step 4: Test in Chat

1. Open your Chat Copilot web interface
2. Start a new conversation
3. The MCP tools are now automatically available to the AI
4. Ask questions or give commands that might use your MCP tools

**Example prompts** (adjust based on what your MCP server provides):
```
"What tools do you have access to?"
"Use the CustomMcpServer tools to [perform specific task]"
```

## 🔧 Configuration

Your MCP server is configured in `webapi/appsettings.json`:

```json
"McpServers": {
  "Servers": [
    {
      "Name": "CustomMcpServer",
      "Transport": "Http",
      "Url": "https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io",
      "Enabled": true,
      "TimeoutSeconds": 60
    }
  ]
}
```

### To Add More MCP Servers

Simply add more entries to the `Servers` array:

```json
"McpServers": {
  "Servers": [
    {
      "Name": "CustomMcpServer",
      "Transport": "Http",
      "Url": "https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io",
      "Enabled": true
    },
    {
      "Name": "GitHub",
      "Transport": "Stdio",
      "Command": "npx",
      "Arguments": ["-y", "@modelcontextprotocol/server-github"],
      "EnvironmentVariables": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-token"
      },
      "Enabled": true
    }
  ]
}
```

### To Disable an MCP Server

Set `Enabled` to `false`:

```json
{
  "Name": "CustomMcpServer",
  "Enabled": false,
  ...
}
```

## 📖 Documentation

Three documentation files have been created for you:

1. **`MCP_INTEGRATION_SUMMARY.md`** - Complete overview of what was implemented
2. **`webapi/MCP_INTEGRATION_GUIDE.md`** - Detailed technical guide for developers
3. **`plugins/README.md`** - Updated with MCP configuration examples

## ✨ Features

- ✅ **Automatic Loading**: MCP plugins load automatically on startup
- ✅ **Available to All Users**: All users can use MCP tools immediately
- ✅ **Multiple Servers**: Support for unlimited MCP servers
- ✅ **HTTP & Stdio**: Support for both deployed and local MCP servers
- ✅ **Error Handling**: Failed servers don't crash the app
- ✅ **Configurable**: All settings in `appsettings.json`

## 🐛 Troubleshooting

### Problem: Build Errors

**Solution**: Make sure to restore packages first:
```bash
dotnet restore
```

### Problem: MCP Server Connection Failed

**Check**:
1. Server is running: `curl https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io`
2. Firewall allows outbound HTTPS connections
3. Check application logs for detailed error messages

### Problem: Tools Not Appearing

**Check**:
1. Look for "Successfully registered MCP plugin" in logs
2. Verify `Enabled: true` in configuration
3. Ensure Semantic Kernel has function calling enabled

### Enable Debug Logging

In `appsettings.json`, update logging:

```json
"Logging": {
  "LogLevel": {
    "Default": "Information",
    "CopilotChat.WebApi.Extensions": "Debug"
  }
}
```

## 🌐 Azure Deployment

When deploying to Azure App Service, add these Application Settings:

```
McpServers__Servers__0__Name = CustomMcpServer
McpServers__Servers__0__Transport = Http
McpServers__Servers__0__Url = https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io
McpServers__Servers__0__Enabled = true
McpServers__Servers__0__TimeoutSeconds = 60
```

Note: Use `__` (double underscore) for nested configuration in Azure.

## 📝 What Changed

### New Files
- `webapi/Options/McpServerOptions.cs` - Configuration models
- `webapi/Extensions/McpExtensions.cs` - MCP service implementation
- `webapi/MCP_INTEGRATION_GUIDE.md` - Technical guide
- `MCP_INTEGRATION_SUMMARY.md` - Implementation summary
- `QUICKSTART_MCP.md` - This file

### Modified Files
- `webapi/CopilotChatWebApi.csproj` - Added ModelContextProtocol package
- `webapi/Program.cs` - Added MCP service registration
- `webapi/appsettings.json` - Added MCP configuration
- `webapi/Extensions/ServiceExtensions.cs` - Added MCP options
- `webapi/Extensions/SemanticKernelExtensions.cs` - Added MCP plugin registration
- `plugins/README.md` - Added MCP documentation

## 🎯 Next Steps

1. **Test the integration** - Run the app and verify MCP connection
2. **Try the tools** - Use your MCP tools in a chat conversation
3. **Add more servers** - Configure additional MCP servers if needed
4. **Deploy to production** - Use Azure App Settings for production config

## 💡 Tips

- MCP tools are **always active** for all users - no need to enable per user
- You can add/remove MCP servers by editing config and restarting
- Check logs during startup to verify successful connection
- Each MCP server becomes a plugin in Semantic Kernel

## 🔗 Resources

- [MCP Official Docs](https://modelcontextprotocol.io/docs)
- [Semantic Kernel MCP Guide](https://devblogs.microsoft.com/semantic-kernel/integrating-model-context-protocol-tools-with-semantic-kernel-a-step-by-step-guide/)
- [MCP Servers Registry](https://github.com/modelcontextprotocol/servers)

---

**Ready to go!** 🚀 Just run `dotnet restore` and `dotnet run` in the `webapi` directory.

