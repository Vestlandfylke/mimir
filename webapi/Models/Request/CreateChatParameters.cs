// Copyright (c) Microsoft. All rights reserved.

using System.Text.Json.Serialization;

namespace CopilotChat.WebApi.Models.Request;

/// <summary>
/// Parameters for creating a new chat session.
/// </summary>
internal sealed class CreateChatParameters
{
    /// <summary>
    /// Title of the chat.
    /// </summary>
    [JsonPropertyName("title")]
    public string? Title { get; set; }

    /// <summary>
    /// Optional template type for specialized chat assistants (e.g., "klarsprak").
    /// If not provided, the default system description will be used.
    /// </summary>
    [JsonPropertyName("template")]
    public string? Template { get; set; }
}
