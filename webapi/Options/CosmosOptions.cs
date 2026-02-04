// Copyright (c) Microsoft. All rights reserved.

using System.ComponentModel.DataAnnotations;

namespace CopilotChat.WebApi.Options;

/// <summary>
/// Configuration settings for connecting to Azure CosmosDB.
/// </summary>
internal sealed class CosmosOptions
{
    /// <summary>
    /// Gets or sets the Cosmos database name.
    /// </summary>
    [Required, NotEmptyOrWhitespace]
    public string Database { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Cosmos connection string.
    /// </summary>
    [Required, NotEmptyOrWhitespace]
    public string ConnectionString { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Cosmos container for chat sessions.
    /// </summary>
    [Required, NotEmptyOrWhitespace]
    public string ChatSessionsContainer { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Cosmos container for chat messages.
    /// </summary>
    [Required, NotEmptyOrWhitespace]
    public string ChatMessagesContainer { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Cosmos container for chat memory sources.
    /// </summary>
    [Required, NotEmptyOrWhitespace]
    public string ChatMemorySourcesContainer { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Cosmos container for chat participants.
    /// </summary>
    [Required, NotEmptyOrWhitespace]
    public string ChatParticipantsContainer { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Cosmos container for generated files.
    /// </summary>
    [Required, NotEmptyOrWhitespace]
    public string GeneratedFilesContainer { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Cosmos container for archived chat sessions.
    /// </summary>
    public string ArchivedChatSessionsContainer { get; set; } = "archivedchatsessions";

    /// <summary>
    /// Gets or sets the Cosmos container for archived chat messages.
    /// </summary>
    public string ArchivedChatMessagesContainer { get; set; } = "archivedchatmessages";

    /// <summary>
    /// Gets or sets the Cosmos container for archived chat participants.
    /// </summary>
    public string ArchivedChatParticipantsContainer { get; set; } = "archivedchatparticipants";

    /// <summary>
    /// Gets or sets the Cosmos container for archived memory sources.
    /// </summary>
    public string ArchivedMemorySourcesContainer { get; set; } = "archivedmemorysources";
}
