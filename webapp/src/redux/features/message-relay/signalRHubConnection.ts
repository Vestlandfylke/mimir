// Copyright (c) Microsoft. All rights reserved.

import * as signalR from '@microsoft/signalr';
import { Constants } from '../../../Constants';
import { COPY } from '../../../assets/strings';
import { getFriendlyChatName } from '../../../libs/hooks/useChat';
import { AlertType } from '../../../libs/models/AlertType';
import { AuthorRoles, ChatMessageType, IChatMessage } from '../../../libs/models/ChatMessage';
import { IChatUser } from '../../../libs/models/ChatUser';
import { PlanState } from '../../../libs/models/Plan';
import { BackendServiceUrl } from '../../../libs/services/BaseService';
import { chatRequestQueue } from '../../../libs/services/ChatRequestQueue';
import { logger } from '../../../libs/utils/Logger';
import { StoreMiddlewareAPI } from '../../app/store';
import { addAlert, setConnectionReconnected, setMaintenance } from '../app/appSlice';
import { ChatState } from '../conversations/ChatState';
import { UpdatePluginStatePayload } from '../conversations/ConversationsState';

/*
 * This is a module that encapsulates the SignalR connection
 * to the messageRelayHub on the server.
 */

// These have to match the callback names used in the backend
const enum SignalRCallbackMethods {
    ReceiveMessage = 'ReceiveMessage',
    ReceiveMessageUpdate = 'ReceiveMessageUpdate',
    UserJoined = 'UserJoined',
    ReceiveUserTypingState = 'ReceiveUserTypingState',
    ReceiveBotResponseStatus = 'ReceiveBotResponseStatus',
    GlobalDocumentUploaded = 'GlobalDocumentUploaded',
    ChatEdited = 'ChatEdited',
    ChatDeleted = 'ChatDeleted',
    GlobalSiteMaintenance = 'GlobalSiteMaintenance',
    PluginStateChanged = 'PluginStateChanged',
}

// Set up a SignalR connection to the messageRelayHub on the server
const setupSignalRConnectionToChatHub = () => {
    const connectionHubUrl = new URL('/messageRelayHub', BackendServiceUrl);
    const signalRConnectionOptions = {
        skipNegotiation: false,
        // Use WebSockets with fallback to other transports if WebSockets fail
        // This is more reliable than WebSockets-only
        transport:
            signalR.HttpTransportType.WebSockets |
            signalR.HttpTransportType.ServerSentEvents |
            signalR.HttpTransportType.LongPolling,
        logger: signalR.LogLevel.Warning,
    };

    // Create the connection instance
    // withAutomaticReconnect will automatically try to reconnect and generate a new socket connection if needed
    const hubConnection = new signalR.HubConnectionBuilder()
        .withUrl(connectionHubUrl.toString(), signalRConnectionOptions)
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000]) // Retry with increasing delays
        .withHubProtocol(new signalR.JsonHubProtocol())
        .configureLogging(signalR.LogLevel.Information)
        .build();

    // Note: to keep the connection open the serverTimeout should be
    // larger than the KeepAlive value that is set on the server
    // keepAliveIntervalInMilliseconds default is 15000 and we are using default
    // Increased serverTimeout to 180000ms (3 minutes) to handle long AI responses
    // This matches the backend timeout of 180 seconds
    hubConnection.serverTimeoutInMilliseconds = 180000; // 3 minutes
    hubConnection.keepAliveIntervalInMilliseconds = 15000; // Send keepalive every 15 seconds

    return hubConnection;
};

