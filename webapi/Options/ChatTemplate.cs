// Copyright (c) Microsoft. All rights reserved.

using System.ComponentModel.DataAnnotations;
using CopilotChat.WebApi.Models.Request;

namespace CopilotChat.WebApi.Options;

/// <summary>
/// Configuration for a specialized chat template.
/// </summary>
public class ChatTemplate
{
  /// <summary>
  /// System description for this template.
  /// </summary>
  [Required, NotEmptyOrWhitespace]
  public string SystemDescription { get; set; } = string.Empty;

  /// <summary>
  /// Initial bot message for this template.
  /// </summary>
  [Required, NotEmptyOrWhitespace]
  public string InitialBotMessage { get; set; } = string.Empty;
}

