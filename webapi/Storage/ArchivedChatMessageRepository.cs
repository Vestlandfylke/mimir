// Copyright (c) Microsoft. All rights reserved.

using CopilotChat.WebApi.Models.Storage;

namespace CopilotChat.WebApi.Storage;

/// <summary>
/// A repository for archived chat messages.
/// </summary>
internal sealed class ArchivedChatMessageRepository : Repository<ArchivedChatMessage>
{
    /// <summary>
    /// Initializes a new instance of the ArchivedChatMessageRepository class.
    /// </summary>
    /// <param name="storageContext">The storage context.</param>
    public ArchivedChatMessageRepository(IStorageContext<ArchivedChatMessage> storageContext)
        : base(storageContext)
    {
    }

    /// <summary>
    /// Finds archived messages by original chat ID.
    /// </summary>
    /// <param name="originalChatId">The original chat ID.</param>
    /// <returns>A list of archived messages for the chat.</returns>
    public Task<IEnumerable<ArchivedChatMessage>> FindByOriginalChatIdAsync(string originalChatId)
    {
        return base.StorageContext.QueryEntitiesAsync(e => e.OriginalChatId == originalChatId);
    }

    /// <summary>
    /// Finds archived messages that have exceeded the retention period.
    /// </summary>
    /// <param name="retentionDays">The retention period in days.</param>
    /// <returns>A list of expired archived messages.</returns>
    public Task<IEnumerable<ArchivedChatMessage>> FindExpiredAsync(int retentionDays)
    {
        var cutoffDate = DateTimeOffset.UtcNow.AddDays(-retentionDays);
        return base.StorageContext.QueryEntitiesAsync(e => e.DeletedAt < cutoffDate);
    }

    /// <summary>
    /// Deletes all archived messages for a specific original chat ID.
    /// </summary>
    /// <param name="originalChatId">The original chat ID.</param>
    /// <returns>The number of messages deleted.</returns>
    public async Task<int> DeleteByOriginalChatIdAsync(string originalChatId)
    {
        var messages = await this.FindByOriginalChatIdAsync(originalChatId);
        var count = 0;
        foreach (var message in messages)
        {
            await base.StorageContext.DeleteAsync(message);
            count++;
        }
        return count;
    }
}
