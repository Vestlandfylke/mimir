// Copyright (c) Microsoft. All rights reserved.

import { useMsal } from '@azure/msal-react';
import * as React from 'react';
import { useAppDispatch } from '../../redux/app/hooks';
import { editConversationModel } from '../../redux/features/conversations/conversationsSlice';
import { AuthHelper } from '../auth/AuthHelper';
import { IAvailableModelsResponse, IChatModelResponse, IModelInfo } from '../models/Model';
import { ModelService } from '../services/ModelService';

export const useModels = () => {
    const { instance, inProgress } = useMsal();
    const dispatch = useAppDispatch();
    const modelService = React.useMemo(() => new ModelService(), []);

    const [availableModels, setAvailableModels] = React.useState<IModelInfo[]>([]);
    const [defaultModelId, setDefaultModelId] = React.useState<string>('');
    const [isLoading, setIsLoading] = React.useState<boolean>(false);
    const [error, setError] = React.useState<string | null>(null);

    /**
     * Fetch available models from the backend.
     */
    const fetchAvailableModels = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const accessToken = await AuthHelper.getSKaaSAccessToken(instance, inProgress);
            const response: IAvailableModelsResponse = await modelService.getAvailableModelsAsync(accessToken);
            setAvailableModels(response.models);
            setDefaultModelId(response.defaultModelId);
        } catch (e) {
            setError(`Failed to fetch available models: ${(e as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    }, [instance, inProgress, modelService]);

    /**
     * Get the current model for a chat session.
     */
    const getChatModel = React.useCallback(
        async (chatId: string): Promise<IChatModelResponse | null> => {
            try {
                const accessToken = await AuthHelper.getSKaaSAccessToken(instance, inProgress);
                return await modelService.getChatModelAsync(chatId, accessToken);
            } catch (e) {
                setError(`Failed to get chat model: ${(e as Error).message}`);
                return null;
            }
        },
        [instance, inProgress, modelService],
    );

    /**
     * Set the model for a chat session.
     */
    const setChatModel = React.useCallback(
        async (chatId: string, modelId: string): Promise<boolean> => {
            try {
                const accessToken = await AuthHelper.getSKaaSAccessToken(instance, inProgress);
                const response = await modelService.setChatModelAsync(chatId, modelId, accessToken);
                // Update Redux state
                dispatch(editConversationModel({ id: chatId, modelId: response.modelId }));
                return true;
            } catch (e) {
                setError(`Failed to set chat model: ${(e as Error).message}`);
                return false;
            }
        },
        [instance, inProgress, modelService, dispatch],
    );

    /**
     * Get display info for a model by ID.
     */
    const getModelInfo = React.useCallback(
        (modelId: string | undefined): IModelInfo | undefined => {
            if (!modelId) {
                return availableModels.find((m) => m.id === defaultModelId);
            }
            return availableModels.find((m) => m.id === modelId);
        },
        [availableModels, defaultModelId],
    );

    return {
        availableModels,
        defaultModelId,
        isLoading,
        error,
        fetchAvailableModels,
        getChatModel,
        setChatModel,
        getModelInfo,
    };
};
