// Copyright (c) Microsoft. All rights reserved.

import { useMsal } from '@azure/msal-react';
import { useEffect, useRef } from 'react';
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
 * Timestamps within 5 minutes are considered close enough.
 */
const areMessagesSimilar = (local: IChatMessage, server: IChatMessage): boolean => {
    // Must have same user and content
    if (local.userId !== server.userId || local.content !== server.content) {
        return false;
    }

    // Timestamps should be within 5 minutes of each other
    const timeDiff = Math.abs(local.timestamp - server.timestamp);
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    return timeDiff <= FIVE_MINUTES_MS;
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
    const currentMessages = useAppSelector((state: RootState) => {
        if (selectedChatId && selectedChatId in state.conversations.conversations) {
            return state.conversations.conversations[selectedChatId].messages;
        }
        return [];
    });

    // Use ref to track if sync is in progress to prevent multiple concurrent syncs
    const isSyncingRef = useRef(false);

    useEffect(() => {
        const syncMessages = async () => {
            // Guard against multiple concurrent syncs
            if (!connectionReconnected || !selectedChatId || isSyncingRef.current) {
                return;
            }

            isSyncingRef.current = true;
            logger.log('🔄 Connection restored - syncing messages for chat:', selectedChatId);

            // Create chat service instance inside effect to avoid dependency issues
            const chatService = new ChatService();

            try {
                const accessToken = await AuthHelper.getSKaaSAccessToken(instance, inProgress);
                const serverMessages = await chatService.getChatMessagesAsync(selectedChatId, 0, 100, accessToken);

                // Find messages that exist on server but not in our local state
                // Use both ID matching AND content-based matching to handle:
                // - Client-generated IDs (e.g., user-123456789-abc) vs server-generated IDs (GUIDs)
                const existingMessageIds = new Set(currentMessages.map((m) => m.id));

                const newMessages = serverMessages.filter((serverMsg) => {
                    // Fast path: check by ID first
                    if (existingMessageIds.has(serverMsg.id)) {
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
                // Reset the flag
                dispatch(setConnectionReconnected(false));
                isSyncingRef.current = false;
            }
        };

        void syncMessages();
    }, [connectionReconnected, selectedChatId, currentMessages, dispatch, instance, inProgress]);
};
