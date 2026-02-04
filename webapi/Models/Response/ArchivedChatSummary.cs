// Copyright (c) Microsoft. All rights reserved.

namespace CopilotChat.WebApi.Models.Response;

/// <summary>
/// Summary of an archived chat session with counts for display in the trash view.
/// </summary>
public class ArchivedChatSummary
{
    /// <summary>
    /// Archive ID that is persistent and unique.
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Original chat ID before archiving.
    /// </summary>
    public string OriginalChatId { get; set; } = string.Empty;

    /// <summary>
    /// Title of the chat.
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// When the chat was originally created.
    /// </summary>
    public DateTimeOffset CreatedOn { get; set; }

    /// <summary>
    /// When the chat was deleted/archived.
    /// </summary>
    public DateTimeOffset DeletedAt { get; set; }

    /// <summary>
    /// User ID of who deleted the chat.
    /// </summary>
    public string DeletedBy { get; set; } = string.Empty;

    /// <summary>
    /// System description of the chat.
    /// </summary>
    public string SystemDescription { get; set; } = string.Empty;

    /// <summary>
    /// The balance between long-term and working memory.
    /// </summary>
    public float MemoryBalance { get; set; }

    /// <summary>
    /// Enabled plugins for this chat.
    /// </summary>
    public HashSet<string> EnabledPlugins { get; set; } = new();

    /// <summary>
    /// Version of the chat.
    /// </summary>
    public string? Version { get; set; }

    /// <summary>
    /// Template used for this chat.
    /// </summary>
    public string? Template { get; set; }

    /// <summary>
    /// Model ID used for this chat.
    /// </summary>
    public string? ModelId { get; set; }

    /// <summary>
    /// Number of messages in the archived chat.
    /// </summary>
    public int MessageCount { get; set; }

    /// <summary>
    /// Number of documents attached to the archived chat.
    /// </summary>
    public int DocumentCount { get; set; }

    /// <summary>
    /// Number of participants in the archived chat.
    /// </summary>
    public int ParticipantCount { get; set; }
}
