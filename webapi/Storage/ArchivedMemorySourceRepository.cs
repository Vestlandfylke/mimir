// Copyright (c) Microsoft. All rights reserved.

using CopilotChat.WebApi.Models.Storage;

namespace CopilotChat.WebApi.Storage;

/// <summary>
/// A repository for archived memory sources.
/// </summary>
internal sealed class ArchivedMemorySourceRepository : Repository<ArchivedMemorySource>
{
    /// <summary>
    /// Initializes a new instance of the ArchivedMemorySourceRepository class.
    /// </summary>
    /// <param name="storageContext">The storage context.</param>
    public ArchivedMemorySourceRepository(IStorageContext<ArchivedMemorySource> storageContext)
        : base(storageContext)
    {
    }

    /// <summary>
    /// Finds archived memory sources by original chat ID.
    /// </summary>
    /// <param name="originalChatId">The original chat ID.</param>
    /// <returns>A list of archived memory sources for the chat.</returns>
    public Task<IEnumerable<ArchivedMemorySource>> FindByOriginalChatIdAsync(string originalChatId)
    {
        return base.StorageContext.QueryEntitiesAsync(e => e.OriginalChatId == originalChatId);
    }

    /// <summary>
    /// Finds archived memory sources that have exceeded the retention period.
    /// </summary>
    /// <param name="retentionDays">The retention period in days.</param>
    /// <returns>A list of expired archived memory sources.</returns>
    public Task<IEnumerable<ArchivedMemorySource>> FindExpiredAsync(int retentionDays)
    {
        var cutoffDate = DateTimeOffset.UtcNow.AddDays(-retentionDays);
        return base.StorageContext.QueryEntitiesAsync(e => e.DeletedAt < cutoffDate);
    }

    /// <summary>
    /// Deletes all archived memory sources for a specific original chat ID.
    /// </summary>
    /// <param name="originalChatId">The original chat ID.</param>
    /// <returns>The number of sources deleted.</returns>
    public async Task<int> DeleteByOriginalChatIdAsync(string originalChatId)
    {
        var sources = await this.FindByOriginalChatIdAsync(originalChatId);
        var count = 0;
        foreach (var source in sources)
        {
            await base.StorageContext.DeleteAsync(source);
            count++;
        }
        return count;
    }
}
