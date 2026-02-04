// Copyright (c) Microsoft. All rights reserved.

using CopilotChat.WebApi.Models.Storage;

namespace CopilotChat.WebApi.Storage;

/// <summary>
/// A repository for archived chat sessions.
/// </summary>
internal sealed class ArchivedChatSessionRepository : Repository<ArchivedChatSession>
{
    /// <summary>
    /// Initializes a new instance of the ArchivedChatSessionRepository class.
    /// </summary>
    /// <param name="storageContext">The storage context.</param>
    public ArchivedChatSessionRepository(IStorageContext<ArchivedChatSession> storageContext)
        : base(storageContext)
    {
    }

    /// <summary>
    /// Finds archived chat sessions deleted by a specific user.
    /// </summary>
    /// <param name="userId">The user ID who deleted the chats.</param>
    /// <returns>A list of archived chat sessions.</returns>
    public Task<IEnumerable<ArchivedChatSession>> FindByDeletedByAsync(string userId)
    {
        return base.StorageContext.QueryEntitiesAsync(e => e.DeletedBy == userId);
    }

    /// <summary>
    /// Finds an archived chat session by its original chat ID.
    /// </summary>
    /// <param name="originalChatId">The original chat ID.</param>
    /// <returns>The archived chat session if found.</returns>
    public async Task<ArchivedChatSession?> FindByOriginalChatIdAsync(string originalChatId)
    {
        var results = await base.StorageContext.QueryEntitiesAsync(e => e.OriginalChatId == originalChatId);
        return results.FirstOrDefault();
    }

    /// <summary>
    /// Finds archived chat sessions that have exceeded the retention period.
    /// </summary>
    /// <param name="retentionDays">The retention period in days.</param>
    /// <returns>A list of expired archived chat sessions.</returns>
    public Task<IEnumerable<ArchivedChatSession>> FindExpiredAsync(int retentionDays)
    {
        var cutoffDate = DateTimeOffset.UtcNow.AddDays(-retentionDays);
        return base.StorageContext.QueryEntitiesAsync(e => e.DeletedAt < cutoffDate);
    }

    /// <summary>
    /// Retrieves all archived chat sessions.
    /// </summary>
    /// <returns>A list of all archived chat sessions.</returns>
    public Task<IEnumerable<ArchivedChatSession>> GetAllAsync()
    {
        return base.StorageContext.QueryEntitiesAsync(e => true);
    }
}
