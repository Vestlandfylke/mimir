// Copyright (c) Microsoft. All rights reserved.

/**
 * Information about an available AI model.
 */
export interface IModelInfo {
    /** Unique identifier for the model */
    id: string;
    /** Display name shown in the UI */
    displayName: string;
    /** Description of the model's capabilities */
    description: string;
    /** Provider type (e.g., "AzureOpenAI", "AzureAnthropic") */
    provider: string;
    /** Icon identifier for UI display */
    icon?: string;
    /** Maximum completion tokens for this model */
    maxCompletionTokens: number;
    /** Whether this model supports reasoning/thinking output */
    supportsReasoning?: boolean;
    /** Reasoning effort level (low, medium, high) */
    reasoningEffort?: string;
}

/**
 * Response containing available AI models.
 */
export interface IAvailableModelsResponse {
    /** List of available models */
    models: IModelInfo[];
    /** The default model ID */
    defaultModelId: string;
}

/**
 * Response with the model configuration for a chat.
 */
export interface IChatModelResponse {
    /** The chat session ID */
    chatId: string;
    /** The selected model ID */
    modelId: string;
    /** Display name of the model */
    modelDisplayName: string;
    /** Provider type of the model */
    modelProvider: string;
}
