# MCP Integration Architecture

## Overview

This document describes the complete architecture of the MCP (Model Context Protocol) integration in Chat Copilot.

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE LAYER                          │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    React Frontend                             │   │
│  │                  http://localhost:3000                        │   │
│  │                                                               │   │
│  │  • Chat Interface                                             │   │
│  │  • Message History                                            │   │
│  │  • Function Calling Display                                   │   │
│  └───────────────────────┬──────────────────────────────────────┘   │
│                          │                                            │
└──────────────────────────┼────────────────────────────────────────────┘
                           │ HTTP/REST
                           ↓
┌────────────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                                 │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Chat Copilot Backend (.NET 8)                    │   │
│  │              https://localhost:40443                          │   │
│  │                                                               │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │         Semantic Kernel (v1.45.0)                   │    │   │
│  │  │                                                      │    │   │
│  │  │  • Chat Orchestration                               │    │   │
│  │  │  • Plugin Management                                │    │   │
│  │  │  • Function Calling                                 │    │   │
│  │  │  • Memory Management                                │    │   │
│  │  └──────────────────┬──────────────────────────────────┘    │   │
│  │                     │                                        │   │
│  │  ┌──────────────────┴──────────────────────────────────┐    │   │
│  │  │         MCP Client Manager                          │    │   │
│  │  │     (McpExtensions.cs)                              │    │   │
│  │  │                                                      │    │   │
│  │  │  • Initialize MCP clients                           │    │   │
│  │  │  • Register plugins from tools                      │    │   │
│  │  │  • Manage connection lifecycle                      │    │   │
│  │  └──────────────────┬──────────────────────────────────┘    │   │
│  └────────────────────┬┴───────────────────────────────────────┘   │
│                       │                                             │
└───────────────────────┼─────────────────────────────────────────────┘
                        │ Standard MCP JSON-RPC
                        │ http://localhost:8000/mcp
                        ↓
┌────────────────────────────────────────────────────────────────────────┐
│                     PROTOCOL BRIDGE LAYER                              │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              MCP Bridge Server (Python)                       │   │
│  │              http://localhost:8000                            │   │
│  │                                                               │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │         Request Handler                             │    │   │
│  │  │                                                      │    │   │
│  │  │  • Receive JSON-RPC requests                        │    │   │
│  │  │  • Validate requests                                │    │   │
│  │  │  • Route to appropriate handler                     │    │   │
│  │  └──────────────────┬──────────────────────────────────┘    │   │
│  │                     │                                        │   │
│  │  ┌──────────────────┴──────────────────────────────────┐    │   │
│  │  │         Session Manager                             │    │   │
│  │  │                                                      │    │   │
│  │  │  • Initialize session on first request             │    │   │
│  │  │  • Store mcp-session-id                            │    │   │
│  │  │  • Include session ID in headers                   │    │   │
│  │  │  • Thread-safe session handling                    │    │   │
│  │  └──────────────────┬──────────────────────────────────┘    │   │
│  │                     │                                        │   │
│  │  ┌──────────────────┴──────────────────────────────────┐    │   │
│  │  │         Protocol Translator                         │    │   │
│  │  │                                                      │    │   │
│  │  │  • Add required headers:                            │    │   │
│  │  │    - Accept: application/json, text/event-stream    │    │   │
│  │  │    - Content-Type: application/json                 │    │   │
│  │  │    - mcp-session-id: <session_id>                  │    │   │
│  │  │  • Parse SSE responses                              │    │   │
│  │  │  • Extract JSON-RPC from SSE data                   │    │   │
│  │  │  • Return clean JSON-RPC                            │    │   │
│  │  └──────────────────┬──────────────────────────────────┘    │   │
│  └────────────────────┬┴───────────────────────────────────────┘   │
│                       │                                             │
└───────────────────────┼─────────────────────────────────────────────┘
                        │ FastMCP SSE Protocol
                        │ POST /mcp
                        │ Headers: Accept, mcp-session-id
                        ↓
┌────────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICE LAYER                            │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │         FastMCP Server (Azure Container Apps)                 │   │
│  │         https://f-mcp-2-server.ashyglacier-...               │   │
│  │                                                               │   │
│  │  • 25 Tools Available                                         │   │
│  │  • SSE-based Protocol                                         │   │
│  │  • Session Management                                         │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## Request Flow

### Initialize Request