const registerCommonSignalConnectionEvents = (hubConnection: signalR.HubConnection, store: StoreMiddlewareAPI) => {
    // Re-establish the connection if connection dropped
    hubConnection.onclose((error) => {
        if (hubConnection.state === signalR.HubConnectionState.Disconnected) {
            const userMessage = 'Tilkoblinga vart avbroten. Prøv å oppdatere sida for å kople til på nytt.';
            store.dispatch(
                addAlert({
                    message: userMessage,
                    type: AlertType.Warning,
                    id: Constants.app.CONNECTION_ALERT_ID,
                }),
            );
            logger.log('Connection closed', error);
        }
    });

    hubConnection.onreconnecting((error) => {
        if (hubConnection.state === signalR.HubConnectionState.Reconnecting) {
            const userMessage = 'Tilkoblinga vart mellombels avbroten. Koplar til på nytt...';
            store.dispatch(
                addAlert({
                    message: userMessage,
                    type: AlertType.Info,
                    id: Constants.app.CONNECTION_ALERT_ID,
                }),
            );
            logger.log('Reconnecting', error);
        }
    });

    hubConnection.onreconnected((connectionId = '') => {
        if (hubConnection.state === signalR.HubConnectionState.Connected) {
            logger.log(`🔄 Connection restored with connectionId ${connectionId}. Triggering message sync...`);

            // Show temporary info message while sync is in progress
            store.dispatch(
                addAlert({
                    message: 'Tilkobling gjenoppretta. Synkroniserer meldingar...',
                    type: AlertType.Info,
                    id: Constants.app.CONNECTION_ALERT_ID,
                }),
            );

            // Dispatch the reconnected flag to trigger the useConnectionSync hook
            store.dispatch(setConnectionReconnected(true));
        }
    });
};

const startSignalRConnection = (hubConnection: signalR.HubConnection, store: StoreMiddlewareAPI) => {
    registerCommonSignalConnectionEvents(hubConnection, store);
    hubConnection
        .start()
        .then(() => {
            logger.debug('SignalR connection established');
        })
        .catch((err) => {
            logger.error('SignalR Connection Error: ', err);
            setTimeout(() => {
                startSignalRConnection(hubConnection, store);
            }, 5000);
        });
};

// Add connection state monitoring for debugging (only in development)
const monitorConnectionState = (hubConnection: signalR.HubConnection) => {
    // Log connection state every 10 seconds during active requests
    setInterval(() => {
        const state = hubConnection.state;
        const stateNames = {
            [signalR.HubConnectionState.Disconnected]: 'Disconnected',
            [signalR.HubConnectionState.Connecting]: 'Connecting',
            [signalR.HubConnectionState.Connected]: 'Connected',
            [signalR.HubConnectionState.Disconnecting]: 'Disconnecting',
            [signalR.HubConnectionState.Reconnecting]: 'Reconnecting',
        };

        if (state !== signalR.HubConnectionState.Connected) {
            logger.warn(`⚠️ SignalR connection state: ${stateNames[state] || state}`);
        } else {
            logger.debug(`✓ SignalR connection: ${stateNames[state]}`);
        }
    }, 10000); // Check every 10 seconds
};

