// Copyright (c) Microsoft. All rights reserved.

using System.Text.Json;
using CopilotChat.WebApi.Models.Response;
using CopilotChat.WebApi.Options;
using Microsoft.Extensions.Options;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.AzureOpenAI;
using Microsoft.SemanticKernel.Connectors.OpenAI;

namespace CopilotChat.WebApi.Services;

/// <summary>
/// Service for handling MCP tool plan approval workflow.
/// </summary>
public class McpPlanService
{
  private readonly ILogger<McpPlanService> _logger;
  private readonly McpServerOptions _mcpOptions;

  public McpPlanService(
      ILogger<McpPlanService> logger,
      IOptions<McpServerOptions> mcpOptions)
  {
    this._logger = logger;
    this._mcpOptions = mcpOptions.Value;
  }

  /// <summary>
  /// Gets the current plan approval mode.
  /// </summary>
  public PlanApprovalMode ApprovalMode => this._mcpOptions.PlanApprovalMode;

  /// <summary>
  /// Gets the list of MCP server names that require approval based on current mode.
  /// </summary>
  public IReadOnlyList<string> GetServersRequiringApproval()
  {
    return this._mcpOptions.PlanApprovalMode switch
    {
      PlanApprovalMode.Auto => new List<string>(),
      PlanApprovalMode.RequireApproval => this._mcpOptions.Servers
          .Where(s => s.Enabled)
          .Select(s => s.Name)
          .ToList(),
      PlanApprovalMode.PerServer => this._mcpOptions.Servers
          .Where(s => s.Enabled && s.RequireApproval)
          .Select(s => s.Name)
          .ToList(),
      _ => new List<string>()
    };
  }

  /// <summary>
  /// Checks if any MCP tool requires approval based on current settings.
  /// </summary>
  public bool AnyServerRequiresApproval()
  {
    return this._mcpOptions.AnyToolRequiresApproval();
  }

  /// <summary>
  /// Checks if a specific plugin requires approval based on global and per-server settings.
  /// </summary>
  /// <param name="pluginName">The plugin name to check.</param>
  /// <returns>True if the plugin requires approval.</returns>
  public bool RequiresApproval(string pluginName)
  {
    return this._mcpOptions.IsApprovalRequired(pluginName);
  }

  /// <summary>
  /// Creates a ProposedMcpPlan from function call content.
  /// </summary>
  /// <param name="kernel">The Semantic Kernel instance.</param>
  /// <param name="functionCalls">The function calls proposed by the LLM.</param>
  /// <param name="userInput">The original user input.</param>
  /// <param name="userIntent">The extracted user intent.</param>
  /// <returns>A ProposedMcpPlan ready for user approval.</returns>
  public ProposedMcpPlan CreateProposedPlan(
      Kernel kernel,
      IEnumerable<FunctionCallContent> functionCalls,
      string userInput,
      string? userIntent = null)
  {
    var steps = new List<McpPlanStep>();
    var index = 0;

    foreach (var functionCall in functionCalls)
    {
      var step = this.CreatePlanStep(kernel, functionCall, index++);
      steps.Add(step);
    }

    var planDescription = steps.Count == 1
        ? $"Utfør {steps[0].SkillName}.{steps[0].Name}"
        : $"Utfør {steps.Count} verktøy for å fullføre førespurnaden";

    return new ProposedMcpPlan
    {
      ProposedPlan = new McpPlan
      {
        Name = "McpToolPlan",
        SkillName = "MCP",
        Description = planDescription,
        Steps = steps,
        HasNextStep = steps.Count > 0,
        NextStepIndex = 0
      },
      Type = steps.Count > 1 ? PlanType.Sequential : PlanType.Action,
      State = PlanState.PlanApprovalRequired,
      OriginalUserInput = userInput,
      UserIntent = userIntent ?? userInput
    };
  }

