"""
MCP Bridge Server - FastMCP to Standard MCP JSON-RPC

This bridge translates between:
- FastMCP Streamable HTTP (your server)
- Standard MCP JSON-RPC over HTTP (what Microsoft client expects)

Run with: python bridge.py
"""

import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional

import httpx
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, StreamingResponse
from starlette.routing import Route
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
FASTMCP_SERVER_URL = os.getenv(
    "FASTMCP_SERVER_URL",
    "https://f-mcp-2-server.ashyglacier-e54a9c36.norwayeast.azurecontainerapps.io"
)
BRIDGE_HOST = os.getenv("BRIDGE_HOST", "0.0.0.0")
BRIDGE_PORT = int(os.getenv("BRIDGE_PORT", "8002"))

# Global HTTP client and session management
http_client: Optional[httpx.AsyncClient] = None
session_id: Optional[str] = None
session_lock = asyncio.Lock()


async def get_http_client() -> httpx.AsyncClient:
    """Get or create the HTTP client."""
    global http_client
    
    if http_client is None:
        http_client = httpx.AsyncClient(
            base_url=FASTMCP_SERVER_URL,
            timeout=120.0,  # Increased timeout for slow FastMCP server responses
            follow_redirects=True
        )
        logger.info(f"Created HTTP client for {FASTMCP_SERVER_URL}")
    
    return http_client


async def get_or_create_session() -> str:
    """Get or create a session ID by initializing with the FastMCP server."""
    global session_id
    
    async with session_lock:
        if session_id is not None:
            return session_id
        
        logger.info("Initializing session with FastMCP server...")
        client = await get_http_client()
        
        # Send initialize request
        init_request = {
            "jsonrpc": "2.0",
            "id": 0,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "mcp-bridge",
                    "version": "1.0.0"
                }
            }
        }
        
        headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json"
        }
        
        response = await client.post("/mcp", json=init_request, headers=headers)
        response.raise_for_status()
        
        # FastMCP returns session ID in the "mcp-session-id" response header
        session_id = response.headers.get("mcp-session-id")
        
        if session_id:
            logger.info(f"Session initialized: {session_id}")
        else:
            session_id = "default-session"
            logger.warning(f"No mcp-session-id header found, using default: {session_id}")
        
        return session_id


async def fastmcp_request(endpoint: str, method: str = "POST", data: Optional[Dict] = None) -> Any:
    """Make a request to the FastMCP server."""
    client = await get_http_client()
    
    try:
        logger.debug(f"{method} {endpoint}: {data}")
        
        if method == "POST":
            response = await client.post(endpoint, json=data or {})
        else:
            response = await client.get(endpoint)
        
        response.raise_for_status()
        
        # Try to parse as JSON
        try:
            result = response.json()
            logger.debug(f"Response from {endpoint}: {result}")
            return result
        except:
            # Return text if not JSON
            return response.text
    
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error calling {endpoint}: {e}")
        raise
    except Exception as e:
        logger.error(f"Error calling {endpoint}: {e}")
        raise


