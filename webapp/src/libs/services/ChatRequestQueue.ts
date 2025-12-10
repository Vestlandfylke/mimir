// Copyright (c) Microsoft. All rights reserved.

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
    execute: () => Promise<void>;
    resolve: () => void;
    reject: (error: any) => void;
}

class ChatRequestQueue {
    private queue: QueuedRequest[] = [];
    private isProcessing = false;

    /**
     * Add a request to the queue
     * @param execute Function that executes the chat request
     * @returns Promise that resolves when the request completes
     */
    async enqueue(execute: () => Promise<void>): Promise<void> {
        return new Promise((resolve, reject) => {
            const request: QueuedRequest = {
                id: `req-${Date.now()}-${Math.random()}`,
                execute,
                resolve,
                reject,
            };

            this.queue.push(request);
            console.log(`📋 Request queued (${this.queue.length} in queue):`, request.id);

            // Start processing if not already processing
            if (!this.isProcessing) {
                void this.processQueue();
            }
        });
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.queue.length > 0) {
            const request = this.queue.shift();
            if (!request) {
                continue;
            }

            console.log(`⚙️ Processing request (${this.queue.length} remaining):`, request.id);

            try {
                await request.execute();
                console.log(`✅ Request completed:`, request.id);
                request.resolve();
            } catch (error) {
                console.error(`❌ Request failed:`, request.id, error);
                request.reject(error);
            }
        }

        this.isProcessing = false;
        console.log(`✅ Queue empty - ready for new requests`);
    }

    /**
     * Get current queue length
     */
    getQueueLength(): number {
        return this.queue.length;
    }

    /**
     * Check if currently processing a request
     */
    isCurrentlyProcessing(): boolean {
        return this.isProcessing;
    }
}

// Export singleton instance
export const chatRequestQueue = new ChatRequestQueue();

