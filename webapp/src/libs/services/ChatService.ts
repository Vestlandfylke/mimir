// Copyright (c) Microsoft. All rights reserved.

import { Plugin } from '../../redux/features/plugins/PluginsState';
import { IArchivedChatSession } from '../models/ArchivedChatSession';
import { ChatMemorySource } from '../models/ChatMemorySource';
import { IChatMessage } from '../models/ChatMessage';
import { IChatParticipant } from '../models/ChatParticipant';
import { IChatSession, ICreateChatSessionResponse } from '../models/ChatSession';
import { IAvailableTemplate } from '../models/ChatTemplate';
import { IChatUser } from '../models/ChatUser';
import { ServiceInfo } from '../models/ServiceInfo';
import { IAsk, IAskVariables } from '../semantic-kernel/model/Ask';
import { IAskResult } from '../semantic-kernel/model/AskResult';
import { ICustomPlugin } from '../semantic-kernel/model/CustomPlugin';
import { BaseService } from './BaseService';

// The backend serializes DateTimeOffset as ISO strings by default.
// The webapp expects numeric timestamps (ms since epoch). Normalize on ingress.
type ApiChatMessage = Omit<IChatMessage, 'timestamp'> & { timestamp: string | number };

type ApiCreateChatSessionResponse = Omit<ICreateChatSessionResponse, 'initialBotMessage'> & {
    initialBotMessage: ApiChatMessage;
};