async def handle_initialize(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle MCP initialize request."""
    # Try to get server info, or use defaults
    try:
        server_info = await fastmcp_request("/info", "GET")
        if isinstance(server_info, dict):
            name = server_info.get("name", "FastMCP Bridge")
            version = server_info.get("version", "1.0.0")
        else:
            name = "FastMCP Bridge"
            version = "1.0.0"
    except:
        name = "FastMCP Bridge"
        version = "1.0.0"
    
    return {
        "protocolVersion": "2024-11-05",
        "capabilities": {
            "tools": {},
            "resources": {},
            "prompts": {},
        },
        "serverInfo": {
            "name": name,
            "version": version,
        }
    }


async def handle_tools_list(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle tools/list request - get tools from FastMCP server."""
    try:
        # Try the standard MCP tools/list endpoint first
        result = await fastmcp_request("/tools/list", "POST", {})
        
        if isinstance(result, dict) and "tools" in result:
            tools = result["tools"]
        elif isinstance(result, list):
            tools = result
        else:
            logger.warning(f"Unexpected tools response format: {result}")
            tools = []
        
        # Ensure tools are in standard MCP format
        mcp_tools = []
        for tool in tools:
            if isinstance(tool, dict):
                mcp_tool = {
                    "name": tool.get("name", "unknown"),
                    "description": tool.get("description", ""),
                    "inputSchema": tool.get("inputSchema") or tool.get("parameters") or {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                }
                mcp_tools.append(mcp_tool)
        
        logger.info(f"Returning {len(mcp_tools)} tools")
        return {"tools": mcp_tools}
    
    except Exception as e:
        logger.error(f"Error listing tools: {e}")
        # Return empty tools list on error
        return {"tools": []}


async def handle_tools_call(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle tools/call request - invoke tool on FastMCP server."""
    tool_name = params.get("name")
    arguments = params.get("arguments", {})
    
    logger.info(f"Calling tool: {tool_name} with args: {arguments}")
    
    try:
        # Call the tool endpoint
        result = await fastmcp_request(
            "/tools/call",
            "POST",
            {
                "name": tool_name,
                "arguments": arguments
            }
        )
        
        # Format response
        if isinstance(result, dict) and "content" in result:
            return result
        else:
            # Wrap plain response in standard format
            return {
                "content": [
                    {
                        "type": "text",
                        "text": str(result)
                    }
                ]
            }
    except Exception as e:
        logger.error(f"Error calling tool {tool_name}: {e}")
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Error: {str(e)}"
                }
            ],
            "isError": True
        }


async def handle_resources_list(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle resources/list request."""
    try:
        result = await fastmcp_request("/resources/list", "POST", {})
        
        if isinstance(result, dict) and "resources" in result:
            return result
        elif isinstance(result, list):
            return {"resources": result}
        else:
            return {"resources": []}
    except Exception as e:
        logger.warning(f"Error listing resources: {e}")
        return {"resources": []}


async def handle_resources_read(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle resources/read request."""
    uri = params.get("uri")
    
    try:
        result = await fastmcp_request("/resources/read", "POST", {"uri": uri})
        
        if isinstance(result, dict) and "contents" in result:
            return result
        else:
            return {
                "contents": [
                    {
                        "uri": uri,
                        "mimeType": "text/plain",
                        "text": str(result)
                    }
                ]
            }
    except Exception as e:
        logger.error(f"Error reading resource {uri}: {e}")
        raise


async def handle_prompts_list(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle prompts/list request."""
    try:
        result = await fastmcp_request("/prompts/list", "POST", {})
        
        if isinstance(result, dict) and "prompts" in result:
            return result
        elif isinstance(result, list):
            return {"prompts": result}
        else:
            return {"prompts": []}
    except Exception as e:
        logger.warning(f"Error listing prompts: {e}")
        return {"prompts": []}


async def handle_prompts_get(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle prompts/get request."""
    name = params.get("name")
    arguments = params.get("arguments", {})
    
    try:
        result = await fastmcp_request(
            "/prompts/get",
            "POST",
            {
                "name": name,
                "arguments": arguments
            }
        )
        
        if isinstance(result, dict) and "messages" in result:
            return result
        else:
            return {
                "messages": [
                    {
                        "role": "user",
                        "content": {
                            "type": "text",
                            "text": str(result)
                        }
                    }
                ]
            }
    except Exception as e:
        logger.error(f"Error getting prompt {name}: {e}")
        raise


# JSON-RPC request handler - SSE to JSON bridge
async def handle_jsonrpc(request: Request) -> JSONResponse:
    """Handle JSON-RPC requests by converting to FastMCP's SSE protocol."""
    try:
        body = await request.json()
        
        method = body.get("method")
        request_id = body.get("id")
        
        logger.info(f"Converting JSON-RPC request to SSE: {method}")
        
        # Ensure we have a session (except for initialize requests)
        if method != "initialize":
            await get_or_create_session()
        
        # Forward request to FastMCP server's /mcp endpoint with SSE headers
        client = await get_http_client()
        
        # FastMCP uses Server-Sent Events (SSE) - it requires both JSON and SSE in Accept header
        headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json"
        }
        
        # Add session ID if we have one (FastMCP uses "mcp-session-id" header)
        if session_id:
            headers["mcp-session-id"] = session_id
        
        # Handle notifications (202 Accepted with no response body expected)
        async with client.stream("POST", "/mcp", json=body, headers=headers) as response:
            response.raise_for_status()
            
            if response.status_code == 202:
                # Notification messages don't need a response
                logger.info(f"Notification message '{method}' accepted by FastMCP server")
                return JSONResponse({
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {}
                })
            
            # Read SSE stream line by line until we get a valid JSON-RPC response
            # This prevents waiting for the entire stream to complete
            buffer = ""
            async for chunk in response.aiter_bytes():
                buffer += chunk.decode('utf-8', errors='ignore')
                
                # Process complete lines
                while '\n' in buffer:
                    line, buffer = buffer.split('\n', 1)
                    line = line.strip()
                    
                    if line.startswith('data: '):
                        json_str = line[6:]  # Remove "data: " prefix
                        if json_str and json_str != '[DONE]':
                            try:
                                result = json.loads(json_str)
                                # We got a JSON-RPC response, use it and close the stream
                                if isinstance(result, dict) and 'jsonrpc' in result:
                                    logger.debug(f"Parsed SSE JSON-RPC response: {result}")
                                    return JSONResponse(result)
                            except json.JSONDecodeError:
                                logger.debug(f"Non-JSON SSE data: {json_str}")
                                continue
            
            # If we didn't find a proper response, return error
            return JSONResponse({
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {
                    "code": -32603,
                    "message": "No valid JSON-RPC response found in SSE stream"
                }
            }, status_code=500)
    
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error from FastMCP server: {e}", exc_info=True)
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": body.get("id") if 'body' in locals() else None,
            "error": {
                "code": -32603,
                "message": f"FastMCP server error: {str(e)}"
            }
        }, status_code=500)
    except Exception as e:
        logger.error(f"Error handling request: {e}", exc_info=True)
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": body.get("id") if 'body' in locals() else None,
            "error": {
                "code": -32603,
                "message": f"Internal error: {str(e)}"
            }
        }, status_code=500)