const registerSignalREvents = (hubConnection: signalR.HubConnection, store: StoreMiddlewareAPI) => {
    // Start monitoring connection state
    monitorConnectionState(hubConnection);
    hubConnection.on(
        SignalRCallbackMethods.ReceiveMessage,
        (chatId: string, senderId: string, message: IChatMessage) => {
            // Check if this chat's request was cancelled - ignore bot messages for cancelled chats
            if (message.authorRole === AuthorRoles.Bot && chatRequestQueue.isChatCancelled(chatId)) {
                logger.debug('🚫 Ignoring bot message for cancelled chat:', chatId);
                // Clear the cancelled status after ignoring the message
                chatRequestQueue.clearCancelledChat(chatId);
                // Still clear the spinner
                store.dispatch({
                    type: 'conversations/updateBotResponseStatus',
                    payload: { chatId, status: undefined },
                });
                return;
            }

            // Debug logging
            logger.debug('📨 SignalR ReceiveMessage:', {
                chatId,
                senderId,
                messageId: message.id,
                authorRole: message.authorRole,
                timestamp: new Date().toISOString(),
                connectionState: hubConnection.state,
            });

            if (message.authorRole === AuthorRoles.Bot) {
                const loggedInUserId = store.getState().app.activeUserInfo?.id;
                const responseToLoggedInUser = loggedInUserId === senderId;
                message.planState =
                    message.type === ChatMessageType.Plan && responseToLoggedInUser
                        ? PlanState.PlanApprovalRequired
                        : PlanState.Disabled;

                logger.debug('🤖 Bot message received, dispatching to Redux', {
                    chatId,
                    messageId: message.id,
                    contentPreview: message.content.substring(0, 50),
                });
            }

            // Get current message count before dispatch
            const beforeCount = store.getState().conversations.conversations[chatId].messages.length;

            store.dispatch({ type: 'conversations/addMessageToConversationFromServer', payload: { chatId, message } });

            // Verify message was added
            const afterCount = store.getState().conversations.conversations[chatId].messages.length;
            logger.debug(`✓ Message dispatched to Redux store (messages: ${beforeCount} → ${afterCount})`);

            // Safety: clear spinner when a bot message is received
            if (message.authorRole === AuthorRoles.Bot) {
                store.dispatch({
                    type: 'conversations/updateBotResponseStatus',
                    payload: { chatId, status: undefined },
                });
            }
        },
    );

    hubConnection.on(SignalRCallbackMethods.ReceiveMessageUpdate, (message: IChatMessage) => {
        const { chatId, id: messageId, content } = message;

        // Check if this chat's request was cancelled - ignore updates for cancelled chats
        if (message.authorRole === AuthorRoles.Bot && chatRequestQueue.isChatCancelled(chatId)) {
            logger.debug('🚫 Ignoring bot message update for cancelled chat:', chatId);
            return;
        }

        // Debug logging for message updates
        logger.debug('📝 SignalR ReceiveMessageUpdate:', {
            chatId,
            messageId,
            hasContent: !!content,
            contentPreview: content ? content.substring(0, 50) : '(empty)',
            hasTokenUsage: !!message.tokenUsage,
            authorRole: message.authorRole,
        });

        // If tokenUsage is defined, that means full message content has already been streamed and updated from server. No need to update content again.
        const property = message.tokenUsage ? 'tokenUsage' : 'content';
        const value = message.tokenUsage ?? content;

        logger.debug(`📝 Updating message property: ${property}`, {
            messageId,
            valuePreview: typeof value === 'string' ? value.substring(0, 50) : value,
        });

        store.dispatch({
            type: 'conversations/updateMessageProperty',
            payload: {
                chatId,
                messageIdOrIndex: messageId,
                property,
                value,
                frontLoad: true,
            },
        });

        // Also clear spinner on message updates from bot
        if (message.authorRole === AuthorRoles.Bot) {
            store.dispatch({
                type: 'conversations/updateBotResponseStatus',
                payload: { chatId, status: undefined },
            });
        }
    });

    hubConnection.on(SignalRCallbackMethods.UserJoined, (chatId: string, userId: string) => {
        const user: IChatUser = {
            id: userId,
            online: false,
            fullName: '',
            emailAddress: '',
            isTyping: false,
            photo: '',
        };
        store.dispatch({ type: 'conversations/addUserToConversation', payload: { user, chatId } });
    });

    hubConnection.on(
        SignalRCallbackMethods.ReceiveUserTypingState,
        (chatId: string, userId: string, isTyping: boolean) => {
            store.dispatch({
                type: 'conversations/updateUserIsTypingFromServer',
                payload: { chatId, userId, isTyping },
            });
        },
    );

    hubConnection.on(SignalRCallbackMethods.ReceiveBotResponseStatus, (chatId: string, status: string | null) => {
        // Debug logging for bot status
        logger.debug('🔄 SignalR ReceiveBotResponseStatus:', {
            chatId,
            status: status ?? 'null (done/clear)',
            timestamp: new Date().toISOString(),
            connectionState: hubConnection.state,
        });

        // Normalize null/empty to undefined to clear spinner reliably
        const normalizedStatus = status ?? undefined;
        store.dispatch({
            type: 'conversations/updateBotResponseStatus',
            payload: { chatId, status: normalizedStatus },
        });

        if (!normalizedStatus) {
            logger.debug('✓ Bot response complete - spinner should clear');
        }
    });

    hubConnection.on(SignalRCallbackMethods.GlobalDocumentUploaded, (fileNames: string, userName: string) => {
        store.dispatch(addAlert({ message: `${userName} uploaded ${fileNames} to all chats`, type: AlertType.Info }));
    });

    hubConnection.on(SignalRCallbackMethods.ChatEdited, (chat: ChatState) => {
        const { id, title } = chat;
        if (!(id in store.getState().conversations.conversations)) {
            store.dispatch(
                addAlert({
                    message: `Chat ${id} not found in store. Chat edited signal from server is not processed.`,
                    type: AlertType.Error,
                }),
            );
        }
        store.dispatch({ type: 'conversations/editConversationTitle', payload: { id, newTitle: title } });
    });

    // User Id is that of the user who initiated the deletion.
    hubConnection.on(SignalRCallbackMethods.ChatDeleted, (chatId: string, userId: string) => {
        const conversations = store.getState().conversations.conversations;
        if (!(chatId in conversations)) {
            store.dispatch({
                message: `Chat ${chatId} not found in store. ChatDeleted signal from server was not processed. ${COPY.REFRESH_APP_ADVISORY}`,
                type: AlertType.Error,
            });
        } else {
            const friendlyChatName = getFriendlyChatName(conversations[chatId]);
            const deletedByAnotherUser = userId !== store.getState().app.activeUserInfo?.id;

            store.dispatch(
                addAlert({
                    message: deletedByAnotherUser
                        ? COPY.CHAT_DELETED_MESSAGE(friendlyChatName)
                        : `Chat {${friendlyChatName}} deleted successfully.`,
                    type: AlertType.Warning,
                }),
            );

            if (deletedByAnotherUser)
                store.dispatch({
                    type: 'conversations/disableConversation',
                    payload: chatId,
                });
        }
    });

    hubConnection.on(SignalRCallbackMethods.GlobalSiteMaintenance, () => {
        store.dispatch(setMaintenance(true));
    });

    hubConnection.on(
        SignalRCallbackMethods.PluginStateChanged,
        (chatId: string, pluginName: string, pluginState: boolean) => {
            store.dispatch({
                type: 'conversations/updatePluginState',
                payload: { id: chatId, pluginName: pluginName, newState: pluginState } as UpdatePluginStatePayload,
            });
        },
    );
};

