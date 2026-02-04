// Copyright (c) Microsoft. All rights reserved.

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatMessageType, IChatMessage, UserFeedback } from '../../../libs/models/ChatMessage';
import { IChatUser } from '../../../libs/models/ChatUser';
import { logger } from '../../../libs/utils/Logger';
import { ChatState } from './ChatState';
import {
    ConversationInputChange,
    ConversationModelChange,
    Conversations,
    ConversationsState,
    ConversationSystemDescriptionChange,
    ConversationTitleChange,
    initialState,
    UpdatePluginStatePayload,
} from './ConversationsState';

export const conversationsSlice = createSlice({
    name: 'conversations',
    initialState,
    reducers: {
        setConversations: (state: ConversationsState, action: PayloadAction<Conversations>) => {
            state.conversations = action.payload;
        },
        editConversationTitle: (state: ConversationsState, action: PayloadAction<ConversationTitleChange>) => {
            const id = action.payload.id;
            const newTitle = action.payload.newTitle;
            state.conversations[id].title = newTitle;
            frontLoadChat(state, id);
        },
        editConversationInput: (state: ConversationsState, action: PayloadAction<ConversationInputChange>) => {
            const id = action.payload.id;
            const newInput = action.payload.newInput;
            state.conversations[id].input = newInput;
        },
        editConversationSystemDescription: (
            state: ConversationsState,
            action: PayloadAction<ConversationSystemDescriptionChange>,
        ) => {
            const id = action.payload.id;
            const newSystemDescription = action.payload.newSystemDescription;
            state.conversations[id].systemDescription = newSystemDescription;
        },
        editConversationMemoryBalance: (
            state: ConversationsState,
            action: PayloadAction<{ id: string; memoryBalance: number }>,
        ) => {
            const id = action.payload.id;
            const newMemoryBalance = action.payload.memoryBalance;
            state.conversations[id].memoryBalance = newMemoryBalance;
        },
        editConversationModel: (state: ConversationsState, action: PayloadAction<ConversationModelChange>) => {
            const id = action.payload.id;
            const newModelId = action.payload.modelId;
            state.conversations[id].modelId = newModelId;
        },
        setSelectedConversation: (state: ConversationsState, action: PayloadAction<string>) => {
            state.selectedId = action.payload;
        },
        toggleMultiUserConversations: (state: ConversationsState) => {
            const keys = Object.keys(state.conversations);
            keys.forEach((key) => {
                if (state.conversations[key].users.length > 1) {
                    state.conversations[key].hidden = !state.conversations[key].hidden;
                }
            });
        },
        addConversation: (state: ConversationsState, action: PayloadAction<ChatState>) => {
            const newId = action.payload.id;
            state.conversations = { [newId]: action.payload, ...state.conversations };
            state.selectedId = newId;
        },
        addUserToConversation: (
            state: ConversationsState,
            action: PayloadAction<{ user: IChatUser; chatId: string }>,
        ) => {
            const { user, chatId } = action.payload;
            // Conversation may have been archived/deleted - guard against edge cases
            const conversation = state.conversations[chatId] as ChatState | undefined;
            if (!conversation) return;
            conversation.users.push(user);
            conversation.userDataLoaded = false;
        },
        setImportingDocumentsToConversation: (
            state: ConversationsState,
            action: PayloadAction<{ importingDocuments: string[]; chatId: string }>,
        ) => {
            const { importingDocuments, chatId } = action.payload;
            // Conversation may have been archived/deleted - guard against edge cases
            const conversation = state.conversations[chatId] as ChatState | undefined;
            if (!conversation) return;
            conversation.importingDocuments = importingDocuments;
        },
        setUsersLoaded: (state: ConversationsState, action: PayloadAction<string>) => {
            // Conversation may have been archived/deleted - guard against edge cases
            const conversation = state.conversations[action.payload] as ChatState | undefined;
            if (!conversation) return;
            conversation.userDataLoaded = true;
        },
        setConversationMessages: (
            state: ConversationsState,
            action: PayloadAction<{ chatId: string; messages: IChatMessage[] }>,
        ) => {
            const { chatId, messages } = action.payload;
            const conversation = state.conversations[chatId] as ChatState | undefined;
            if (!conversation) return;
            conversation.messages = messages;
            conversation.userDataLoaded = true;
            conversation.lastUpdatedTimestamp =
                messages.length > 0 ? messages[messages.length - 1].timestamp : Date.now();
        },
        /*
         * addMessageToConversationFromUser() and addMessageToConversationFromServer() both update the conversations state.
         * However they are for different purposes. The former action is for updating the conversation from the
         * webapp and will be captured by the SignalR middleware and the payload will be broadcasted to all clients
         * in the same group.
         * The addMessageToConversationFromServer() action is triggered by the SignalR middleware when a response is received
         * from the webapi.
         */
        addMessageToConversationFromUser: (
            state: ConversationsState,
            action: PayloadAction<{ message: IChatMessage; chatId: string }>,
        ) => {
            const { message, chatId } = action.payload;
            updateConversation(state, chatId, message);
        },
        addMessageToConversationFromServer: (
            state: ConversationsState,
            action: PayloadAction<{ message: IChatMessage; chatId: string }>,
        ) => {
            const { message, chatId } = action.payload;
            updateConversation(state, chatId, message);
        },
        deleteMessageFromConversation: (
            state: ConversationsState,
            action: PayloadAction<{ chatId: string; messageId: string }>,
        ) => {
            const { chatId, messageId } = action.payload;
            const conversation = state.conversations[chatId] as (typeof state.conversations)[string] | undefined;
            if (conversation) {
                conversation.messages = conversation.messages.filter((msg) => msg.id !== messageId);
            }
        },
        /*
         * updateUserIsTyping() and updateUserIsTypingFromServer() both update a user's typing state.
         * However they are for different purposes. The former action is for updating an user's typing state from
         * the webapp and will be captured by the SignalR middleware and the payload will be broadcasted to all clients
         * in the same group.
         * The updateUserIsTypingFromServer() action is triggered by the SignalR middleware when a state is received
         * from the webapi.
         */
        updateUserIsTyping: (
            state: ConversationsState,
            action: PayloadAction<{ userId: string; chatId: string; isTyping: boolean }>,
        ) => {
            const { userId, chatId, isTyping } = action.payload;
            updateUserTypingState(state, userId, chatId, isTyping);
        },
        updateUserIsTypingFromServer: (
            state: ConversationsState,
            action: PayloadAction<{ userId: string; chatId: string; isTyping: boolean }>,
        ) => {
            const { userId, chatId, isTyping } = action.payload;
            updateUserTypingState(state, userId, chatId, isTyping);
        },
        updateBotResponseStatus: (
            state: ConversationsState,
            action: PayloadAction<{ chatId: string; status: string | undefined }>,
        ) => {
            const { chatId, status } = action.payload;
            // Conversation may have been archived/deleted - guard against edge cases
            const conversation = state.conversations[chatId] as ChatState | undefined;
            if (!conversation) return;
            conversation.botResponseStatus = status;
        },
        updateMessageProperty: <K extends keyof IChatMessage, V extends IChatMessage[K]>(
            state: ConversationsState,
            action: PayloadAction<{
                property: K;
                value: V;
                chatId: string;
                messageIdOrIndex: string | number;
                updatedContent?: string;
                frontLoad?: boolean;
            }>,
        ) => {
            const { property, value, messageIdOrIndex, chatId, updatedContent, frontLoad } = action.payload;
            // Conversation may have been archived/deleted - guard against edge cases
            const conversation = state.conversations[chatId] as ChatState | undefined;
            if (!conversation) return;

            const messageIndex =
                typeof messageIdOrIndex === 'number'
                    ? messageIdOrIndex
                    : conversation.messages.findIndex((m) => m.id === messageIdOrIndex);

            if (messageIndex === -1) {
                logger.warn(`⚠️ updateMessageProperty: Message ${messageIdOrIndex} not found in chat ${chatId}`);
                return;
            }

            const conversationMessage = conversation.messages[messageIndex];

            // Debug logging for update
            const oldVal = conversationMessage[property];
            logger.debug(`📝 Updating message[${messageIndex}].${String(property)}`, {
                messageId: conversationMessage.id,
                oldValue: typeof oldVal === 'string' ? oldVal.substring(0, 30) : oldVal,
                newValue: typeof value === 'string' ? value.substring(0, 30) : value,
            });

            conversationMessage[property] = value;
            if (updatedContent) {
                conversationMessage.content = updatedContent;
            }

            // Note: Immer handles immutability - no need to copy the array manually
            // The [...conversation.messages] copy was causing severe performance issues during streaming
            // React will detect changes because Immer creates new references for modified objects

            if (frontLoad) {
                frontLoadChat(state, chatId);
            }
        },
        deleteConversation: (state: ConversationsState, action: PayloadAction<string>) => {
            const id = action.payload;

            // If the conversation being deleted is the selected conversation, select the newest remaining conversation
            if (id === state.selectedId) {
                // Get all remaining conversations (excluding the one being deleted)
                const remainingConversations = Object.entries(state.conversations)
                    .filter(([chatId]) => chatId !== id)
                    .map(([chatId, chat]) => ({ chatId, chat }));

                if (remainingConversations.length > 0) {
                    // Sort by lastUpdatedTimestamp descending (newest first), fallback to first message timestamp
                    remainingConversations.sort((a, b) => {
                        const aTime = a.chat.lastUpdatedTimestamp ?? (a.chat.messages[0]?.timestamp || 0);
                        const bTime = b.chat.lastUpdatedTimestamp ?? (b.chat.messages[0]?.timestamp || 0);
                        return bTime - aTime; // Descending order (newest first)
                    });
                    state.selectedId = remainingConversations[0].chatId;
                } else {
                    state.selectedId = '';
                }
            }

            const { [id]: _, ...rest } = state.conversations;
            state.conversations = rest;
        },
        disableConversation: (state: ConversationsState, action: PayloadAction<string>) => {
            const id = action.payload;
            // Conversation may have been archived/deleted - guard against edge cases
            const conversation = state.conversations[id] as ChatState | undefined;
            if (!conversation) return;
            conversation.disabled = true;
            frontLoadChat(state, id);
        },
        updatePluginState: (state: ConversationsState, action: PayloadAction<UpdatePluginStatePayload>) => {
            const { id, pluginName, newState } = action.payload;
            // Conversation may have been archived/deleted - guard against edge cases
            const conversation = state.conversations[id] as ChatState | undefined;
            if (!conversation) return;
            const isPluginEnabled = conversation.enabledHostedPlugins.find((p) => p === pluginName);
            if (newState) {
                if (isPluginEnabled) {
                    return;
                }
                conversation.enabledHostedPlugins.push(pluginName);
            } else {
                if (!isPluginEnabled) {
                    return;
                }
                conversation.enabledHostedPlugins = conversation.enabledHostedPlugins.filter((p) => p !== pluginName);
            }
        },
    },
});

