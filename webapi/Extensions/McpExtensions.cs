// Copyright (c) Microsoft. All rights reserved.

using CopilotChat.WebApi.Options;
using CopilotChat.WebApi.Services;
using Microsoft.Extensions.Options;
using Microsoft.SemanticKernel;
using ModelContextProtocol.Client;

namespace CopilotChat.WebApi.Extensions;

/// <summary>
/// Extension methods for registering Model Context Protocol (MCP) services.
/// </summary>
internal static class McpExtensions
{
    /// <summary>
    /// Register MCP servers from configuration.
    /// </summary>
    internal static IServiceCollection AddMcpServers(this IServiceCollection services, IConfiguration configuration)
    {
        // Add MCP configuration
        services.AddOptions<McpServerOptions>(configuration.GetSection(McpServerOptions.PropertyName));

        // Register MCP client manager as singleton
        services.AddSingleton<IMcpClientManager, McpClientManager>();

        // Register MCP plan service for handling tool approval workflow
        services.AddSingleton<McpPlanService>();

        return services;
    }

    /// <summary>
    /// Register MCP tools as Semantic Kernel plugins.
    /// </summary>
    /// <param name="kernel">The kernel to register plugins with.</param>
    /// <param name="sp">The service provider.</param>
    /// <param name="chatTemplate">Optional chat template to filter MCP servers (e.g., "klarsprak").</param>
    internal static async Task RegisterMcpPluginsAsync(this Kernel kernel, IServiceProvider sp, string? chatTemplate = null)
    {
        var mcpClientManager = sp.GetRequiredService<IMcpClientManager>();
        var mcpOptions = sp.GetRequiredService<IOptions<McpServerOptions>>();
        var logger = sp.GetRequiredService<ILogger<Kernel>>();

        try
        {
            await mcpClientManager.InitializeAsync();
            var mcpClients = mcpClientManager.GetAllClients();

            // Get server configurations to check template restrictions (use first occurrence if duplicates exist)
            var serverConfigs = mcpOptions.Value.Servers?
                .GroupBy(s => s.Name)
                .ToDictionary(g => g.Key, g => g.First()) ?? new();

            foreach (var (serverName, mcpClient) in mcpClients)
            {
                // Check if this server should be available for the current chat template
                if (serverConfigs.TryGetValue(serverName, out var serverConfig))
                {
                    if (!serverConfig.IsAvailableForTemplate(chatTemplate))
                    {
                        logger.LogInformation("Skipping MCP server '{ServerName}' - not configured for template '{Template}'",
                            serverName, chatTemplate ?? "default");
                        continue;
                    }
                }

                logger.LogInformation("MCP server '{ServerName}' is available for template '{Template}'",
                    serverName, chatTemplate ?? "default");

                try
                {
                    logger.LogInformation("Registering MCP plugin: {ServerName}", serverName);

                    // List tools from the MCP server
                    var tools = await mcpClient.ListToolsAsync();

                    if (tools == null || tools.Count == 0)
                    {
                        logger.LogWarning("MCP server '{ServerName}' returned no tools", serverName);
                        continue;
                    }

                    logger.LogInformation("MCP server '{ServerName}' provided {Count} tools", serverName, tools.Count);

                    // Convert MCP tools to Semantic Kernel functions
                    var functions = new List<KernelFunction>();
                    foreach (var tool in tools)
                    {
                        try
                        {
#pragma warning disable SKEXP0001 // Type is for evaluation purposes only
                            var function = tool.AsKernelFunction();
#pragma warning restore SKEXP0001
                            functions.Add(function);
                            logger.LogDebug("Registered MCP tool: {ServerName}.{ToolName}", serverName, tool.Name);
                        }
                        catch (Exception ex)
                        {
                            logger.LogWarning(ex, "Failed to convert MCP tool '{ToolName}' from server '{ServerName}' to kernel function",
                                tool.Name, serverName);
                        }
                    }

                    // Add all functions as a plugin
                    if (functions.Count > 0)
                    {
                        kernel.Plugins.AddFromFunctions(serverName, functions);
                        logger.LogInformation("Successfully registered MCP plugin '{ServerName}' with {Count} functions",
                            serverName, functions.Count);
                    }
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to register MCP plugin from server '{ServerName}'", serverName);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to initialize MCP client manager");
        }
    }
}

/// <summary>
/// Interface for managing MCP client connections.
/// </summary>
internal interface IMcpClientManager : IAsyncDisposable
{
    /// <summary>
    /// Initialize all configured MCP server connections.
    /// </summary>
    Task InitializeAsync();

    /// <summary>
    /// Get all initialized MCP clients.
    /// </summary>
    IReadOnlyDictionary<string, McpClient> GetAllClients();