const coerceTimestampToMs = (value: string | number): number => {
    if (typeof value === 'number') return value;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const normalizeChatMessage = (m: ApiChatMessage): IChatMessage => {
    return {
        ...m,
        timestamp: coerceTimestampToMs(m.timestamp),
    };
};

export class ChatService extends BaseService {
    public createChatAsync = async (
        title: string,
        accessToken: string,
        template?: string,
    ): Promise<ICreateChatSessionResponse> => {
        const body: { title: string; template?: string } = {
            title,
        };

        if (template) {
            body.template = template;
        }

        const result = await this.getResponseAsync<ApiCreateChatSessionResponse>(
            {
                commandPath: 'chats',
                method: 'POST',
                body,
            },
            accessToken,
        );

        // Normalize the initial message timestamp for consistent sorting/UI.
        return {
            chatSession: result.chatSession,
            initialBotMessage: normalizeChatMessage(result.initialBotMessage),
        };
    };

    public getChatAsync = async (chatId: string, accessToken: string): Promise<IChatSession> => {
        const result = await this.getResponseAsync<IChatSession>(
            {
                commandPath: `chats/${chatId}`,
                method: 'GET',
            },
            accessToken,
        );

        return result;
    };

    public getAllChatsAsync = async (accessToken: string): Promise<IChatSession[]> => {
        const result = await this.getResponseAsync<IChatSession[]>(
            {
                commandPath: 'chats',
                method: 'GET',
            },
            accessToken,
        );
        return result;
    };

    public getChatMessagesAsync = async (
        chatId: string,
        skip: number,
        count: number,
        accessToken: string,
    ): Promise<IChatMessage[]> => {
        const result = await this.getResponseAsync<ApiChatMessage[]>(
            {
                commandPath: `chats/${chatId}/messages?skip=${skip}&count=${count}`,
                method: 'GET',
            },
            accessToken,
        );

        // Normalize timestamps before any sorting/reversing.
        const normalized = result.map(normalizeChatMessage);

        // Messages are returned with most recent message at index 0 and oldest message at the last index,
        // so we need to reverse the order for render
        return normalized.reverse();
    };

    public updateMessageAsync = async (
        chatId: string,
        messageId: string,
        content: string,
        accessToken: string,
    ): Promise<IChatMessage> => {
        const result = await this.getResponseAsync<ApiChatMessage>(
            {
                commandPath: `chats/${chatId}/messages/${messageId}`,
                method: 'PATCH',
                body: { content },
            },
            accessToken,
        );

        return normalizeChatMessage(result);
    };

    public editChatAsync = async (
        chatId: string,
        fields: { title?: string; systemDescription?: string; memoryBalance?: number },
        accessToken: string,
    ): Promise<any> => {
        const result = await this.getResponseAsync<IChatSession>(
            {
                commandPath: `chats/${chatId}`,
                method: 'PATCH',
                body: fields,
            },
            accessToken,
        );

        return result;
    };

    public deleteChatAsync = async (chatId: string, accessToken: string): Promise<object> => {
        const result = await this.getResponseAsync<object>(
            {
                commandPath: `chats/${chatId}`,
                method: 'DELETE',
            },
            accessToken,
        );

        return result;
    };

    public deleteMessageAsync = async (chatId: string, messageId: string, accessToken: string): Promise<void> => {
        await this.getResponseAsync<undefined>(
            {
                commandPath: `chats/${chatId}/messages/${messageId}`,
                method: 'DELETE',
            },
            accessToken,
        );
    };

    public getBotResponseAsync = async (
        ask: IAsk,
        accessToken: string,
        enabledPlugins?: Plugin[],
        processPlan = false,
        signal?: AbortSignal,
    ): Promise<IAskResult> => {
        // If function requires any additional api properties, append to context
        if (enabledPlugins && enabledPlugins.length > 0) {
            const openApiVariables: IAskVariables[] = [];

            // List of custom plugins to append to context variables
            const customPlugins: ICustomPlugin[] = [];

            for (const plugin of enabledPlugins) {
                // If user imported a manifest domain, add custom plugin
                if (plugin.manifestDomain) {
                    customPlugins.push({
                        nameForHuman: plugin.name,
                        nameForModel: plugin.nameForModel as string,
                        authHeaderTag: plugin.headerTag,
                        authType: plugin.authRequirements.personalAccessToken ? 'user_http' : 'none',
                        manifestDomain: plugin.manifestDomain,
                    });
                }

                // If functions requires any additional api properties, append to context variables
                if (plugin.apiProperties) {
                    const apiProperties = plugin.apiProperties;

                    for (const property in apiProperties) {
                        const propertyDetails = apiProperties[property];

                        if (propertyDetails.required && !propertyDetails.value) {
                            throw new Error(`Missing required property ${property} for ${plugin.name} plugin.`);
                        }

                        if (propertyDetails.value) {
                            openApiVariables.push({
                                key: property,
                                value: propertyDetails.value,
                            });
                        }
                    }
                }
            }

            if (customPlugins.length > 0) {
                openApiVariables.push({
                    key: `customPlugins`,
                    value: JSON.stringify(customPlugins),
                });
            }

            ask.variables = ask.variables ? ask.variables.concat(openApiVariables) : openApiVariables;
        }

        const chatId = ask.variables?.find((variable) => variable.key === 'chatId')?.value as string;

        const result = await this.getResponseAsync<IAskResult>(
            {
                commandPath: `chats/${chatId}/${processPlan ? 'plan' : 'messages'}`,
                method: 'POST',
                body: ask,
                signal,
            },
            accessToken,
            enabledPlugins,
        );

        return result;
    };

    public leaveChatAsync = async (chatId: string, accessToken: string): Promise<void> => {
        await this.getResponseAsync<undefined>(
            {
                commandPath: `chats/${chatId}/participants/me`,
                method: 'DELETE',
            },
            accessToken,
        );
    };

    public joinChatAsync = async (chatId: string, accessToken: string): Promise<IChatSession> => {
        await this.getResponseAsync<any>(
            {
                commandPath: `chats/${chatId}/participants`,
                method: 'POST',
            },
            accessToken,
        );

        return await this.getChatAsync(chatId, accessToken);
    };

    public getChatMemorySourcesAsync = async (chatId: string, accessToken: string): Promise<ChatMemorySource[]> => {
        const result = await this.getResponseAsync<ChatMemorySource[]>(
            {
                commandPath: `chats/${chatId}/documents`,
                method: 'GET',
            },
            accessToken,
        );

        return result;
    };

    public getAllChatParticipantsAsync = async (chatId: string, accessToken: string): Promise<IChatUser[]> => {
        const result = await this.getResponseAsync<IChatParticipant[]>(
            {
                commandPath: `chats/${chatId}/participants`,
                method: 'GET',
            },
            accessToken,
        );

        const chatUsers = result.map<IChatUser>((participant) => ({
            id: participant.userId,
            online: false,
            fullName: '', // The user's full name is not returned from the server
            emailAddress: '', // The user's email address is not returned from the server
            isTyping: false,
            photo: '',
        }));

        return chatUsers;
    };

    public getSemanticMemoriesAsync = async (
        chatId: string,
        memoryName: string,
        accessToken: string,
    ): Promise<string[]> => {
        const result = await this.getResponseAsync<string[]>(
            {
                commandPath: `chats/${chatId}/memories?type=${memoryName}`,
                method: 'GET',
            },
            accessToken,
        );

        return result;
    };

    public getServiceInfoAsync = async (accessToken: string): Promise<ServiceInfo> => {
        const result = await this.getResponseAsync<ServiceInfo>(
            {
                commandPath: `info`,
                method: 'GET',
            },
            accessToken,
        );

        return result;
    };

    /**
     * Cancel an in-progress chat request.
     * This will stop the LLM from generating further tokens and save costs.
     */
    public cancelChatAsync = async (
        chatId: string,
        accessToken: string,
    ): Promise<{ cancelled: boolean; chatId: string }> => {
        const result = await this.getResponseAsync<{ cancelled: boolean; chatId: string }>(
            {
                commandPath: `chats/${chatId}/cancel`,
                method: 'POST',
            },
            accessToken,
        );

        return result;
    };

    /**
     * Get available chat templates for the current user.
     * Templates may be restricted by Azure AD group membership.
     */
    public getAvailableTemplatesAsync = async (accessToken: string): Promise<IAvailableTemplate[]> => {
        const result = await this.getResponseAsync<IAvailableTemplate[]>(
            {
                commandPath: 'templates',
                method: 'GET',
            },
            accessToken,
        );

        return result;
    };

    /**
     * Get all archived (deleted) chats for the current user.
     */
    public getArchivedChatsAsync = async (accessToken?: string): Promise<IArchivedChatSession[]> => {
        const result = await this.getResponseAsync<IArchivedChatSession[]>(
            {
                commandPath: 'chats/trash',
                method: 'GET',
            },
            accessToken ?? '',
        );

        return result;
    };

    /**
     * Restore an archived chat back to active chats.
     */
    public restoreChatAsync = async (chatId: string, accessToken?: string): Promise<IChatSession> => {
        const result = await this.getResponseAsync<IChatSession>(
            {
                commandPath: `chats/${chatId}/restore`,
                method: 'POST',
            },
            accessToken ?? '',
        );

        return result;
    };

    /**
     * Permanently delete an archived chat. This cannot be undone.
     */
    public permanentlyDeleteChatAsync = async (chatId: string, accessToken?: string): Promise<void> => {
        await this.getResponseAsync<undefined>(
            {
                commandPath: `chats/${chatId}/permanent`,
                method: 'DELETE',
            },
            accessToken ?? '',
        );
    };
}
