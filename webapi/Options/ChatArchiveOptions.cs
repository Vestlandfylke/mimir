// Copyright (c) Microsoft. All rights reserved.

namespace CopilotChat.WebApi.Options;

/// <summary>
/// Configuration settings for the chat archive system.
/// </summary>
internal sealed class ChatArchiveOptions
{
    public const string PropertyName = "ChatArchive";

    /// <summary>
    /// Gets or sets the number of days to retain archived chats before permanent deletion.
    /// Default is 180 days.
    /// </summary>
    public int RetentionDays { get; set; } = 180;

    /// <summary>
    /// Gets or sets the interval in hours between cleanup job runs.
    /// Default is 24 hours (once per day).
    /// </summary>
    public int CleanupIntervalHours { get; set; } = 24;

    /// <summary>
    /// Gets or sets whether the archive cleanup job is enabled.
    /// Default is true.
    /// </summary>
    public bool CleanupEnabled { get; set; } = true;
}
