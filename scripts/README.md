# Chat Copilot Scripts

This directory contains convenience scripts for starting and stopping Chat Copilot services.

## Quick Start

### Start Everything (Recommended)

```powershell
.\scripts\Start.ps1
```

This will start **all three services** in order:
1. **MCP Bridge** (http://localhost:8000) - Translates FastMCP → Standard MCP
2. **Backend** (https://localhost:40443) - Chat Copilot API
3. **Frontend** (http://localhost:3000) - React web app

### Stop Everything

```powershell
.\scripts\Stop.ps1
```

Cleanly stops all running services.

## Individual Service Scripts

### Start MCP Bridge Only

```powershell
.\scripts\Start-Bridge.ps1
```

Starts the MCP bridge server that connects your FastMCP server to Chat Copilot.

**What it does:**
- Checks for Python installation
- Installs Python dependencies if needed
- Starts the bridge on `http://localhost:8000`
- Connects to your Azure FastMCP server

**Requirements:**
- Python 3.8 or higher
- Packages: `httpx`, `starlette`, `uvicorn` (auto-installed)

### Start Backend Only

```powershell
.\scripts\Start-Backend.ps1
```

Starts the Chat Copilot backend API.

### Start Frontend Only

```powershell
.\scripts\Start-Frontend.ps1
```

Starts the React frontend web application.

## Service URLs

| Service     | URL                      | Description                           |
|-------------|--------------------------|---------------------------------------|
| MCP Bridge  | http://localhost:8000    | FastMCP protocol translation          |
| Backend API | https://localhost:40443  | Chat Copilot REST API                 |
| Frontend    | http://localhost:3000    | Web interface                         |

## MCP Bridge Endpoints

- **`/mcp`** - MCP JSON-RPC endpoint (used by backend)
- **`/health`** - Health check endpoint
- **`/`** - Bridge information

## Troubleshooting

### Python Not Found

**Error:** `Python is not installed or not in PATH`

**Solution:** Install Python from https://www.python.org/downloads/ (version 3.8+)

### Port Already in Use

**Error:** `Address already in use` or similar

**Solution:** 
1. Run `.\scripts\Stop.ps1` to stop any running services
2. Wait a few seconds
3. Run `.\scripts\Start.ps1` again

### MCP Bridge Connection Failed

**Error:** Bridge can't connect to FastMCP server

**Solution:**
1. Check that your Azure FastMCP server is running
2. Verify the URL in `mcp-bridge/bridge.py` or set `FASTMCP_SERVER_URL` environment variable
3. Check your internet connection

### Backend Can't Find MCP Tools

**Error:** Backend starts but no MCP tools are available

**Solution:**
1. Make sure MCP Bridge started successfully (check its window for errors)
2. Verify `webapi/appsettings.json` has the correct bridge URL (`http://localhost:8000/mcp`)
3. Check that `"Enabled": true` in the MCP server configuration

## Configuration

### Change MCP Bridge Port

Edit `mcp-bridge/bridge.py`:

```python
BRIDGE_PORT = int(os.getenv("BRIDGE_PORT", "8000"))
```

Or set environment variable:

```powershell
$env:BRIDGE_PORT = "9000"
.\scripts\Start-Bridge.ps1
```

### Change FastMCP Server URL

Edit `mcp-bridge/bridge.py`:

```python
FASTMCP_SERVER_URL = os.getenv(
    "FASTMCP_SERVER_URL",
    "https://your-server.azurecontainerapps.io"
)
```

Or set environment variable:

```powershell
$env:FASTMCP_SERVER_URL = "https://your-server.azurecontainerapps.io"
.\scripts\Start-Bridge.ps1
```

### Enable/Disable MCP Integration

Edit `webapi/appsettings.json`:

```json
"McpServers": {
  "Servers": [
    {
      "Name": "CustomMcpServer",
      "Enabled": true,  // Change to false to disable
      "Url": "http://localhost:8000/mcp"
    }
  ]
}
```

## Logs

### Error Logs

Check `scripts/error.log` for startup errors.

### Bridge Logs

The MCP Bridge logs to console in its window. Look for:
- `✓` Session initialized
- `✓` Returning X tools
- Any error messages in red

### Backend Logs

Check the backend console window for:
- `[Information] Registering MCP plugin: CustomMcpServer`
- `[Information] MCP server 'CustomMcpServer' provided 25 tools`

## Development

### Running Services Separately

For development, you might want to run services individually:

```powershell
# Terminal 1: MCP Bridge
cd mcp-bridge
python bridge.py

# Terminal 2: Backend
cd webapi
dotnet run

# Terminal 3: Frontend
cd webapp
yarn start
```

### Debugging the Bridge

Enable debug logging in `mcp-bridge/bridge.py`:

```python
logging.basicConfig(
    level=logging.DEBUG,  # Changed from INFO
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

## Architecture

```
┌─────────────────┐
│   Start.ps1     │  ← Run this script
└────────┬────────┘
         │
         ├──→ Start-Bridge.ps1  → MCP Bridge (Python)
         │                         └─→ FastMCP Server (Azure)
         │
         ├──→ Start-Backend.ps1 → Chat Copilot API (.NET)
         │                         └─→ MCP Bridge (http://localhost:8000)
         │
         └──→ Start-Frontend.ps1 → React App
                                   └─→ Backend API (https://localhost:40443)
```

## Your MCP Tools

When everything is running, Chat Copilot has access to **25 tools** from your FastMCP server:

- **Math:** add, multiply, divide, calculate_average
- **Strings:** reverse_string, count_words, to_uppercase, to_lowercase, find_and_replace
- **Files:** read_text_file, write_text_file, list_directory
- **Dates:** get_current_time, format_date, days_between_dates
- **JSON:** parse_json
- **Lists:** merge_lists, remove_duplicates, sort_list
- **RAG:** ingest_document, ingest_file, search_documents, list_ingested_documents, delete_document, clear_all_documents

Try asking Chat Copilot:
- "Add 15 and 27"
- "Reverse the string 'Hello World'"
- "What's the current time?"
- "Search documents for 'machine learning'"

## License

Same as Chat Copilot main project.
