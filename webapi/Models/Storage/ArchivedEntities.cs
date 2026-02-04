// Copyright (c) Microsoft. All rights reserved.

using System.Text.Json.Serialization;
using CopilotChat.WebApi.Storage;

namespace CopilotChat.WebApi.Models.Storage;

/// <summary>
/// Base class for archived entities with common deletion metadata.
/// </summary>
internal abstract class ArchivedEntityBase
{
    /// <summary>
    /// When the entity was deleted/archived.
    /// </summary>
    public DateTimeOffset DeletedAt { get; set; }

    /// <summary>
    /// User ID of who deleted the entity.
    /// </summary>
    public string DeletedBy { get; set; } = string.Empty;

    /// <summary>
    /// Original chat ID before archiving.
    /// </summary>
    public string OriginalChatId { get; set; } = string.Empty;
}

/// <summary>
/// An archived chat session with deletion metadata.
/// </summary>
internal sealed class ArchivedChatSession : ArchivedEntityBase, IStorageEntity
{
    /// <summary>
    /// Archive ID that is persistent and unique.
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Title of the chat.
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Timestamp of the chat creation.
    /// </summary>
    public DateTimeOffset CreatedOn { get; set; }

    /// <summary>
    /// System description of the chat that is used to generate responses.
    /// </summary>
    public string SystemDescription { get; set; } = string.Empty;

    /// <summary>
    /// The balance between long term memory and working term memory.
    /// </summary>
    public float MemoryBalance { get; set; } = 0.5F;

    /// <summary>
    /// A list of enabled plugins.
    /// </summary>
    public HashSet<string> EnabledPlugins { get; set; } = new();

    /// <summary>
    /// Used to determine if the current chat requires upgrade.
    /// </summary>
    public string? Version { get; set; }

    /// <summary>
    /// The chat template type.
    /// </summary>
    public string? Template { get; set; }

    /// <summary>
    /// The AI model ID to use for this chat session.
    /// </summary>
    public string? ModelId { get; set; }

    /// <summary>
    /// The partition key for the archived session.
    /// Partitioned by DeletedBy (user ID) for efficient user queries.
    /// </summary>
    [JsonIgnore]
    public string Partition => this.DeletedBy;

    /// <summary>
    /// Default constructor for serialization.
    /// </summary>
    public ArchivedChatSession() { }

    /// <summary>
    /// Create an archived chat session from an active chat session.
    /// </summary>
    public static ArchivedChatSession FromChatSession(ChatSession session, string deletedBy)
    {
        return new ArchivedChatSession
        {
            Id = Guid.NewGuid().ToString(),
            OriginalChatId = session.Id,
            Title = session.Title,
            CreatedOn = session.CreatedOn,
            SystemDescription = session.SystemDescription,
            MemoryBalance = session.MemoryBalance,
            EnabledPlugins = session.EnabledPlugins,
            Version = session.Version,
            Template = session.Template,
            ModelId = session.ModelId,
            DeletedAt = DateTimeOffset.UtcNow,
            DeletedBy = deletedBy
        };
    }

    /// <summary>
    /// Convert back to an active ChatSession for restoration.
    /// </summary>
    public ChatSession ToChatSession()
    {
        return new ChatSession(this.Title, this.SystemDescription)
        {
            Id = this.OriginalChatId, // Restore original ID
            CreatedOn = this.CreatedOn,
            MemoryBalance = this.MemoryBalance,
            EnabledPlugins = this.EnabledPlugins,
            Version = this.Version,
            Template = this.Template,
            ModelId = this.ModelId
        };
    }
}

/// <summary>
/// An archived chat message with deletion metadata.
/// </summary>
internal sealed class ArchivedChatMessage : ArchivedEntityBase, IStorageEntity
{
    /// <summary>
    /// Archive ID that is persistent and unique.
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Original message ID.
    /// </summary>
    public string OriginalMessageId { get; set; } = string.Empty;

    /// <summary>
    /// Timestamp of the message.
    /// </summary>
    public DateTimeOffset Timestamp { get; set; }

    /// <summary>
    /// Id of the user who sent this message.
    /// </summary>
    public string UserId { get; set; } = string.Empty;

    /// <summary>
    /// Name of the user who sent this message.
    /// </summary>
    public string UserName { get; set; } = string.Empty;

    /// <summary>
    /// Content of the message.
    /// </summary>
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Role of the author of the message.
    /// </summary>
    public CopilotChatMessage.AuthorRoles AuthorRole { get; set; }

    /// <summary>
    /// Prompt used to generate the message.
    /// </summary>
    public string Prompt { get; set; } = string.Empty;

    /// <summary>
    /// Citations of the message.
    /// </summary>
    public IEnumerable<CitationSource>? Citations { get; set; }

    /// <summary>
    /// Type of the message.
    /// </summary>
    public CopilotChatMessage.ChatMessageType Type { get; set; }

    /// <summary>
    /// Counts of total token usage.
    /// </summary>
    public IDictionary<string, int>? TokenUsage { get; set; }

    /// <summary>
    /// Reasoning/thinking content.
    /// </summary>
    public string? Reasoning { get; set; }

    /// <summary>
    /// The partition key - partitioned by OriginalChatId for efficient bulk operations.
    /// </summary>
    [JsonIgnore]
    public string Partition => this.OriginalChatId;

    /// <summary>
    /// Default constructor for serialization.
    /// </summary>
    public ArchivedChatMessage() { }

