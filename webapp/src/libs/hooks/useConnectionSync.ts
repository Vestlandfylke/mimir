// Copyright (c) Microsoft. All rights reserved.

import { useMsal } from '@azure/msal-react';
import { useCallback, useEffect, useRef } from 'react';
import { Constants } from '../../Constants';
import { useAppDispatch, useAppSelector } from '../../redux/app/hooks';
import { RootState } from '../../redux/app/store';
import { addAlert, removeAlertById, setConnectionReconnected } from '../../redux/features/app/appSlice';
import { AuthHelper } from '../auth/AuthHelper';
import { AlertType } from '../models/AlertType';
import { ChatMessageType, IChatMessage, UserFeedback } from '../models/ChatMessage';
import { ChatService } from '../services/ChatService';
import { logger } from '../utils/Logger';

// Auto-dismiss delay for success messages (5 seconds)
const AUTO_DISMISS_DELAY = 5000;

/**
 * Hook to automatically sync messages when the SignalR connection is restored.
 * This prevents the need for users to manually refresh the page after reconnection.
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
    const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Function to show alert with auto-dismiss for success messages
    const showAlertWithAutoDismiss = useCallback(
        (message: string, type: AlertType) => {
            // Clear any existing auto-dismiss timer
            if (autoDismissTimerRef.current) {
                clearTimeout(autoDismissTimerRef.current);
                autoDismissTimerRef.current = null;
            }

            dispatch(
                addAlert({
                    message,
                    type,
                    id: Constants.app.CONNECTION_ALERT_ID,
                }),
            );

            // Auto-dismiss success messages after delay
            if (type === AlertType.Success) {
                autoDismissTimerRef.current = setTimeout(() => {
                    // Remove the connection alert by ID (safer than by index)
                    dispatch(removeAlertById(Constants.app.CONNECTION_ALERT_ID));
                    autoDismissTimerRef.current = null;
                }, AUTO_DISMISS_DELAY);
            }
        },
        [dispatch],
    );

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
                const existingMessageIds = new Set(currentMessages.map((m) => m.id));
                const newMessages = serverMessages.filter((m) => !existingMessageIds.has(m.id));

                if (newMessages.length > 0) {
                    logger.log(`✅ Found ${newMessages.length} new message(s) to sync`);

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

                    // Show success message with auto-dismiss
                    showAlertWithAutoDismiss(
                        `Tilkobling gjenoppretta. ${newMessages.length} melding(ar) synkronisert automatisk.`,
                        AlertType.Success,
                    );
                } else {
                    // No new messages, show brief success and auto-dismiss
                    showAlertWithAutoDismiss(
                        'Tilkobling gjenoppretta. Alle meldingar er oppdaterte.',
                        AlertType.Success,
                    );
                }

                // Clear any stuck bot response status
                dispatch({
                    type: 'conversations/updateBotResponseStatus',
                    payload: { chatId: selectedChatId, status: undefined },
                });
            } catch (error) {
                logger.error('Failed to sync messages after reconnection:', error);
                // Show info message - sync failed but connection is back
                showAlertWithAutoDismiss(
                    'Tilkoblinga er tilbake! Viss du saknar nyleg data, kan du oppdatere sida.',
                    AlertType.Info,
                );
            } finally {
                // Reset the flag
                dispatch(setConnectionReconnected(false));
                isSyncingRef.current = false;
            }
        };

        void syncMessages();
    }, [
        connectionReconnected,
        selectedChatId,
        currentMessages,
        dispatch,
        instance,
        inProgress,
        showAlertWithAutoDismiss,
    ]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (autoDismissTimerRef.current) {
                clearTimeout(autoDismissTimerRef.current);
            }
        };
    }, []);
};
