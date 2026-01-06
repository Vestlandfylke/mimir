// Copyright (c) Microsoft. All rights reserved.

import { logger } from '../utils/Logger';

/**
 * ChatRequestQueue - Ensures chat requests are processed sequentially
 *
 * Problem: When sending multiple messages quickly, responses can be lost
 * because Redux state gets overwritten by the second request.
 *
 * Solution: Queue requests and process them one at a time.
 */

interface QueuedRequest {
    id: string;
    chatId: string;
    execute: (signal: AbortSignal) => Promise<void>;
    resolve: () => void;
    reject: (error: unknown) => void;
}

// Callback type for state changes
type StateChangeCallback = () => void;

class ChatRequestQueue {
    private queue: QueuedRequest[] = [];
    private processing = false;
    private currentAbortController: AbortController | null = null;
    private currentRequestId: string | null = null;
    private currentChatId: string | null = null;
    private stateChangeListeners: StateChangeCallback[] = [];

    // Track cancelled chat IDs to ignore incoming SignalR messages
    private cancelledChatIds = new Set<string>();

    /**
     * Subscribe to state changes (queue length, processing status)
     */
    subscribe(callback: StateChangeCallback): () => void {
        this.stateChangeListeners.push(callback);
        return () => {
            this.stateChangeListeners = this.stateChangeListeners.filter((cb) => cb !== callback);
        };
    }

    private notifyStateChange() {
        this.stateChangeListeners.forEach((cb) => {
            cb();
        });
    }

    /**
     * Add a request to the queue
     * @param chatId The chat ID for this request
     * @param execute Function that executes the chat request (receives AbortSignal)
     * @returns Promise that resolves when the request completes
     */
    async enqueue(chatId: string, execute: (signal: AbortSignal) => Promise<void>): Promise<void> {
        return new Promise((resolve, reject) => {
            const request: QueuedRequest = {
                id: `req-${Date.now()}-${Math.random()}`,
                chatId,
                execute,
                resolve,
                reject,
            };

            this.queue.push(request);
            logger.debug(`📋 Request queued (${this.queue.length} in queue):`, request.id);
            this.notifyStateChange();

            // Start processing if not already processing
            if (!this.processing) {
                void this.processQueue();
            }
        });
    }

    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;
        this.notifyStateChange();

        while (this.queue.length > 0) {
            const request = this.queue.shift();
            if (!request) {
                continue;
            }

            logger.debug(`⚙️ Processing request (${this.queue.length} remaining):`, request.id);

            // Create abort controller for this request
            this.currentAbortController = new AbortController();
            this.currentRequestId = request.id;
            this.currentChatId = request.chatId;
            this.notifyStateChange();

            try {
                await request.execute(this.currentAbortController.signal);
                logger.debug(`✅ Request completed:`, request.id);
                request.resolve();
            } catch (error) {
                // Check if this was an abort - resolve silently, don't show error
                if (error instanceof DOMException && error.name === 'AbortError') {
                    logger.debug(`🛑 Request aborted by user:`, request.id);
                    request.resolve(); // Resolve instead of reject - user cancelled intentionally
                } else {
                    logger.error(`❌ Request failed:`, request.id, error);
                    request.reject(error);
                }
            } finally {
                this.currentAbortController = null;
                this.currentRequestId = null;
                this.currentChatId = null;
                this.notifyStateChange();
            }
        }

        this.processing = false;
        this.notifyStateChange();
        logger.debug(`✅ Queue empty - ready for new requests`);
    }

    /**
     * Abort the currently processing request
     * @returns The chatId of the aborted request, or null if nothing was aborted
     */
    abortCurrentRequest(): string | null {
        if (this.currentAbortController && this.currentChatId) {
            logger.debug(`🛑 Aborting current request:`, this.currentRequestId, 'for chat:', this.currentChatId);
            // Mark this chat as cancelled so we can ignore incoming SignalR messages
            this.cancelledChatIds.add(this.currentChatId);
            this.currentAbortController.abort();
            return this.currentChatId;
        }
        return null;
    }

    /**
     * Check if a chat has been cancelled (used to ignore incoming SignalR messages)
     */
    isChatCancelled(chatId: string): boolean {
        return this.cancelledChatIds.has(chatId);
    }

    /**
     * Clear the cancelled status for a chat (call when user sends a new message)
     */
    clearCancelledChat(chatId: string): void {
        this.cancelledChatIds.delete(chatId);
    }

    /**
     * Cancel a specific queued request (not the current one)
     */
    cancelQueuedRequest(requestId: string): boolean {
        const index = this.queue.findIndex((req) => req.id === requestId);
        if (index !== -1) {
            const removed = this.queue.splice(index, 1)[0];
            logger.debug(`🗑️ Cancelled queued request:`, removed.id);
            removed.resolve(); // Resolve silently - user cancelled intentionally
            this.notifyStateChange();
            return true;
        }
        return false;
    }

    /**
     * Clear all queued requests (does not abort current)
     */
    clearQueue(): number {
        const count = this.queue.length;
        for (const request of this.queue) {
            request.resolve(); // Resolve silently
        }
        this.queue = [];
        logger.debug(`🗑️ Cleared ${count} queued requests`);
        this.notifyStateChange();
        return count;
    }

    /**
     * Get current queue length (items waiting, not including current)
     */
    getQueueLength(): number {
        return this.queue.length;
    }

    /**
     * Get the list of queued requests (for UI display)
     */
    getQueuedRequests(): Array<{ id: string; chatId: string }> {
        return this.queue.map((req) => ({ id: req.id, chatId: req.chatId }));
    }

    /**
     * Check if currently processing a request
     */
    isCurrentlyProcessing(): boolean {
        return this.processing;
    }

    /**
     * Get the current request ID (if processing)
     */
    getCurrentRequestId(): string | null {
        return this.currentRequestId;
    }
}

// Export singleton instance
export const chatRequestQueue = new ChatRequestQueue();
