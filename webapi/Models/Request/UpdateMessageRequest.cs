// Copyright (c) Microsoft. All rights reserved.

namespace CopilotChat.WebApi.Models.Request;

/// <summary>
/// Request parameters for updating a chat message.
/// </summary>
public class UpdateMessageRequest
{
    /// <summary>
    /// The updated content of the message.
    /// For plan messages, this contains the JSON with updated plan state.
    /// </summary>
    public string Content { get; set; } = string.Empty;
}