  /// <summary>
  /// Creates a plan step from a function call.
  /// </summary>
  private McpPlanStep CreatePlanStep(Kernel kernel, FunctionCallContent functionCall, int index)
  {
    var parameters = new List<PlanInput>();

    if (functionCall.Arguments != null)
    {
      foreach (var arg in functionCall.Arguments)
      {
        var value = arg.Value?.ToString() ?? string.Empty;
        parameters.Add(new PlanInput
        {
          Key = arg.Key,
          Value = value
        });
      }
    }

    // Try to get the function description from the kernel
    var description = string.Empty;
    if (kernel.Plugins.TryGetFunction(functionCall.PluginName, functionCall.FunctionName, out var function))
    {
      description = function.Description;
    }

    return new McpPlanStep
    {
      Index = index,
      Name = functionCall.FunctionName ?? "Unknown",
      SkillName = functionCall.PluginName ?? "Unknown",
      Description = description,
      Parameters = parameters,
      Outputs = new List<string> { $"result_{index}" },
      IsSemantic = false,
      IsSensitive = true // MCP tools are considered sensitive
    };
  }

  /// <summary>
  /// Executes an approved MCP plan.
  /// </summary>
  /// <param name="kernel">The Semantic Kernel instance.</param>
  /// <param name="plan">The approved plan to execute.</param>
  /// <param name="cancellationToken">Cancellation token.</param>
  /// <returns>Results from executing each step.</returns>
  public async Task<List<FunctionResult>> ExecuteApprovedPlanAsync(
      Kernel kernel,
      McpPlan plan,
      CancellationToken cancellationToken = default)
  {
    var results = new List<FunctionResult>();

    foreach (var step in plan.Steps)
    {
      try
      {
        this._logger.LogInformation(
            "Executing approved MCP tool: {Plugin}.{Function}",
            step.SkillName,
            step.Name);

        if (!kernel.Plugins.TryGetFunction(step.SkillName, step.Name, out var function))
        {
          this._logger.LogWarning(
              "Function {Plugin}.{Function} not found in kernel",
              step.SkillName,
              step.Name);
          continue;
        }

        // Build arguments from step parameters
        var arguments = new KernelArguments();
        foreach (var param in step.Parameters)
        {
          arguments[param.Key] = param.Value;
        }

        var result = await function.InvokeAsync(kernel, arguments, cancellationToken);
        results.Add(result);

        this._logger.LogInformation(
            "MCP tool {Plugin}.{Function} executed successfully",
            step.SkillName,
            step.Name);
      }
      catch (Exception ex)
      {
        this._logger.LogError(ex,
            "Error executing MCP tool {Plugin}.{Function}",
            step.SkillName,
            step.Name);
        throw;
      }
    }

    return results;
  }

  /// <summary>
  /// Creates execution settings that don't auto-invoke functions (for plan generation).
  /// </summary>
  public static AzureOpenAIPromptExecutionSettings CreatePlanGenerationSettings(
      int maxTokens,
      double temperature = 1.0,
      double topP = 1.0,
      double frequencyPenalty = 0.5,
      double presencePenalty = 0.5)
  {
    return new AzureOpenAIPromptExecutionSettings
    {
#pragma warning disable SKEXP0010 // Experimental flag required for GPT-5.x max_completion_tokens support
      SetNewMaxCompletionTokensEnabled = true,
#pragma warning restore SKEXP0010
      MaxTokens = maxTokens,
      // GPT-5.x currently only supports default temperature (1.0). Avoid non-default values.
      Temperature = 1.0,
      TopP = topP,
      // GPT-5.x does not support presence_penalty/frequency_penalty. Avoid sending these parameters.
      // Don't auto-invoke - we want to intercept and show to user
      ToolCallBehavior = ToolCallBehavior.EnableKernelFunctions
    };
  }

  /// <summary>
  /// Creates execution settings that auto-invoke functions (for approved plan execution).
  /// </summary>
  public static AzureOpenAIPromptExecutionSettings CreateAutoInvokeSettings(
      int maxTokens,
      double temperature = 1.0,
      double topP = 1.0,
      double frequencyPenalty = 0.5,
      double presencePenalty = 0.5)
  {
    return new AzureOpenAIPromptExecutionSettings
    {
#pragma warning disable SKEXP0010 // Experimental flag required for GPT-5.x max_completion_tokens support
      SetNewMaxCompletionTokensEnabled = true,
#pragma warning restore SKEXP0010
      MaxTokens = maxTokens,
      // GPT-5.x currently only supports default temperature (1.0). Avoid non-default values.
      Temperature = 1.0,
      TopP = topP,
      // GPT-5.x does not support presence_penalty/frequency_penalty. Avoid sending these parameters.
      ToolCallBehavior = ToolCallBehavior.AutoInvokeKernelFunctions
    };
  }
}

