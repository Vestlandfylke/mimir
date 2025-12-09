// Copyright (c) Microsoft. All rights reserved.

namespace CopilotChat.WebApi.Options;

/// <summary>
/// Configuration options for the fast model used for quick tasks like intent extraction.
/// This allows using a smaller, faster model (e.g., gpt-4o-mini) for simple tasks
/// while reserving the main model (e.g., gpt-5) for generating responses.
/// </summary>
public class FastModelOptions
{
  public const string PropertyName = "FastModel";

  /// <summary>
  /// Whether to use a separate fast model for intent/audience extraction.
  /// If false, the main model will be used for all tasks.
  /// </summary>
  public bool Enabled { get; set; } = false;

  /// <summary>
  /// The Azure OpenAI deployment name for the fast model (e.g., "gpt-4o-mini").
  /// </summary>
  public string Deployment { get; set; } = string.Empty;

  /// <summary>
  /// The Azure OpenAI endpoint URL.
  /// If empty, uses the same endpoint as the main model.
  /// </summary>
  public string Endpoint { get; set; } = string.Empty;

  /// <summary>
  /// The API key for the Azure OpenAI service.
  /// If empty, uses the same API key as the main model.
  /// </summary>
  public string ApiKey { get; set; } = string.Empty;
}