const frontLoadChat = (state: ConversationsState, id: string) => {
    // Conversation may have been archived/deleted - guard against edge cases
    const conversation = state.conversations[id] as ChatState | undefined;
    if (!conversation) return;
    const { [id]: _, ...rest } = state.conversations;
    state.conversations = { [id]: conversation, ...rest };
};

/**
 * Check if two messages are likely the same based on content matching.
 * Used as fallback when IDs don't match (client vs server generated IDs).
 * More lenient to catch duplicates across different scenarios.
 */
const areMessagesSimilar = (existing: IChatMessage, incoming: IChatMessage): boolean => {
    // Must have same user
    if (existing.userId !== incoming.userId) {
        return false;
    }

    // Compare content (trimmed to handle whitespace differences)
    const existingContent = existing.content.trim();
    const incomingContent = incoming.content.trim();
    if (existingContent !== incomingContent) {
        return false;
    }

    // Timestamps should be within 10 minutes of each other (more lenient)
    // This handles cases where:
    // - Server and client clocks are slightly different
    // - Message was sent, connection dropped, and synced later
    const timeDiff = Math.abs(existing.timestamp - incoming.timestamp);
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    return timeDiff <= TEN_MINUTES_MS;
};

const updateConversation = (state: ConversationsState, chatId: string, message: IChatMessage) => {
    // Safety check - conversation should exist but guard against edge cases
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const conversation = state.conversations[chatId] as ChatState | undefined;

    if (!conversation) {
        logger.warn(`⚠️ Cannot add message: chat ${chatId} not found`);
        return;
    }

    // Check for duplicate messages (prevent adding same message twice)
    // Check by ID first (fast path)
    if (message.id) {
        const existingById = conversation.messages.find((m) => m.id === message.id);
        if (existingById) {
            logger.debug(`ℹ️ Message ${message.id} already exists (ID match), skipping add`);
            return;
        }
    }

    // Also check by content similarity (handles client vs server ID mismatch)
    // This is important because:
    // - Client creates user message with ID like "user-123456-abc"
    // - Server saves it with a new GUID like "e4ae7118-..."
    // - When syncing, we need to detect these are the same message
    const existingByContent = conversation.messages.find((m) => areMessagesSimilar(m, message));
    if (existingByContent) {
        logger.debug(
            `ℹ️ Message already exists (content match): "${message.content.substring(0, 30)}..."` +
                ` | existing ID: ${existingByContent.id}, incoming ID: ${message.id}` +
                ` | existing timestamp: ${existingByContent.timestamp}, incoming: ${message.timestamp}`,
        );
        return;
    }

    const requestUserFeedback = message.userId === 'bot' && message.type === ChatMessageType.Message;
    const newMessage = {
        ...message,
        userFeedback: requestUserFeedback ? UserFeedback.Requested : undefined,
    };

    // Create a new messages array to ensure React detects the change
    conversation.messages = [...conversation.messages, newMessage];
    conversation.lastUpdatedTimestamp = message.timestamp;

    logger.debug(`✓ Message added to chat ${chatId}, total messages: ${conversation.messages.length}`);
    frontLoadChat(state, chatId);
};

const updateUserTypingState = (state: ConversationsState, userId: string, chatId: string, isTyping: boolean) => {
    // Conversation may have been archived/deleted - guard against edge cases
    const conversation = state.conversations[chatId] as ChatState | undefined;
    if (!conversation) return;
    const user = conversation.users.find((u) => u.id === userId);
    if (user) {
        user.isTyping = isTyping;
    }
};

export const {
    setConversations,
    editConversationTitle,
    editConversationInput,
    editConversationSystemDescription,
    editConversationMemoryBalance,
    editConversationModel,
    setSelectedConversation,
    toggleMultiUserConversations,
    addConversation,
    setImportingDocumentsToConversation,
    addMessageToConversationFromUser,
    addMessageToConversationFromServer,
    deleteMessageFromConversation,
    updateMessageProperty,
    updateUserIsTyping,
    updateUserIsTypingFromServer,
    updateBotResponseStatus,
    setUsersLoaded,
    setConversationMessages,
    deleteConversation,
    disableConversation,
    updatePluginState,
} = conversationsSlice.actions;

export default conversationsSlice.reducer;
