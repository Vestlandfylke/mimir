// Copyright (c) Microsoft. All rights reserved.

using CopilotChat.WebApi.Models.Storage;

namespace CopilotChat.WebApi.Storage;

/// <summary>
/// Repository for managing generated files.
/// </summary>
public class GeneratedFileRepository : Repository<GeneratedFile>
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
