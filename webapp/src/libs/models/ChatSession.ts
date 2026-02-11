// Copyright (c) Microsoft. All rights reserved.

import { IChatMessage } from './ChatMessage';

export interface IChatSession {
    id: string;
    title: string;
    systemDescription: string;
    memoryBalance: number;
    enabledPlugins: string[];
    modelId?: string;
    createdOn?: string | number; // Timestamp from backend (ISO string or ms)
    createdBy?: string; // User ID of the chat creator (null for old chats)
}

export interface ICreateChatSessionResponse {
    chatSession: IChatSession;
    initialBotMessage: IChatMessage;
}
