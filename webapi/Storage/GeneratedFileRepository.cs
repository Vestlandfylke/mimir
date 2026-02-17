// Copyright (c) Microsoft. All rights reserved.

using CopilotChat.WebApi.Models.Storage;

namespace CopilotChat.WebApi.Storage;

/// <summary>
/// Repository for managing generated files.
/// </summary>
internal sealed class GeneratedFileRepository : Repository<GeneratedFile>
{
    /// <summary>
    /// Initializes a new instance of the GeneratedFileRepository class.
    /// </summary>
    public GeneratedFileRepository(IStorageContext<GeneratedFile> storageContext)
        : base(storageContext)
    {
    }

    /// <summary>
    /// Finds all generated files for a specific chat.
    /// </summary>
    /// <param name="chatId">The chat ID</param>
    /// <returns>List of generated files</returns>
    public Task<IEnumerable<GeneratedFile>> FindByChatIdAsync(string chatId)
    {
        return base.StorageContext.QueryEntitiesAsync(e => e.ChatId == chatId);
    }

    /// <summary>
    /// Finds all generated files for a specific user across all chats.
    /// This is a cross-partition query (UserId is not the partition key),
    /// but is acceptable for an infrequent user-triggered action.
    /// </summary>
    /// <param name="userId">The user ID</param>
    /// <returns>List of generated files belonging to the user</returns>
    public Task<IEnumerable<GeneratedFile>> FindByUserIdAsync(string userId)
    {
        return base.StorageContext.QueryEntitiesAsync(e => e.UserId == userId);
    }

    /// <summary>
    /// Finds a generated file by its ID across all partitions.
    /// This is a cross-partition query and should only be used as a fallback
    /// when the chatId (partition key) is not known.
    /// </summary>
    /// <param name="fileId">The file ID</param>
    /// <returns>The file if found, null otherwise</returns>
    public async Task<GeneratedFile?> FindByFileIdAcrossPartitionsAsync(string fileId)
    {
        var results = await base.StorageContext.QueryEntitiesAsync(e => e.Id == fileId);
        return results.FirstOrDefault();
    }

    /// <summary>
    /// Deletes expired files older than the specified date.
    /// </summary>
    /// <param name="expirationDate">The expiration date</param>
    public async Task DeleteExpiredFilesAsync(DateTimeOffset expirationDate)
    {
        var expiredFiles = await base.StorageContext.QueryEntitiesAsync(
            e => e.ExpiresOn.HasValue && e.ExpiresOn.Value < expirationDate);

        foreach (var file in expiredFiles)
        {
            await base.DeleteAsync(file);
        }
    }
}