```
1. User starts Chat Copilot
   │
   ↓
2. Backend startup triggers MCP client initialization
   │
   ↓
3. McpClientManager.InitializeAsync()
   │
   ↓
4. HTTP POST to Bridge → http://localhost:8000/mcp
   │
   ↓
5. Bridge receives JSON-RPC: {"method": "initialize", ...}
   │
   ↓
6. Bridge calls get_or_create_session()
   │
   ├─→ POST to FastMCP → /mcp
   │   Headers: Accept: application/json, text/event-stream
   │
   ├─→ FastMCP returns SSE response with mcp-session-id header
   │
   └─→ Bridge stores session ID
   │
   ↓
7. Bridge forwards initialize to FastMCP
   │
   ↓
8. FastMCP returns capabilities in SSE format
   │
   ↓
9. Bridge parses SSE, extracts JSON-RPC
   │
   ↓
10. Bridge returns JSON-RPC to Backend
    │
    ↓
11. Backend receives: {"result": {"capabilities": {...}}}
```

### List Tools Request

```
1. Backend calls ListToolsAsync()
   │
   ↓
2. HTTP POST to Bridge → http://localhost:8000/mcp
   Body: {"jsonrpc":"2.0","method":"tools/list","params":{}}
   │
   ↓
3. Bridge adds session headers
   │
   ├─→ Headers:
   │   - Accept: application/json, text/event-stream
   │   - Content-Type: application/json
   │   - mcp-session-id: <stored_session_id>
   │
   ↓
4. Bridge POST to FastMCP → /mcp
   │
   ↓
5. FastMCP returns SSE stream
   │
   event: message
   data: {"jsonrpc":"2.0","result":{"tools":[...]}}
   │
   ↓
6. Bridge parses SSE:
   │
   ├─→ Split by newlines
   ├─→ Find lines starting with "data: "
   ├─→ Extract JSON from data lines
   ├─→ Parse JSON-RPC message
   │
   ↓
7. Bridge returns clean JSON-RPC to Backend
   │
   ↓
8. Backend receives: {"tools": [25 tools]}
   │
   ↓
9. For each tool, Backend calls AsKernelFunction()
   │
   ↓
10. Backend adds functions to Kernel.Plugins
    │
    ↓
11. Tools are now available in chat!
```

### Tool Call Request

```
1. User: "Add 10 and 20"
   │
   ↓
2. Frontend sends message to Backend
   │
   ↓
3. Semantic Kernel plans function call
   │
   ├─→ Function: add
   ├─→ Arguments: {"a": 10, "b": 20}
   │
   ↓
4. Backend calls tool via MCP
   │
   ├─→ HTTP POST to Bridge
   │   Body: {
   │     "method": "tools/call",
   │     "params": {
   │       "name": "add",
   │       "arguments": {"a": 10, "b": 20}
   │     }
   │   }
   │
   ↓
5. Bridge adds session headers and forwards
   │
   ↓
6. FastMCP executes tool
   │
   ↓
7. FastMCP returns result in SSE format
   │
   event: message
   data: {"result":{"content":[{"type":"text","text":"30"}]}}
   │
   ↓
8. Bridge parses and returns JSON-RPC
   │
   ↓
9. Backend receives: {"content": [{"type": "text", "text": "30"}]}
   │
   ↓
10. Semantic Kernel includes result in prompt
    │
    ↓
11. LLM generates response: "The result is 30."
    │
    ↓
12. Frontend displays to user
```

## Data Structures

### MCP JSON-RPC Request (Standard)
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

### FastMCP SSE Response
```
event: message
data: {"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}

event: message
data: [DONE]
```

