// Copyright (c) Microsoft. All rights reserved.

import { useMsal } from '@azure/msal-react';
import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../redux/app/hooks';
import { RootState } from '../../redux/app/store';
import { setConnectionReconnected } from '../../redux/features/app/appSlice';
import { AuthHelper } from '../auth/AuthHelper';
import { ChatMessageType, IChatMessage, UserFeedback } from '../models/ChatMessage';
import { ChatService } from '../services/ChatService';
import { logger } from '../utils/Logger';

/**
 * Check if two messages are likely the same based on content matching.
 * Used as fallback when IDs don't match (client vs server generated IDs).
 * More lenient timestamp check (10 minutes) to handle server clock differences.
 */
const areMessagesSimilar = (local: IChatMessage, server: IChatMessage): boolean => {
    // Must have same user and content (normalized)
    const localContent = local.content.trim();
    const serverContent = server.content.trim();

    if (local.userId !== server.userId || localContent !== serverContent) {
        return false;
    }

    // Timestamps should be within 10 minutes of each other (more lenient)
    // This handles cases where server and client clocks are slightly different
    const timeDiff = Math.abs(local.timestamp - server.timestamp);
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    return timeDiff <= TEN_MINUTES_MS;
};

/**
 * Hook to automatically sync messages when the SignalR connection is restored.
 * This prevents the need for users to manually refresh the page after reconnection.
 * Sync happens silently in the background - no user notifications.
 */
export const useConnectionSync = () => {
    const dispatch = useAppDispatch();
    const { instance, inProgress } = useMsal();

    const connectionReconnected = useAppSelector((state: RootState) => state.app.connectionReconnected);
    const selectedChatId = useAppSelector((state: RootState) => state.conversations.selectedId);

    // Store conversations in a ref to avoid dependency issues and get fresh data when needed
    const conversationsRef = useRef<RootState['conversations']['conversations']>({});
    const conversations = useAppSelector((state: RootState) => state.conversations.conversations);
    conversationsRef.current = conversations;

    // Use ref to track if sync is in progress to prevent multiple concurrent syncs
    const isSyncingRef = useRef(false);
    // Track the last synced chat to prevent duplicate syncs for same chat
    const lastSyncedChatRef = useRef<string | null>(null);

    // Memoized sync function that gets fresh messages from ref
    const syncMessages = useCallback(async () => {
        // Guard against multiple concurrent syncs
        if (!connectionReconnected || !selectedChatId || isSyncingRef.current) {
            return;
        }

        // Prevent duplicate sync for same chat in quick succession
        if (lastSyncedChatRef.current === selectedChatId) {
            logger.debug('Skipping duplicate sync for same chat');
            dispatch(setConnectionReconnected(false));
            return;
        }

        isSyncingRef.current = true;
        lastSyncedChatRef.current = selectedChatId;
        logger.log('🔄 Connection restored - syncing messages for chat:', selectedChatId);

        // Create chat service instance inside effect to avoid dependency issues
        const chatService = new ChatService();

        try {
            const accessToken = await AuthHelper.getSKaaSAccessToken(instance, inProgress);
            const serverMessages = await chatService.getChatMessagesAsync(selectedChatId, 0, 100, accessToken);

            // Get FRESH messages from the ref at the time of comparison
            // This ensures we're comparing against the latest local state
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            const conversation = conversationsRef.current[selectedChatId] as
                | (typeof conversationsRef.current)[string]
                | undefined;
            if (!conversation) {
                logger.warn('Chat not found in store during sync, skipping');
                return;
            }
            const currentMessages = conversation.messages;

            // Find messages that exist on server but not in our local state
            // Use both ID matching AND content-based matching to handle:
            // - Client-generated IDs (e.g., user-123456789-abc) vs server-generated IDs (GUIDs)
            const existingMessageIds = new Set(currentMessages.map((m) => m.id));

            const newMessages = serverMessages.filter((serverMsg) => {
                // Fast path: check by ID first
                if (existingMessageIds.has(serverMsg.id)) {
                    logger.debug(`ℹ️ Skipping sync (ID match): ${serverMsg.id}`);
                    return false;
                }

                // Slow path: check by content similarity
                // This handles cases where client generated a local ID but server used a different ID
                const isDuplicate = currentMessages.some((localMsg) => areMessagesSimilar(localMsg, serverMsg));

                if (isDuplicate) {
                    logger.debug(
                        `ℹ️ Skipping sync of message (content match): "${serverMsg.content.substring(0, 30)}..."`,
                    );
                }

                return !isDuplicate;
            });

            if (newMessages.length > 0) {
                logger.log(`✅ Found ${newMessages.length} genuinely new message(s) to sync`);

                // Add new messages to the conversation
                for (const message of newMessages) {
                    const messageWithFeedback: IChatMessage = {
                        ...message,
                        userFeedback:
                            message.userId === 'bot' && message.type === ChatMessageType.Message
                                ? UserFeedback.Requested
                                : undefined,
                    };

                    dispatch({
                        type: 'conversations/addMessageToConversationFromServer',
                        payload: { chatId: selectedChatId, message: messageWithFeedback },
                    });
                }
            } else {
                logger.debug('No new messages to sync (all messages already exist locally)');
            }

            // Clear any stuck bot response status
            dispatch({
                type: 'conversations/updateBotResponseStatus',
                payload: { chatId: selectedChatId, status: undefined },
            });
        } catch (error) {
            logger.error('Failed to sync messages after reconnection:', error);
            // Silent failure - connection is working, sync just failed
            // User can refresh if they notice missing messages
        } finally {
            // Reset the flags
            dispatch(setConnectionReconnected(false));
            isSyncingRef.current = false;
            // Clear lastSyncedChat after a delay to allow subsequent syncs if needed
            setTimeout(() => {
                lastSyncedChatRef.current = null;
            }, 5000);
        }
    }, [connectionReconnected, selectedChatId, dispatch, instance, inProgress]);

    useEffect(() => {
        void syncMessages();
        // Note: Only trigger on connectionReconnected and selectedChatId changes
        // conversations is accessed via ref to avoid re-triggering
    }, [connectionReconnected, selectedChatId, syncMessages]);
};
