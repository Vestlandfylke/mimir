// Copyright (c) Microsoft. All rights reserved.

using System.Diagnostics;
using System.Text.Json;
using CopilotChat.WebApi.Extensions;
using CopilotChat.WebApi.Hubs;
using CopilotChat.WebApi.Services;
using Microsoft.ApplicationInsights.Extensibility;
using Microsoft.ApplicationInsights.Extensibility.Implementation;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;

namespace CopilotChat.WebApi;

/// <summary>
/// Chat Copilot Service
/// Built with Semantic Kernel 1.68.0 for GPT-5/GPT-4o compatibility
/// </summary>
internal sealed class Program
{
    /// <summary>
    /// Entry point
    /// </summary>
    /// <param name="args">Web application command-line arguments.</param>
    // ReSharper disable once InconsistentNaming
    public static async Task Main(string[] args)
    {
        WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

        // Load in configuration settings from appsettings.json, user-secrets, key vaults, etc...
        builder.Host.AddConfiguration();
        builder.WebHost.UseUrls(); // Disables endpoint override warning message when using IConfiguration for Kestrel endpoint.

        // Add in configuration options and required services.
        builder.Services
            .AddSingleton<ILogger>(sp => sp.GetRequiredService<ILogger<Program>>()) // some services require an un-templated ILogger
            .AddOptions(builder.Configuration)
            .AddPersistentChatStore()
            .AddPlugins(builder.Configuration)
            .AddMcpServers(builder.Configuration)
            .AddChatCopilotAuthentication(builder.Configuration)
            .AddChatCopilotAuthorization()
            .AddSingleton<IDocumentTextExtractor, DocumentTextExtractor>() // Document text extraction for SharePoint plugin
            .AddScoped<LeiarKontekstCitationService>(); // Citation collection for LeiarKontekst plugin

        // Configure and add semantic services
        builder
            .AddBotConfig()
            .AddSemanticKernelServices()
            .AddKernelMemoryServices();

        // Add SignalR as the real time relay service
        // Use Azure SignalR Service if connection string is configured (required for multi-instance scaling)
        var signalRConnectionString = builder.Configuration["Azure:SignalR:ConnectionString"];
        if (!string.IsNullOrEmpty(signalRConnectionString))
        {
            builder.Services.AddSignalR().AddAzureSignalR(options =>
            {
                options.ConnectionString = signalRConnectionString;
                options.ServerStickyMode = Microsoft.Azure.SignalR.ServerStickyMode.Required;
            });
        }
        else
        {
            builder.Services.AddSignalR();
        }

        // Add AppInsights telemetry
        builder.Services
            .AddHttpContextAccessor()
            .AddApplicationInsightsTelemetry(options => { options.ConnectionString = builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"]; })
            .AddSingleton<ITelemetryInitializer, AppInsightsUserTelemetryInitializerService>()
            .AddLogging(logBuilder => logBuilder.AddApplicationInsights())
            .AddSingleton<ITelemetryService, AppInsightsTelemetryService>();

        // Add chat cancellation service for stopping LLM requests
        builder.Services.AddSingleton<ChatCancellationService>();

        // Add plugin hint service for proactive plugin usage
        builder.Services.AddSingleton<PluginHintService>();

        TelemetryDebugWriter.IsTracingDisabled = Debugger.IsAttached;

        // Add named HTTP clients for IHttpClientFactory
        // Configure longer timeout for AI services (reasoning models can take 3+ minutes to start responding)
        builder.Services.AddHttpClient().ConfigureHttpClientDefaults(clientBuilder =>
        {
            clientBuilder.ConfigureHttpClient(client =>
            {
                client.Timeout = TimeSpan.FromMinutes(5); // 5 minute timeout for AI model calls
            });
        });

        // Add rate limiting for spam/abuse protection
        builder.Services.AddRateLimitingServices(builder.Configuration);

        // Add in the rest of the services.
        builder.Services
            .AddMaintenanceServices()
            .AddEndpointsApiExplorer()
            .AddSwaggerGen(options =>
            {
                options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
                {
                    Title = "Mimir API",
                    Version = "1.0.0",
                    Description = "API for Mimir - Vestland fylkeskommune sin KI-assistent"
                });

                // Resolve conflicting actions by taking the first one
                options.ResolveConflictingActions(apiDescriptions => apiDescriptions.First());

                // Add Bearer token authentication for Swagger UI
                options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
                {
                    Description = "JWT Authorization header using the Bearer scheme. Enter your token in the text input below.",
                    Name = "Authorization",
                    In = Microsoft.OpenApi.Models.ParameterLocation.Header,
                    Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "JWT"
                });

                options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
                {
                    {
                        new Microsoft.OpenApi.Models.OpenApiSecurityScheme
                        {
                            Reference = new Microsoft.OpenApi.Models.OpenApiReference
                            {
                                Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                                Id = "Bearer"
                            }
                        },
                        Array.Empty<string>()
                    }
                });
            })
            .AddCorsPolicy(builder.Configuration)
            .AddControllers()
            .ConfigureApplicationPartManager(manager =>
            {
                // Add custom feature provider to discover internal controllers
                manager.FeatureProviders.Add(new Extensions.InternalControllerFeatureProvider());
            })
            .AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            });
        builder.Services.AddHealthChecks();

        // Configure middleware and endpoints
        WebApplication app = builder.Build();
        app.UseDefaultFiles();
        app.UseStaticFiles();
        app.UseCors();
        app.UseAuthentication();
        app.UseAuthorization();

        // Only use rate limiter if it's enabled (services registered)
        var rateLimitingOptions = builder.Configuration.GetSection("RateLimiting").Get<Options.RateLimitingOptions>();
        if (rateLimitingOptions?.Enabled == true)
        {
            app.UseRateLimiter(); // Rate limiting after auth so we can identify users
        }

        app.UseMiddleware<MaintenanceMiddleware>();
        app.MapControllers()
            .RequireAuthorization();
        app.MapHealthChecks("/healthz");

        // Add Chat Copilot hub for real time communication
        app.MapHub<MessageRelayHub>("/messageRelayHub");

        // Handle CORS preflight requests for root
        app.MapMethods("/", new[] { "OPTIONS" }, () => Results.Ok())
            .AllowAnonymous();

        // Fallback: If no static files (index.html) exist, show API status
        // This allows the frontend to be served when deployed, but shows status when running backend-only
        app.MapFallback(context =>
        {
            // If the request is for an API endpoint or has an extension, return 404
            if (context.Request.Path.StartsWithSegments("/api") ||
                Path.HasExtension(context.Request.Path.Value))
            {
                context.Response.StatusCode = 404;
                return Task.CompletedTask;
            }

            // For SPA routing - serve index.html if it exists
            var indexPath = Path.Combine(app.Environment.WebRootPath ?? "wwwroot", "index.html");
            if (File.Exists(indexPath))
            {
                context.Request.Path = "/index.html";
                return context.Response.SendFileAsync(indexPath);
            }

            // No frontend deployed - show API status
            return context.Response.WriteAsync("Mimir API is running. Frontend not deployed.");
        });

        // Enable Swagger for all environments with authorization
        // In development: open access
        // In production: requires authentication and specific Azure AD group/user membership
        var swaggerAuthorizedGroups = builder.Configuration.GetSection("Swagger:AuthorizedGroups").Get<string[]>() ?? Array.Empty<string>();
        var swaggerAuthorizedUsers = builder.Configuration.GetSection("Swagger:AuthorizedUsers").Get<string[]>() ?? Array.Empty<string>();
        var swaggerEnabled = builder.Configuration.GetValue<bool>("Swagger:Enabled", true);
        var hasSwaggerRestrictions = swaggerAuthorizedGroups.Length > 0 || swaggerAuthorizedUsers.Length > 0;

        if (swaggerEnabled)
        {
            // Middleware to protect Swagger endpoints in non-development environments
            if (!app.Environment.IsDevelopment() && hasSwaggerRestrictions)
            {
                app.UseWhen(
                    context => context.Request.Path.StartsWithSegments("/swagger"),
                    appBuilder =>
                    {
                        appBuilder.Use(async (context, next) =>
                        {
                            // Check if user is authenticated
                            if (!context.User.Identity?.IsAuthenticated ?? true)
                            {
                                context.Response.StatusCode = 401;
                                await context.Response.WriteAsync("Unauthorized: Authentication required for Swagger access.");
                                return;
                            }

                            // Check if user's Object ID is in the authorized users list
                            var userObjectId = context.User.Claims
                                .FirstOrDefault(c => c.Type == "oid" || c.Type == "http://schemas.microsoft.com/identity/claims/objectidentifier")
                                ?.Value;

                            var isUserAuthorized = userObjectId != null &&
                                swaggerAuthorizedUsers.Contains(userObjectId, StringComparer.OrdinalIgnoreCase);

                            // Check if user is in any of the authorized groups
                            var userGroups = context.User.Claims
                                .Where(c => c.Type == "groups" || c.Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups")
                                .Select(c => c.Value)
                                .ToList();

                            var isGroupAuthorized = swaggerAuthorizedGroups.Any(authorizedGroup =>
                                userGroups.Contains(authorizedGroup, StringComparer.OrdinalIgnoreCase));

                            if (!isUserAuthorized && !isGroupAuthorized)
                            {
                                context.Response.StatusCode = 403;
                                await context.Response.WriteAsync("Forbidden: You do not have permission to access Swagger. Contact your administrator.");
                                return;
                            }

                            await next();
                        });
                    });
            }

            app.UseSwagger();
            app.UseSwaggerUI(options =>
            {
                options.SwaggerEndpoint("/swagger/v1/swagger.json", "Mimir API v1");
            });
        }

        if (app.Environment.IsDevelopment())
        {
            // Redirect root URL to Swagger UI URL in development
            app.MapWhen(
                context => context.Request.Path == "/",
                appBuilder =>
                    appBuilder.Run(
                        async context => await Task.Run(() => context.Response.Redirect("/swagger"))));
        }

        // Start the service
        Task runTask = app.RunAsync();

        // Log the health probe URL for users to validate the service is running.
        try
        {
            string? address = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()?.Addresses.FirstOrDefault();
            app.Services.GetRequiredService<ILogger>().LogInformation("Health probe: {0}/healthz", address);
        }
        catch (ObjectDisposedException)
        {
            // We likely failed startup which disposes 'app.Services' - don't attempt to display the health probe URL.
        }

        // Wait for the service to complete.
        await runTask;
    }
}
