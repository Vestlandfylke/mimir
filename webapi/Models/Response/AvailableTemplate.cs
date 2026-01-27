// Copyright (c) Microsoft. All rights reserved.

using System.Text.Json.Serialization;

namespace CopilotChat.WebApi.Models.Response;

/// <summary>
/// Represents a chat template available to the current user.
/// </summary>
internal sealed class AvailableTemplate
{
    /// <summary>
    /// The template identifier (key in config).
    /// </summary>
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Display name for the UI.
    /// </summary>
    [JsonPropertyName("displayName")]
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>
    /// Description of what this assistant does.
    /// </summary>
    [JsonPropertyName("description")]
    public string? Description { get; set; }

    /// <summary>
    /// Icon identifier for the template.
    /// </summary>
    [JsonPropertyName("icon")]
    public string? Icon { get; set; }
}