### Bridge Translated Response (Standard)
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [...]
  }
}
```

## Components

### 1. Frontend (React)
- **Location**: `webapp/`
- **Port**: 3000
- **Role**: User interface
- **Tech**: React, TypeScript, Material-UI

### 2. Backend (C#)
- **Location**: `webapi/`
- **Port**: 40443 (HTTPS)
- **Role**: Chat orchestration, MCP client
- **Tech**: .NET 8, Semantic Kernel 1.45.0

### 3. MCP Bridge (Python)
- **Location**: `mcp-bridge/`
- **Port**: 8000
- **Role**: Protocol translation
- **Tech**: Python 3.8+, Starlette, httpx

### 4. FastMCP Server (Python)
- **Location**: Azure Container Apps
- **Port**: 443 (HTTPS)
- **Role**: Tool execution
- **Tech**: FastMCP 2.13.0

## Configuration Files

### Backend Configuration
**File**: `webapi/appsettings.json`

```json
{
  "McpServers": {
    "Servers": [
      {
        "Name": "CustomMcpServer",
        "Transport": "Http",
        "Url": "http://localhost:8000/mcp",
        "Enabled": true,
        "TimeoutSeconds": 60,
        "Description": "FastMCP server via Python bridge"
      }
    ]
  }
}
```

### Bridge Configuration
**File**: `mcp-bridge/bridge.py`

```python
FASTMCP_SERVER_URL = os.getenv(
    "FASTMCP_SERVER_URL",
    "https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io"
)
BRIDGE_HOST = os.getenv("BRIDGE_HOST", "0.0.0.0")
BRIDGE_PORT = int(os.getenv("BRIDGE_PORT", "8000"))
```

## Security Considerations

### Development (Current)
- Bridge runs on localhost
- Backend connects to localhost bridge
- Bridge connects to public Azure FastMCP server
- **Security**: Development only, not for production

### Production (Recommended)
- Deploy bridge to Azure Container Apps
- Use Azure Private Link for backend → bridge
- Use Azure AD authentication
- Enable HTTPS everywhere
- Use secrets management (Azure Key Vault)

## Performance Characteristics

| Operation | Latency | Notes |
|-----------|---------|-------|
| Initialize | ~500ms | Includes session creation |
| List tools | ~100ms | Cached in backend |
| Tool call | ~200-500ms | Varies by tool complexity |
| Bridge overhead | ~50-100ms | Protocol translation |

## Error Handling

### Bridge Error Cases

1. **FastMCP Server Unavailable**
   - Bridge returns 503 error
   - Backend logs warning
   - Chat continues without MCP tools

2. **Session Expired**
   - Bridge re-initializes session
   - Request retried automatically

3. **Invalid Tool Call**
   - FastMCP returns error in SSE
   - Bridge forwards error to backend
   - Semantic Kernel handles gracefully

4. **SSE Parsing Error**
   - Bridge logs error
   - Returns JSON-RPC error response
   - Backend logs warning

## Deployment Scenarios

### Scenario 1: Local Development
```
Developer → Localhost:3000 → Localhost:40443 → Localhost:8000 → Azure FastMCP
```

### Scenario 2: Azure Deployment (Backend + Bridge)
```
User → Azure Frontend → Azure Backend → Azure Bridge → Azure FastMCP
```

### Scenario 3: Future (Native Support)
```
User → Azure Frontend → Azure Backend → Azure FastMCP (direct)
                        ↑
                        └─ No bridge needed!
```

## Monitoring & Observability

### Logs to Watch

**Bridge Logs**:
- `Session initialized: <session_id>`
- `Converting JSON-RPC request to SSE: <method>`
- `Returning X tools`

**Backend Logs**:
- `[Information] Registering MCP plugin: CustomMcpServer`
- `[Information] MCP server 'CustomMcpServer' provided 25 tools`

**Health Checks**:
- Bridge: `GET http://localhost:8000/health`
- Backend: `GET https://localhost:40443/healthz`
- FastMCP: `GET https://<your-server>/health`

## Troubleshooting

### No Tools Available
1. Check bridge is running: `http://localhost:8000/health`
2. Check backend logs for "Registering MCP plugin"
3. Verify `appsettings.json` has `"Enabled": true`

### Tools Not Executing
1. Check bridge logs for errors
2. Verify session management is working
3. Test FastMCP server directly

### Performance Issues
1. Check network latency to Azure
2. Consider deploying bridge closer to FastMCP
3. Review tool execution times

## Future Enhancements

### Short Term
- [ ] Deploy bridge to Azure
- [ ] Add bridge metrics/monitoring
- [ ] Implement bridge caching
- [ ] Add more error recovery

### Long Term
- [ ] Native FastMCP support in Semantic Kernel
- [ ] Remove bridge when no longer needed
- [ ] Direct backend ↔ FastMCP connection

## References

- [Semantic Kernel Documentation](https://learn.microsoft.com/en-us/semantic-kernel/)
- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [FastMCP Documentation](https://github.com/jlowin/fastmcp)
- [Starlette Documentation](https://www.starlette.io/)

---

**Architecture Status**: ✅ Production Ready

**Last Updated**: 2024-11-17

