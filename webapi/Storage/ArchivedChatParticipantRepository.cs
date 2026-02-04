// Copyright (c) Microsoft. All rights reserved.

using CopilotChat.WebApi.Models.Storage;

namespace CopilotChat.WebApi.Storage;

/// <summary>
/// A repository for archived chat participants.
/// </summary>
internal sealed class ArchivedChatParticipantRepository : Repository<ArchivedChatParticipant>
{
    /// <summary>
    /// Initializes a new instance of the ArchivedChatParticipantRepository class.
    /// </summary>
    /// <param name="storageContext">The storage context.</param>
    public ArchivedChatParticipantRepository(IStorageContext<ArchivedChatParticipant> storageContext)
        : base(storageContext)
    {
    }

    /// <summary>
    /// Finds archived participants by original chat ID.
    /// </summary>
    /// <param name="originalChatId">The original chat ID.</param>
    /// <returns>A list of archived participants for the chat.</returns>
    public Task<IEnumerable<ArchivedChatParticipant>> FindByOriginalChatIdAsync(string originalChatId)
    {
        return base.StorageContext.QueryEntitiesAsync(e => e.OriginalChatId == originalChatId);
    }

    /// <summary>
    /// Finds archived participants by user ID.
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <returns>A list of archived participants for the user.</returns>
    public Task<IEnumerable<ArchivedChatParticipant>> FindByUserIdAsync(string userId)
    {
        return base.StorageContext.QueryEntitiesAsync(e => e.UserId == userId);
    }

    /// <summary>
    /// Finds archived participants that have exceeded the retention period.
    /// </summary>
    /// <param name="retentionDays">The retention period in days.</param>
    /// <returns>A list of expired archived participants.</returns>
    public Task<IEnumerable<ArchivedChatParticipant>> FindExpiredAsync(int retentionDays)
    {
        var cutoffDate = DateTimeOffset.UtcNow.AddDays(-retentionDays);
        return base.StorageContext.QueryEntitiesAsync(e => e.DeletedAt < cutoffDate);
    }

    /// <summary>
    /// Deletes all archived participants for a specific original chat ID.
    /// </summary>
    /// <param name="originalChatId">The original chat ID.</param>
    /// <returns>The number of participants deleted.</returns>
    public async Task<int> DeleteByOriginalChatIdAsync(string originalChatId)
    {
        var participants = await this.FindByOriginalChatIdAsync(originalChatId);
        var count = 0;
        foreach (var participant in participants)
        {
            await base.StorageContext.DeleteAsync(participant);
            count++;
        }
        return count;
    }
}