    /// <summary>
    /// Create an archived message from an active message.
    /// </summary>
    public static ArchivedChatMessage FromCopilotChatMessage(CopilotChatMessage message, string deletedBy)
    {
        return new ArchivedChatMessage
        {
            Id = Guid.NewGuid().ToString(),
            OriginalMessageId = message.Id,
            OriginalChatId = message.ChatId,
            Timestamp = message.Timestamp,
            UserId = message.UserId,
            UserName = message.UserName,
            Content = message.Content,
            AuthorRole = message.AuthorRole,
            Prompt = message.Prompt,
            Citations = message.Citations,
            Type = message.Type,
            TokenUsage = message.TokenUsage,
            Reasoning = message.Reasoning,
            DeletedAt = DateTimeOffset.UtcNow,
            DeletedBy = deletedBy
        };
    }

    /// <summary>
    /// Convert back to an active CopilotChatMessage for restoration.
    /// </summary>
    public CopilotChatMessage ToCopilotChatMessage()
    {
        return new CopilotChatMessage(
            this.UserId,
            this.UserName,
            this.OriginalChatId,
            this.Content,
            this.Prompt,
            this.Citations,
            this.AuthorRole,
            this.Type,
            this.TokenUsage,
            this.Reasoning)
        {
            Id = this.OriginalMessageId, // Restore original ID
            Timestamp = this.Timestamp
        };
    }
}

/// <summary>
/// An archived chat participant with deletion metadata.
/// </summary>
internal sealed class ArchivedChatParticipant : ArchivedEntityBase, IStorageEntity
{
    /// <summary>
    /// Archive ID that is persistent and unique.
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Original participant ID.
    /// </summary>
    public string OriginalParticipantId { get; set; } = string.Empty;

    /// <summary>
    /// User ID that is persistent and unique.
    /// </summary>
    public string UserId { get; set; } = string.Empty;

    /// <summary>
    /// The partition key - partitioned by OriginalChatId for efficient bulk operations.
    /// </summary>
    [JsonIgnore]
    public string Partition => this.OriginalChatId;

    /// <summary>
    /// Default constructor for serialization.
    /// </summary>
    public ArchivedChatParticipant() { }

    /// <summary>
    /// Create an archived participant from an active participant.
    /// </summary>
    public static ArchivedChatParticipant FromChatParticipant(ChatParticipant participant, string deletedBy)
    {
        return new ArchivedChatParticipant
        {
            Id = Guid.NewGuid().ToString(),
            OriginalParticipantId = participant.Id,
            OriginalChatId = participant.ChatId,
            UserId = participant.UserId,
            DeletedAt = DateTimeOffset.UtcNow,
            DeletedBy = deletedBy
        };
    }

    /// <summary>
    /// Convert back to an active ChatParticipant for restoration.
    /// </summary>
    public ChatParticipant ToChatParticipant()
    {
        return new ChatParticipant(this.UserId, this.OriginalChatId)
        {
            Id = this.OriginalParticipantId // Restore original ID
        };
    }
}

/// <summary>
/// An archived memory source with deletion metadata.
/// </summary>
internal sealed class ArchivedMemorySource : ArchivedEntityBase, IStorageEntity
{
    /// <summary>
    /// Archive ID that is persistent and unique.
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Original source ID.
    /// </summary>
    public string OriginalSourceId { get; set; } = string.Empty;

    /// <summary>
    /// The type of the source.
    /// </summary>
    public MemorySourceType SourceType { get; set; } = MemorySourceType.File;

    /// <summary>
    /// The name of the source.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// The external link to the source.
    /// </summary>
    public Uri? HyperLink { get; set; }

    /// <summary>
    /// The user ID of who shared the source.
    /// </summary>
    public string SharedBy { get; set; } = string.Empty;

    /// <summary>
    /// When the source was created.
    /// </summary>
    public DateTimeOffset CreatedOn { get; set; }

    /// <summary>
    /// The size of the source in bytes.
    /// </summary>
    public long Size { get; set; }

    /// <summary>
    /// The number of tokens in the source.
    /// </summary>
    public long Tokens { get; set; }

    /// <summary>
    /// Whether this document was pinned.
    /// </summary>
    public bool IsPinned { get; set; }

    /// <summary>
    /// The partition key - partitioned by OriginalChatId for efficient bulk operations.
    /// </summary>
    [JsonIgnore]
    public string Partition => this.OriginalChatId;

    /// <summary>
    /// Default constructor for serialization.
    /// </summary>
    public ArchivedMemorySource() { }

    /// <summary>
    /// Create an archived memory source from an active source.
    /// </summary>
    public static ArchivedMemorySource FromMemorySource(MemorySource source, string deletedBy)
    {
        return new ArchivedMemorySource
        {
            Id = Guid.NewGuid().ToString(),
            OriginalSourceId = source.Id,
            OriginalChatId = source.ChatId,
            SourceType = source.SourceType,
            Name = source.Name,
            HyperLink = source.HyperLink,
            SharedBy = source.SharedBy,
            CreatedOn = source.CreatedOn,
            Size = source.Size,
            Tokens = source.Tokens,
            IsPinned = source.IsPinned,
            DeletedAt = DateTimeOffset.UtcNow,
            DeletedBy = deletedBy
        };
    }

    /// <summary>
    /// Convert back to an active MemorySource for restoration.
    /// </summary>
    public MemorySource ToMemorySource()
    {
        return new MemorySource(this.OriginalChatId, this.Name, this.SharedBy, this.SourceType, this.Size, this.HyperLink)
        {
            Id = this.OriginalSourceId, // Restore original ID
            CreatedOn = this.CreatedOn,
            Tokens = this.Tokens,
            IsPinned = this.IsPinned
        };
    }
}
