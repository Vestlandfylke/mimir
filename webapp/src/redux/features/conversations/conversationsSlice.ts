// Copyright (c) Microsoft. All rights reserved.

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatMessageType, IChatMessage, UserFeedback } from '../../../libs/models/ChatMessage';
import { IChatUser } from '../../../libs/models/ChatUser';
import { logger } from '../../../libs/utils/Logger';
import { ChatState } from './ChatState';
import {
    ConversationInputChange,
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
            state.conversations[chatId].users.push(user);
            state.conversations[chatId].userDataLoaded = false;
        },
        setImportingDocumentsToConversation: (
            state: ConversationsState,
            action: PayloadAction<{ importingDocuments: string[]; chatId: string }>,
        ) => {
            const { importingDocuments, chatId } = action.payload;
            state.conversations[chatId].importingDocuments = importingDocuments;
        },
        setUsersLoaded: (state: ConversationsState, action: PayloadAction<string>) => {
            state.conversations[action.payload].userDataLoaded = true;
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
            const conversation = state.conversations[chatId];
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
            const conversation = state.conversations[chatId];

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

            // Force a new array reference to ensure React detects the change
            conversation.messages = [...conversation.messages];

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
            state.conversations[id].disabled = true;
            frontLoadChat(state, id);
            return;
        },
        updatePluginState: (state: ConversationsState, action: PayloadAction<UpdatePluginStatePayload>) => {
            const { id, pluginName, newState } = action.payload;
            const isPluginEnabled = state.conversations[id].enabledHostedPlugins.find((p) => p === pluginName);
            if (newState) {
                if (isPluginEnabled) {
                    return;
                }
                state.conversations[id].enabledHostedPlugins.push(pluginName);
            } else {
                if (!isPluginEnabled) {
                    return;
                }
                state.conversations[id].enabledHostedPlugins = state.conversations[id].enabledHostedPlugins.filter(
                    (p) => p !== pluginName,
                );
            }
        },
    },
});

const frontLoadChat = (state: ConversationsState, id: string) => {
    const conversation = state.conversations[id];
    const { [id]: _, ...rest } = state.conversations;
    state.conversations = { [id]: conversation, ...rest };
};

const updateConversation = (state: ConversationsState, chatId: string, message: IChatMessage) => {
    const conversation = state.conversations[chatId];

    // Check for duplicate messages (prevent adding same message twice)
    // Only check if message has an ID - messages without ID are always added
    if (message.id) {
        const existingMessage = conversation.messages.find((m) => m.id === message.id);
        if (existingMessage) {
            logger.debug(`ℹ️ Message ${message.id} already exists, skipping add`);
            return;
        }
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
    const conversation = state.conversations[chatId];
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
    setSelectedConversation,
    toggleMultiUserConversations,
    addConversation,
    setImportingDocumentsToConversation,
    addMessageToConversationFromUser,
    addMessageToConversationFromServer,
    updateMessageProperty,
    updateUserIsTyping,
    updateUserIsTypingFromServer,
    updateBotResponseStatus,
    setUsersLoaded,
    deleteConversation,
    disableConversation,
    updatePluginState,
} = conversationsSlice.actions;

export default conversationsSlice.reducer;