    /// <summary>
    /// Get a specific MCP client by server name.
    /// </summary>
    McpClient? GetClient(string serverName);
}

/// <summary>
/// Manages MCP client connections throughout the application lifetime.
/// </summary>
internal sealed class McpClientManager : IMcpClientManager
{
    private readonly IOptions<McpServerOptions> _options;
    private readonly ILogger<McpClientManager> _logger;
    private readonly Dictionary<string, McpClient> _clients = new();
    private bool _initialized = false;
    private readonly SemaphoreSlim _initLock = new(1, 1);

    public McpClientManager(IOptions<McpServerOptions> options, ILogger<McpClientManager> logger)
    {
        _options = options;
        _logger = logger;
    }

    public async Task InitializeAsync()
    {
        if (_initialized)
        {
            return;
        }

        await _initLock.WaitAsync();
        try
        {
            if (_initialized)
            {
                return;
            }

            var servers = _options.Value.Servers ?? new List<McpServer>();

            // Get unique servers by name (in case of duplicates in config)
            var uniqueServers = servers
                .Where(s => s.Enabled)
                .GroupBy(s => s.Name)
                .Select(g => g.First())
                .ToList();

            _logger.LogInformation("Initializing {Count} MCP server connections (from {TotalCount} configured)",
                uniqueServers.Count, servers.Count);

            foreach (var server in uniqueServers)
            {
                // Skip if already connected (in case of retry)
                if (_clients.ContainsKey(server.Name))
                {
                    _logger.LogDebug("MCP server '{Name}' already connected, skipping", server.Name);
                    continue;
                }

                try
                {
                    _logger.LogInformation("Connecting to MCP server: {Name} (Transport: {Transport})",
                        server.Name, server.Transport);

                    McpClient client;

                    if (server.Transport.Equals("Http", StringComparison.OrdinalIgnoreCase))
                    {
                        if (string.IsNullOrWhiteSpace(server.Url))
                        {
                            _logger.LogWarning("MCP server '{Name}' uses HTTP transport but has no URL configured. Skipping...",
                                server.Name);
                            continue;
                        }

                        // Create HTTP transport client
                        var httpClient = new HttpClient
                        {
                            BaseAddress = new Uri(server.Url),
                            Timeout = TimeSpan.FromSeconds(server.TimeoutSeconds)
                        };
                        var httpClientTransportOptions = new HttpClientTransportOptions
                        {
                            Endpoint = new Uri(server.Url)
                        };
                        var httpTransport = new HttpClientTransport(httpClientTransportOptions, httpClient);

                        client = await McpClient.CreateAsync(httpTransport);
                    }
                    else if (server.Transport.Equals("Stdio", StringComparison.OrdinalIgnoreCase))
                    {
                        if (string.IsNullOrWhiteSpace(server.Command))
                        {
                            _logger.LogWarning("MCP server '{Name}' uses Stdio transport but has no command configured. Skipping...",
                                server.Name);
                            continue;
                        }

                        // Create Stdio transport client
                        var stdioConfig = new StdioClientTransportOptions
                        {
                            Name = server.Name,
                            Command = server.Command,
                            Arguments = server.Arguments?.ToArray() ?? Array.Empty<string>(),
                            EnvironmentVariables = server.EnvironmentVariables ?? new Dictionary<string, string>()
                        };

                        var stdioTransport = new StdioClientTransport(stdioConfig);
                        client = await McpClient.CreateAsync(stdioTransport);
                    }
                    else
                    {
                        _logger.LogWarning("MCP server '{Name}' has unsupported transport type '{Transport}'. Skipping...",
                            server.Name, server.Transport);
                        continue;
                    }

                    _clients[server.Name] = client;
                    _logger.LogInformation("Successfully connected to MCP server: {Name}", server.Name);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to connect to MCP server '{Name}'. It will be unavailable.", server.Name);
                    // Continue to next server - don't let one failure stop all connections
                }
            }

            // Mark as initialized even if some servers failed - we don't want to retry on every request
            _initialized = true;
            _logger.LogInformation("MCP initialization complete. {Count}/{TotalCount} servers connected successfully",
                _clients.Count, uniqueServers.Count);
        }
        finally
        {
            _initLock.Release();
        }
    }

    public IReadOnlyDictionary<string, McpClient> GetAllClients()
    {
        return _clients;
    }

    public McpClient? GetClient(string serverName)
    {
        _clients.TryGetValue(serverName, out var client);
        return client;
    }

    public async ValueTask DisposeAsync()
    {
        _logger.LogInformation("Disposing MCP client manager with {Count} clients", _clients.Count);

        foreach (var (name, client) in _clients)
        {
            try
            {
                await client.DisposeAsync();
                _logger.LogDebug("Disposed MCP client: {Name}", name);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error disposing MCP client '{Name}'", name);
            }
        }

        _clients.Clear();
        _initLock.Dispose();

        GC.SuppressFinalize(this);
    }
}