async def health_check(request: Request) -> JSONResponse:
    """Health check endpoint."""
    try:
        client = await get_http_client()
        # Try to ping the FastMCP server with a simple GET
        response = await client.get("/")
        response.raise_for_status()
        
        return JSONResponse({
            "status": "healthy",
            "fastmcp_server": FASTMCP_SERVER_URL,
            "bridge": "running"
        })
    except Exception as e:
        return JSONResponse({
            "status": "unhealthy",
            "error": str(e)
        }, status_code=503)


async def root(request: Request) -> JSONResponse:
    """Root endpoint with bridge information."""
    return JSONResponse({
        "service": "MCP Bridge Server",
        "description": "Translates FastMCP Streamable HTTP to Standard MCP JSON-RPC",
        "fastmcp_server": FASTMCP_SERVER_URL,
        "endpoints": {
            "mcp": "/mcp (POST - JSON-RPC endpoint)",
            "health": "/health (GET - health check)"
        }
    })


async def mcp_info(request: Request) -> JSONResponse:
    """MCP endpoint info (for GET requests)."""
    return JSONResponse({
        "protocol": "MCP JSON-RPC",
        "version": "2024-11-05",
        "transport": "HTTP POST",
        "note": "This endpoint accepts POST requests with JSON-RPC messages",
        "fastmcp_server": FASTMCP_SERVER_URL,
        "usage": {
            "method": "POST",
            "content_type": "application/json",
            "body": {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/list",
                "params": {}
            }
        }
    })


# Create Starlette app
app = Starlette(
    debug=True,
    routes=[
        Route("/", root, methods=["GET"]),
        Route("/mcp", handle_jsonrpc, methods=["POST"]),
        Route("/mcp", mcp_info, methods=["GET"]),
        Route("/health", health_check, methods=["GET"]),
    ]
)


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    global http_client
    if http_client is not None:
        logger.info("Closing HTTP client connection")
        await http_client.aclose()


if __name__ == "__main__":
    logger.info("=" * 70)
    logger.info("  MCP Bridge Server - FastMCP to Standard MCP JSON-RPC")
    logger.info(f"  FastMCP Server: {FASTMCP_SERVER_URL}")
    logger.info(f"  Bridge Listening: http://{BRIDGE_HOST}:{BRIDGE_PORT}")
    logger.info(f"  MCP Endpoint: http://{BRIDGE_HOST}:{BRIDGE_PORT}/mcp")
    logger.info("=" * 70)
    
    uvicorn.run(
        app,
        host=BRIDGE_HOST,
        port=BRIDGE_PORT,
        log_level="info"
    )

