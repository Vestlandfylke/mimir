# 🚀 Chat Copilot with MCP Tools - Quick Start

Your Chat Copilot now has **25 additional tools** from your Azure FastMCP server! Here's how to use it.

## One-Line Start

```powershell
.\scripts\Start.ps1
```

That's it! This starts:
- ✅ MCP Bridge (connects to your FastMCP server)
- ✅ Backend (Chat Copilot API)
- ✅ Frontend (Web interface)

## What You Get

### 25 New Tools Available in Chat

Your chat assistant can now:

**📊 Math Operations**
```
"Add 15 and 27"
"Multiply 3.14 by 2"
"Calculate the average of 10, 20, 30, 40"
```

**✍️ String Operations**
```
"Reverse the string 'Hello World'"
"Count words in 'The quick brown fox'"
"Convert 'hello' to uppercase"
"Find and replace 'cat' with 'dog' in 'I love my cat'"
```

**📁 File Operations**
```
"List files in the current directory"
"Read the contents of README.md"
"Write 'Hello World' to test.txt"
```

**📅 Date & Time**
```
"What's the current time?"
"Format the date '2024-01-15' as 'January 15, 2024'"
"How many days between 2024-01-01 and 2024-12-31?"
```

**🔍 RAG (Document Search)**
```
"Ingest this document: 'Semantic Kernel is...'"
"Search documents for 'machine learning'"
"List all ingested documents"
```

**📝 JSON & Lists**
```
"Parse this JSON: '{\"name\":\"John\"}'"
"Merge lists [1,2,3] and [4,5,6]"
"Remove duplicates from [1,2,2,3,3,3]"
"Sort this list: [5,2,8,1,9]"
```

## Access the Chat

1. Wait for all services to start (~30 seconds)
2. Open browser: **http://localhost:3000**
3. Try: **"Add 10 and 20"** or **"What's the current time?"**

## Stop Everything

```powershell
.\scripts\Stop.ps1
```

## Service Status

| Service     | URL                      | Status Indicator                      |
|-------------|--------------------------|---------------------------------------|
| MCP Bridge  | http://localhost:8000    | Check `http://localhost:8000/health`  |
| Backend     | https://localhost:40443  | Look for "Registering MCP plugin"     |
| Frontend    | http://localhost:3000    | Browser opens automatically           |

## How It Works

```
Your Chat ──→ Chat Copilot ──→ MCP Bridge ──→ Azure FastMCP Server
   ↑              (C#)           (Python)        (Your Tools!)
   │
   └──── Gets results with 25 tools available
```

The **MCP Bridge** translates between:
- Microsoft's standard MCP protocol (what Chat Copilot uses)
- FastMCP's SSE protocol (what your server uses)

## Verify Tools Are Loaded

Check the **backend console** for:
```
[Information] Registering MCP plugin: CustomMcpServer
[Information] MCP server 'CustomMcpServer' provided 25 tools
```

## Example Chat Session

```
You: "Add 15 and 27"
Assistant: "The result is 42."

You: "Now reverse the string 'Hello World'"
Assistant: "The reversed string is 'dlroW olleH'."

You: "What's the current time?"
Assistant: "The current time is 2024-11-17 14:30:00."
```

## Troubleshooting

### "Python not found"
Install Python 3.8+: https://www.python.org/downloads/

### "Backend failed to start"
1. Run `.\scripts\Stop.ps1`
2. Wait 5 seconds
3. Run `.\scripts\Start.ps1` again

### "Tools not showing up"
1. Check MCP Bridge window for errors
2. Verify `webapi/appsettings.json`:
   ```json
   "Enabled": true,
   "Url": "http://localhost:8000/mcp"
   ```
3. Restart with `.\scripts\Stop.ps1` then `.\scripts\Start.ps1`

### "Bridge can't connect to Azure"
- Check your internet connection
- Verify your Azure FastMCP server is running:
  ```
  https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io
  ```

## Configuration Files

| File | Purpose |
|------|---------|
| `webapi/appsettings.json` | Enable/disable MCP, set bridge URL |
| `mcp-bridge/bridge.py` | Bridge settings, FastMCP server URL |
| `scripts/Start.ps1` | Startup script |

## Advanced Usage

### Change FastMCP Server

Edit `mcp-bridge/bridge.py`:

```python
FASTMCP_SERVER_URL = "https://your-new-server.azurecontainerapps.io"
```

### Disable MCP Tools

Edit `webapi/appsettings.json`:

```json
"Enabled": false
```

### Run Services Individually

```powershell
# Bridge only
.\scripts\Start-Bridge.ps1

# Backend only (requires bridge running)
.\scripts\Start-Backend.ps1

# Frontend only (requires backend running)
.\scripts\Start-Frontend.ps1
```

## Next Steps

- ✅ **Try all 25 tools** - Ask the chat to use different tools
- ✅ **Add your own tools** - Update your FastMCP server
- ✅ **Deploy the bridge** - Put it on Azure Container Apps
- ✅ **Share with team** - Everyone gets 25 new tools!

## Documentation

- **Scripts Guide**: `scripts/README.md`
- **Bridge Details**: `mcp-bridge/README.md`
- **MCP Integration**: `webapi/MCP_INTEGRATION_GUIDE.md`
- **Success Story**: `MCP_BRIDGE_SUCCESS.md`

## Your Tools Are Ready! 🎉

Run `.\scripts\Start.ps1` and start chatting with 25 new capabilities!