// This is a singleton instance of the SignalR connection
let hubConnection: signalR.HubConnection | undefined = undefined;
let storeRef: StoreMiddlewareAPI | undefined = undefined;

// Track last activity time to detect stale connections after inactivity
let lastActivityTime = Date.now();
const INACTIVITY_THRESHOLD_MS = 60000; // 1 minute of inactivity triggers connection check

/**
 * Check if the SignalR connection is healthy and connected.
 */
export const isConnectionHealthy = (): boolean => {
    return hubConnection?.state === signalR.HubConnectionState.Connected;
};

/**
 * Get the current connection state as a string.
 */
export const getConnectionState = (): string => {
    if (!hubConnection) return 'NotInitialized';
    const stateNames: Record<signalR.HubConnectionState, string> = {
        [signalR.HubConnectionState.Disconnected]: 'Disconnected',
        [signalR.HubConnectionState.Connecting]: 'Connecting',
        [signalR.HubConnectionState.Connected]: 'Connected',
        [signalR.HubConnectionState.Disconnecting]: 'Disconnecting',
        [signalR.HubConnectionState.Reconnecting]: 'Reconnecting',
    };
    return stateNames[hubConnection.state] || 'Unknown';
};

/**
 * Force reconnect if the connection is not healthy.
 * Returns a promise that resolves when connected or rejects on failure.
 */
