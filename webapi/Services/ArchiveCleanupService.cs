// Copyright (c) Microsoft. All rights reserved.

using CopilotChat.WebApi.Options;
using CopilotChat.WebApi.Storage;
using Microsoft.Extensions.Options;

namespace CopilotChat.WebApi.Services;

/// <summary>
/// Background service that periodically cleans up expired archived chats.
/// Archives older than the configured retention period are permanently deleted.
/// </summary>
internal sealed class ArchiveCleanupService : BackgroundService
{
    private readonly ILogger<ArchiveCleanupService> _logger;
    private readonly IServiceProvider _serviceProvider;
    private readonly ChatArchiveOptions _options;

    public ArchiveCleanupService(
        ILogger<ArchiveCleanupService> logger,
        IServiceProvider serviceProvider,
        IOptions<ChatArchiveOptions> options)
    {
        this._logger = logger;
        this._serviceProvider = serviceProvider;
        this._options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!this._options.CleanupEnabled)
        {
            this._logger.LogInformation("Archive cleanup service is disabled.");
            return;
        }

        this._logger.LogInformation(
            "Archive cleanup service started. Retention: {RetentionDays} days, Interval: {IntervalHours} hours",
            this._options.RetentionDays,
            this._options.CleanupIntervalHours);

        // Wait a bit before the first run to let the application fully start
        await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await this.CleanupExpiredArchivesAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                this._logger.LogError(ex, "Error during archive cleanup.");
            }

            // Wait for the configured interval before the next cleanup run
            await Task.Delay(TimeSpan.FromHours(this._options.CleanupIntervalHours), stoppingToken);
        }
    }

    /// <summary>
    /// Cleans up all archived chats that have exceeded the retention period.
    /// </summary>
    private async Task CleanupExpiredArchivesAsync(CancellationToken cancellationToken)
    {
        this._logger.LogInformation("Starting archive cleanup...");

        // Create a scope to resolve scoped services
        using var scope = this._serviceProvider.CreateScope();

        var sessionRepository = scope.ServiceProvider.GetRequiredService<ArchivedChatSessionRepository>();
        var messageRepository = scope.ServiceProvider.GetRequiredService<ArchivedChatMessageRepository>();
        var participantRepository = scope.ServiceProvider.GetRequiredService<ArchivedChatParticipantRepository>();
        var sourceRepository = scope.ServiceProvider.GetRequiredService<ArchivedMemorySourceRepository>();

        // Find all expired archived sessions
        var expiredSessions = await sessionRepository.FindExpiredAsync(this._options.RetentionDays);
        var expiredList = expiredSessions.ToList();

        if (expiredList.Count == 0)
        {
            this._logger.LogDebug("No expired archives found.");
            return;
        }

        this._logger.LogInformation("Found {Count} expired archived chats to clean up.", expiredList.Count);

        var deletedCount = 0;
        var failedCount = 0;

        foreach (var archivedSession in expiredList)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                break;
            }

            try
            {
                var chatId = archivedSession.OriginalChatId;

                // Delete all associated archived entities
                await messageRepository.DeleteByOriginalChatIdAsync(chatId);
                await participantRepository.DeleteByOriginalChatIdAsync(chatId);
                await sourceRepository.DeleteByOriginalChatIdAsync(chatId);

                // Delete the archived session itself
                await sessionRepository.DeleteAsync(archivedSession);

                deletedCount++;

                this._logger.LogDebug(
                    "Permanently deleted archived chat {ChatId} (deleted on {DeletedAt} by {DeletedBy})",
                    chatId,
                    archivedSession.DeletedAt,
                    archivedSession.DeletedBy);
            }
            catch (Exception ex)
            {
                failedCount++;
                this._logger.LogError(ex, "Failed to delete archived chat {ChatId}", archivedSession.OriginalChatId);
            }
        }

        this._logger.LogInformation(
            "Archive cleanup completed. Deleted: {DeletedCount}, Failed: {FailedCount}",
            deletedCount,
            failedCount);
    }
}
