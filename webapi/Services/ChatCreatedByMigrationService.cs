// Copyright (c) Microsoft. All rights reserved.

using CopilotChat.WebApi.Storage;

namespace CopilotChat.WebApi.Services;

/// <summary>
/// One-time migration service that sets the CreatedBy field on existing ChatSession records.
/// For each chat without a CreatedBy, it looks up the first participant (the creator)
/// and sets CreatedBy accordingly.
///
/// This service runs once at startup and can be safely removed after all environments
/// have been migrated.
/// </summary>
internal sealed class ChatCreatedByMigrationService : BackgroundService
{
    private readonly ILogger<ChatCreatedByMigrationService> _logger;
    private readonly IServiceProvider _serviceProvider;

    public ChatCreatedByMigrationService(
        ILogger<ChatCreatedByMigrationService> logger,
        IServiceProvider serviceProvider)
    {
        this._logger = logger;
        this._serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Wait a bit for the application to fully start before running migration
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        this._logger.LogInformation("ChatCreatedBy migration: Starting...");

        try
        {
            await this.MigrateAsync(stoppingToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            this._logger.LogError(ex, "ChatCreatedBy migration: Failed with error.");
        }
    }

    private async Task MigrateAsync(CancellationToken cancellationToken)
    {
        using var scope = this._serviceProvider.CreateScope();

        var chatSessionRepository = scope.ServiceProvider.GetRequiredService<ChatSessionRepository>();
        var chatParticipantRepository = scope.ServiceProvider.GetRequiredService<ChatParticipantRepository>();

        // Get all chat sessions
        var allSessions = await chatSessionRepository.GetAllChatsAsync();
        var sessionsToMigrate = allSessions.Where(s => string.IsNullOrEmpty(s.CreatedBy)).ToList();

        if (sessionsToMigrate.Count == 0)
        {
            this._logger.LogInformation("ChatCreatedBy migration: No sessions need migration. All done.");
            return;
        }

        this._logger.LogInformation(
            "ChatCreatedBy migration: Found {Count} session(s) without CreatedBy. Migrating...",
            sessionsToMigrate.Count);

        var migratedCount = 0;
        var failedCount = 0;

        foreach (var session in sessionsToMigrate)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                break;
            }

            try
            {
                // Find all participants for this chat
                var participants = await chatParticipantRepository.FindByChatIdAsync(session.Id);
                var participantList = participants.ToList();

                if (participantList.Count == 0)
                {
                    this._logger.LogWarning(
                        "ChatCreatedBy migration: Chat {ChatId} has no participants. Skipping.",
                        session.Id);
                    continue;
                }

                // The first participant is the creator (added when the chat was created).
                // Participants are stored by creation order, so the first one is the original creator.
                var creator = participantList.First();

                session.CreatedBy = creator.UserId;
                await chatSessionRepository.UpsertAsync(session);

                migratedCount++;

                this._logger.LogDebug(
                    "ChatCreatedBy migration: Set CreatedBy={UserId} on chat {ChatId} ({Title})",
                    creator.UserId,
                    session.Id,
                    session.Title);
            }
            catch (Exception ex)
            {
                failedCount++;
                this._logger.LogError(
                    ex,
                    "ChatCreatedBy migration: Failed to migrate chat {ChatId}",
                    session.Id);
            }
        }

        this._logger.LogInformation(
            "ChatCreatedBy migration: Completed. Migrated: {MigratedCount}, Failed: {FailedCount}, Skipped: {SkippedCount}",
            migratedCount,
            failedCount,
            sessionsToMigrate.Count - migratedCount - failedCount);
    }
}