export const ensureConnected = async (): Promise<void> => {
    if (!hubConnection) {
        throw new Error('SignalR connection not initialized');
    }

    if (hubConnection.state === signalR.HubConnectionState.Connected) {
        return; // Already connected
    }

    if (
        hubConnection.state === signalR.HubConnectionState.Connecting ||
        hubConnection.state === signalR.HubConnectionState.Reconnecting
    ) {
        // Wait for current connection attempt to complete
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 10000);

            const checkState = setInterval(() => {
                if (hubConnection?.state === signalR.HubConnectionState.Connected) {
                    clearInterval(checkState);
                    clearTimeout(timeout);
                    resolve();
                } else if (hubConnection?.state === signalR.HubConnectionState.Disconnected) {
                    clearInterval(checkState);
                    clearTimeout(timeout);
                    reject(new Error('Connection failed'));
                }
            }, 100);
        });
        return;
    }

    // Connection is disconnected, try to start it
    logger.log('🔄 SignalR connection lost, attempting to reconnect...');
    try {
        await hubConnection.start();
        logger.log('✅ SignalR reconnection successful');
        if (storeRef) {
            storeRef.dispatch(setConnectionReconnected(true));
        }
    } catch (err) {
        logger.error('❌ SignalR reconnection failed:', err);
        throw err;
    }
};

/**
 * Handle page visibility changes - check connection when user returns to tab.
 */
const setupVisibilityChangeHandler = (store: StoreMiddlewareAPI) => {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && hubConnection) {
            const inactivityDuration = Date.now() - lastActivityTime;
            const wasInactiveForAWhile = inactivityDuration > INACTIVITY_THRESHOLD_MS;

            logger.debug(
                `👁️ Page became visible. Inactivity: ${Math.round(inactivityDuration / 1000)}s, Connection: ${getConnectionState()}`,
            );

            // If we were inactive for a while or connection isn't healthy, check/reconnect
            if (wasInactiveForAWhile || !isConnectionHealthy()) {
                logger.log('🔄 Checking connection after returning to tab...');

                if (hubConnection.state === signalR.HubConnectionState.Disconnected) {
                    // Connection is definitely dead, try to restart
                    store.dispatch(
                        addAlert({
                            message: 'Koplar til på nytt etter inaktivitet...',
                            type: AlertType.Info,
                            id: Constants.app.CONNECTION_ALERT_ID,
                        }),
                    );

                    hubConnection
                        .start()
                        .then(() => {
                            logger.log('✅ Reconnected after visibility change');
                            store.dispatch(setConnectionReconnected(true));
                        })
                        .catch((err) => {
                            logger.error('❌ Failed to reconnect after visibility change:', err);
                            store.dispatch(
                                addAlert({
                                    message: 'Kunne ikkje kople til på nytt. Prøv å oppdatere sida.',
                                    type: AlertType.Warning,
                                    id: Constants.app.CONNECTION_ALERT_ID,
                                }),
                            );
                        });
                } else if (hubConnection.state === signalR.HubConnectionState.Connected) {
                    // Connection looks good, but do a quick health check by triggering sync
                    // This ensures any missed messages are fetched
                    if (wasInactiveForAWhile) {
                        logger.log('🔄 Triggering message sync after extended inactivity');
                        store.dispatch(setConnectionReconnected(true));
                    }
                }
            }

            // Update activity time when page becomes visible
            lastActivityTime = Date.now();
        }
    });

    // Also track user activity to know when they were last active
    const updateActivity = () => {
        lastActivityTime = Date.now();
    };

    // Track various user activities
    document.addEventListener('keydown', updateActivity, { passive: true });
    document.addEventListener('mousedown', updateActivity, { passive: true });
    document.addEventListener('touchstart', updateActivity, { passive: true });
};

// This function will return the singleton instance of the SignalR connection
export const getOrCreateHubConnection = (store: StoreMiddlewareAPI) => {
    if (hubConnection === undefined) {
        hubConnection = setupSignalRConnectionToChatHub();
        storeRef = store;

        // Start the signalR connection to make sure messages are
        // sent to all clients and received by all clients
        startSignalRConnection(hubConnection, store);
        registerSignalREvents(hubConnection, store);

        // Set up visibility change handler for reconnection after tab switch
        setupVisibilityChangeHandler(store);
    }
    return hubConnection;
};
