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
    /// Controls how MCP tool execution works.
    /// - Auto: Tools are executed automatically without user approval (default)
    /// - RequireApproval: All MCP tools require user approval before execution
    /// - PerServer: Uses the RequireApproval setting on each individual server
    /// </summary>
    public PlanApprovalMode PlanApprovalMode { get; set; } = PlanApprovalMode.Auto;

    /// <summary>
    /// List of MCP servers to connect to.
    /// </summary>
    [Required]
    public List<McpServer> Servers { get; set; } = new();

    /// <summary>
    /// Checks if approval is required for a specific server based on global and per-server settings.
    /// </summary>
    /// <param name="serverName">The server name to check.</param>
    /// <returns>True if approval is required for tools from this server.</returns>
    public bool IsApprovalRequired(string serverName)
    {
        return PlanApprovalMode switch
        {
            PlanApprovalMode.Auto => false,
            PlanApprovalMode.RequireApproval => true,
            PlanApprovalMode.PerServer => Servers
                .FirstOrDefault(s => s.Name.Equals(serverName, StringComparison.OrdinalIgnoreCase))
                ?.RequireApproval ?? false,
            _ => false
        };
    }

    /// <summary>
    /// Checks if any MCP tool requires approval based on current settings.
    /// </summary>
    public bool AnyToolRequiresApproval()
    {
        return PlanApprovalMode switch
        {
            PlanApprovalMode.Auto => false,
            PlanApprovalMode.RequireApproval => Servers.Any(s => s.Enabled),
            PlanApprovalMode.PerServer => Servers.Any(s => s.Enabled && s.RequireApproval),
            _ => false
        };
    }
}

/// <summary>
/// Defines how MCP tool approval works.
/// </summary>
public enum PlanApprovalMode
{
    /// <summary>
    /// Tools are executed automatically without user approval (default).
    /// </summary>
    Auto,

    /// <summary>
    /// All MCP tools require user approval before execution.
    /// The system will show a plan with proposed tool calls and wait for user confirmation.
    /// </summary>
    RequireApproval,

    /// <summary>
    /// Uses the RequireApproval setting on each individual server.
    /// This allows fine-grained control over which servers require approval.
    /// </summary>
    PerServer
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

    /// <summary>
    /// Whether to require user approval before executing tools from this MCP server.
    /// When true, the system will show a plan with the proposed tool calls and wait for user approval.
    /// Default: false (tools are executed automatically).
    /// </summary>
    public bool RequireApproval { get; set; } = false;

    /// <summary>
    /// List of chat templates this MCP server should be available for.
    /// If empty or null, the server is available for all chats (default behavior).
    /// Example: ["klarsprak"] - only available for klarspråk assistant chats.
    /// </summary>
    public List<string>? Templates { get; set; }

    /// <summary>
    /// Check if this server should be available for a given chat template.
    /// </summary>
    /// <param name="chatTemplate">The chat template (e.g., "klarsprak") or null for default chats.</param>
    /// <returns>True if the server should be available for this chat type.</returns>
    public bool IsAvailableForTemplate(string? chatTemplate)
    {
        // If no templates specified, server is available for all chats
        if (Templates == null || Templates.Count == 0)
        {
            return true;
        }

        // If templates are specified, check if the current chat template matches
        // For default chats (template is null), only include if "default" is in the list
        if (string.IsNullOrEmpty(chatTemplate))
        {
            return Templates.Contains("default", StringComparer.OrdinalIgnoreCase);
        }

        return Templates.Contains(chatTemplate, StringComparer.OrdinalIgnoreCase);
    }
}

