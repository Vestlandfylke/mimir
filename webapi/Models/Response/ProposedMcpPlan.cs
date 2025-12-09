// Copyright (c) Microsoft. All rights reserved.

using System.Text.Json.Serialization;

namespace CopilotChat.WebApi.Models.Response;

/// <summary>
/// Represents a proposed plan for MCP tool execution that requires user approval.
/// </summary>
public class ProposedMcpPlan
{
  /// <summary>
  /// The proposed plan containing steps to execute.
  /// </summary>
  [JsonPropertyName("proposedPlan")]
  public McpPlan ProposedPlan { get; set; } = new();

  /// <summary>
  /// Type of plan (Action = single-step, Sequential = multi-step).
  /// </summary>
  [JsonPropertyName("type")]
  public PlanType Type { get; set; } = PlanType.Action;

  /// <summary>
  /// State of the plan.
  /// </summary>
  [JsonPropertyName("state")]
  public PlanState State { get; set; } = PlanState.PlanApprovalRequired;

  /// <summary>
  /// Original user input that prompted the plan.
  /// </summary>
  [JsonPropertyName("originalUserInput")]
  public string? OriginalUserInput { get; set; }

  /// <summary>
  /// User intent extracted from the conversation.
  /// </summary>
  [JsonPropertyName("userIntent")]
  public string? UserIntent { get; set; }

  /// <summary>
  /// ID of the bot message containing this plan.
  /// </summary>
  [JsonPropertyName("generatedPlanMessageId")]
  public string? GeneratedPlanMessageId { get; set; }
}

/// <summary>
/// Represents an MCP plan with steps to execute.
/// </summary>
public class McpPlan
{
  /// <summary>
  /// State variables for the plan.
  /// </summary>
  [JsonPropertyName("state")]
  public List<PlanInput> State { get; set; } = new();

  /// <summary>
  /// Steps of the plan (tool calls to execute).
  /// </summary>
  [JsonPropertyName("steps")]
  public List<McpPlanStep> Steps { get; set; } = new();

  /// <summary>
  /// Parameters for the plan.
  /// </summary>
  [JsonPropertyName("parameters")]
  public List<PlanInput> Parameters { get; set; } = new();

  /// <summary>
  /// Outputs from the plan.
  /// </summary>
  [JsonPropertyName("outputs")]
  public List<string> Outputs { get; set; } = new();

  /// <summary>
  /// Whether the plan has more steps to execute.
  /// </summary>
  [JsonPropertyName("hasNextStep")]
  public bool HasNextStep { get; set; }

  /// <summary>
  /// Index of the next step to execute.
  /// </summary>
  [JsonPropertyName("nextStepIndex")]
  public int NextStepIndex { get; set; }

  /// <summary>
  /// Name of the plan.
  /// </summary>
  [JsonPropertyName("name")]
  public string Name { get; set; } = string.Empty;

  /// <summary>
  /// Skill/plugin name.
  /// </summary>
  [JsonPropertyName("skill_name")]
  public string SkillName { get; set; } = string.Empty;

  /// <summary>
  /// Description of what the plan does.
  /// </summary>
  [JsonPropertyName("description")]
  public string Description { get; set; } = string.Empty;

  /// <summary>
  /// Whether this is a semantic function.
  /// </summary>
  [JsonPropertyName("isSemantic")]
  public bool IsSemantic { get; set; }

  /// <summary>
  /// Whether this plan contains sensitive operations.
  /// </summary>
  [JsonPropertyName("isSensitive")]
  public bool IsSensitive { get; set; }
}

/// <summary>
/// Represents a single step in an MCP plan (a tool call).
/// </summary>
public class McpPlanStep
{
  /// <summary>
  /// State variables for this step.
  /// </summary>
  [JsonPropertyName("state")]
  public List<PlanInput> State { get; set; } = new();

  /// <summary>
  /// Nested steps (empty for leaf steps).
  /// </summary>
  [JsonPropertyName("steps")]
  public List<McpPlanStep> Steps { get; set; } = new();

  /// <summary>
  /// Input parameters for this step.
  /// </summary>
  [JsonPropertyName("parameters")]
  public List<PlanInput> Parameters { get; set; } = new();

  /// <summary>
  /// Output variable names from this step.
  /// </summary>
  [JsonPropertyName("outputs")]
  public List<string> Outputs { get; set; } = new();

  /// <summary>
  /// Whether there are more nested steps.
  /// </summary>
  [JsonPropertyName("hasNextStep")]
  public bool HasNextStep { get; set; }

  /// <summary>
  /// Next step index.
  /// </summary>
  [JsonPropertyName("nextStepIndex")]
  public int NextStepIndex { get; set; }

  /// <summary>
  /// Tool/function name.
  /// </summary>
  [JsonPropertyName("name")]
  public string Name { get; set; } = string.Empty;

  /// <summary>
  /// Plugin/skill name (MCP server name).
  /// </summary>
  [JsonPropertyName("skill_name")]
  public string SkillName { get; set; } = string.Empty;

  /// <summary>
  /// Description of what this step does.
  /// </summary>
  [JsonPropertyName("description")]
  public string Description { get; set; } = string.Empty;

  /// <summary>
  /// Whether this is a semantic function.
  /// </summary>
  [JsonPropertyName("isSemantic")]
  public bool IsSemantic { get; set; }

  /// <summary>
  /// Whether this step is sensitive.
  /// </summary>
  [JsonPropertyName("isSensitive")]
  public bool IsSensitive { get; set; }

  /// <summary>
  /// Step index in the plan.
  /// </summary>
  [JsonPropertyName("index")]
  public int Index { get; set; }
}

/// <summary>
/// Key-value pair for plan inputs/parameters.
/// </summary>
public class PlanInput
{
  /// <summary>
  /// Parameter name.
  /// </summary>
  [JsonPropertyName("Key")]
  public string Key { get; set; } = string.Empty;

  /// <summary>
  /// Parameter value.
  /// </summary>
  [JsonPropertyName("Value")]
  public string Value { get; set; } = string.Empty;
}

/// <summary>
/// Plan type enumeration.
/// </summary>
public enum PlanType
{
  /// <summary>Single-step plan (one tool call).</summary>
  Action = 0,
  /// <summary>Multi-step plan (multiple tool calls in sequence).</summary>
  Sequential = 1,
  /// <summary>MRKL-style planning.</summary>
  Stepwise = 2
}

/// <summary>
/// Plan state enumeration.
/// </summary>
public enum PlanState
{
  /// <summary>No operation needed.</summary>
  NoOp = 0,
  /// <summary>Plan was approved by user.</summary>
  Approved = 1,
  /// <summary>Plan was rejected by user.</summary>
  Rejected = 2,
  /// <summary>Plan was derived from another plan.</summary>
  Derived = 3,
  /// <summary>Plan requires user approval before execution.</summary>
  PlanApprovalRequired = 4,
  /// <summary>Plan approval is disabled.</summary>
  Disabled = 5
}

