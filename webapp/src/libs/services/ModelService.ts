// Copyright (c) Microsoft. All rights reserved.

import { IAvailableModelsResponse, IChatModelResponse } from '../models/Model';
import { BaseService } from './BaseService';

/**
 * Service for managing AI model selection.
 */
export class ModelService extends BaseService {
    /**
     * Get all available AI models.
     */
    public getAvailableModelsAsync = async (accessToken?: string): Promise<IAvailableModelsResponse> => {
        return await this.getResponseAsync<IAvailableModelsResponse>(
            {
                commandPath: 'models',
                method: 'GET',
            },
            accessToken,
        );
    };

    /**
     * Get the current model for a chat session.
     */
    public getChatModelAsync = async (chatId: string, accessToken?: string): Promise<IChatModelResponse> => {
        return await this.getResponseAsync<IChatModelResponse>(
            {
                commandPath: `models/chat/${chatId}`,
                method: 'GET',
            },
            accessToken,
        );
    };

    /**
     * Set the model for a chat session.
     */
    public setChatModelAsync = async (
        chatId: string,
        modelId: string,
        accessToken?: string,
    ): Promise<IChatModelResponse> => {
        return await this.getResponseAsync<IChatModelResponse>(
            {
                commandPath: `models/chat/${chatId}`,
                method: 'PUT',
                body: { modelId },
            },
            accessToken,
        );
    };
}
