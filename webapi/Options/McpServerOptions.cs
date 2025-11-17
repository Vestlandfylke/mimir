// Copyright (c) Microsoft. All rights reserved.

using System.ComponentModel.DataAnnotations;

namespace CopilotChat.WebApi.Options;

/// <summary>
/// Configuration options for MCP (Model Context Protocol) servers.
/// </summary>
public class McpServerOptions
{
    public const string PropertyName = "McpServers";

    /// <summary>
    /// List of MCP servers to connect to.
    /// </summary>
    [Required]
    public List<McpServer> Servers { get; set; } = new();
}

/// <summary>
/// Configuration for a single MCP server connection.
/// </summary>
public class McpServer
{
    /// <summary>
    /// Name of the MCP server (used as plugin name in Semantic Kernel).
    /// </summary>
    [Required, NotEmptyOrWhitespace]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Transport type for connecting to the MCP server.
    /// Supported values: "Http", "Stdio"
    /// </summary>
    [Required, NotEmptyOrWhitespace]
    public string Transport { get; set; } = "Http";

    /// <summary>
    /// For HTTP transport: URL of the MCP server.
    /// </summary>
    public string? Url { get; set; }

    /// <summary>
    /// For Stdio transport: Command to execute.
    /// </summary>
    public string? Command { get; set; }

    /// <summary>
    /// For Stdio transport: Arguments for the command.
    /// </summary>
    public List<string>? Arguments { get; set; }

    /// <summary>
    /// Environment variables to set for the MCP server.
    /// </summary>
    public Dictionary<string, string>? EnvironmentVariables { get; set; }

    /// <summary>
    /// Whether this server is enabled.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Timeout in seconds for connecting to the server (default: 30 seconds).
    /// </summary>
    public int TimeoutSeconds { get; set; } = 30;

    /// <summary>
    /// Description of what this MCP server provides (for documentation).
    /// </summary>
    public string? Description { get; set; }
}

