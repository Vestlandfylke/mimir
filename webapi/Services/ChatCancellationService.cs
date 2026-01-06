// Copyright (c) Microsoft. All rights reserved.

using System.Collections.Concurrent;

namespace CopilotChat.WebApi.Services;

/// <summary>
/// Service for managing chat request cancellation tokens.
/// Allows cancellation of in-progress LLM requests.
/// </summary>
public class ChatCancellationService
{
    private readonly ConcurrentDictionary<string, CancellationTokenSource> _activeCancellations = new();
    private readonly ILogger<ChatCancellationService> _logger;

    public ChatCancellationService(ILogger<ChatCancellationService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Register a new cancellation token for a chat request.
    /// If there's already an active request for this chat, it will be cancelled first.
    /// </summary>
    /// <param name="chatId">The chat ID</param>
    /// <param name="timeoutSeconds">Optional timeout in seconds</param>
    /// <returns>CancellationToken to use for the request</returns>
    public CancellationToken RegisterRequest(string chatId, int? timeoutSeconds = null)
    {
        // Cancel any existing request for this chat
        CancelRequest(chatId);

        var cts = timeoutSeconds.HasValue
            ? new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds.Value))
            : new CancellationTokenSource();

        _activeCancellations[chatId] = cts;
        _logger.LogDebug("Registered cancellation token for chat {ChatId}", chatId);

        return cts.Token;
    }

    /// <summary>
    /// Cancel an active request for a chat.
    /// </summary>
    /// <param name="chatId">The chat ID</param>
    /// <returns>True if a request was cancelled, false if no active request</returns>
    public bool CancelRequest(string chatId)
    {
        if (_activeCancellations.TryRemove(chatId, out var cts))
        {
            try
            {
                if (!cts.IsCancellationRequested)
                {
                    cts.Cancel();
                    _logger.LogInformation("Cancelled active request for chat {ChatId}", chatId);
                }
                cts.Dispose();
                return true;
            }
            catch (ObjectDisposedException)
            {
                // Token was already disposed, that's fine
                return false;
            }
        }
        return false;
    }

    /// <summary>
    /// Complete a request (remove it from active tracking).
    /// Should be called when a request completes normally.
    /// </summary>
    /// <param name="chatId">The chat ID</param>
    public void CompleteRequest(string chatId)
    {
        if (_activeCancellations.TryRemove(chatId, out var cts))
        {
            try
            {
                cts.Dispose();
                _logger.LogDebug("Completed and cleaned up request for chat {ChatId}", chatId);
            }
            catch (ObjectDisposedException)
            {
                // Already disposed, that's fine
            }
        }
    }

    /// <summary>
    /// Check if there's an active request for a chat.
    /// </summary>
    /// <param name="chatId">The chat ID</param>
    /// <returns>True if there's an active request</returns>
    public bool HasActiveRequest(string chatId)
    {
        return _activeCancellations.ContainsKey(chatId);
    }
}

