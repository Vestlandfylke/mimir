// Copyright (c) Microsoft. All rights reserved.

import { AuthConfig } from '../../../libs/auth/AuthHelper';
import { AlertType } from '../../../libs/models/AlertType';
import { IChatUser } from '../../../libs/models/ChatUser';
import { ServiceInfo } from '../../../libs/models/ServiceInfo';
import { TokenUsage } from '../../../libs/models/TokenUsage';

// This is the default user information when authentication is set to 'None'.
// It must match what is defined in PassthroughAuthenticationHandler.cs on the backend.
export const DefaultChatUser: IChatUser = {
    id: 'c05c61eb-65e4-4223-915a-fe72b0c9ece1',
    emailAddress: 'user@contoso.com',
    fullName: 'Default User',
    online: true,
    isTyping: false,
};

export const DefaultActiveUserInfo: ActiveUserInfo = {
    id: DefaultChatUser.id,
    email: DefaultChatUser.emailAddress,
    username: DefaultChatUser.fullName,
};

export interface ActiveUserInfo {
    id: string;
    email: string;
    username: string;
}

export interface Alert {
    message: string;
    type: AlertType;
    id?: string;
    onRetry?: () => void;
}

interface Feature {
    enabled: boolean; // Whether to show the feature in the UX
    label: string;
    inactive?: boolean; // Set to true if you don't want the user to control the visibility of this feature or there's no backend support
    description?: string;
}

export interface Setting {
    title: string;
    description?: string;
    features: FeatureKeys[];
    stackVertically?: boolean;
    learnMoreLink?: string;
}

export interface AppState {
    alerts: Alert[];
    activeUserInfo?: ActiveUserInfo;
    authConfig?: AuthConfig | null;
    tokenUsage: TokenUsage;
    features: Record<FeatureKeys, Feature>;
    settings: Setting[];
    serviceInfo: ServiceInfo;
    isMaintenance: boolean;
}

export enum FeatureKeys {
    DarkMode,
    SimplifiedExperience,
    PluginsPlannersAndPersonas,
    AzureContentSafety,
    AzureAISearch,
    BotAsDocs,
    MultiUserChat,
    RLHF, // Reinforcement Learning from Human Feedback
}

export const Features = {
    [FeatureKeys.DarkMode]: {
        enabled: false,
        label: 'Mørk modus',
    },
    [FeatureKeys.SimplifiedExperience]: {
        enabled: true,
        label: 'Forenkla pratoppleving',
    },
    [FeatureKeys.PluginsPlannersAndPersonas]: {
        enabled: true,
        label: 'Tillegg & Planleggjarar & Personar',
        description: 'Planar- og personflikkane er skjulte inntil du slår dette på',
    },
    [FeatureKeys.AzureContentSafety]: {
        enabled: false,
        label: 'Azure innhaldssikring',
        inactive: true,
    },
    [FeatureKeys.AzureAISearch]: {
        enabled: false,
        label: 'Azure AI-søk',
        inactive: true,
    },
    [FeatureKeys.BotAsDocs]: {
        enabled: false,
        label: 'Eksporter pratsesjonar',
    },
    [FeatureKeys.MultiUserChat]: {
        enabled: false,
        label: 'Deling av live pratsesjonar',
        description: 'Gjer det mogleg med flerbrukarpratsesjonar. Ikkje tilgjengeleg når autorisasjon er deaktivert.',
    },
    [FeatureKeys.RLHF]: {
        enabled: false,
        label: 'Forsterka læring frå menneskeleg tilbakemelding',
        description: 'Gjer det mogleg for brukarar å stemme på svar generert av modellen. Berre for demonstrasjonsformål.',
        // TODO: [Issue #42] Send og lagra tilbakemelding i backend
    },
};

export const Settings = [
    {
        // Grunnleggande innstillingar må stå først i indeksen. Legg alle nye innstillingar til slutten av arrayen.
        title: 'Grunnleggande',
        features: [FeatureKeys.DarkMode, FeatureKeys.PluginsPlannersAndPersonas],
        stackVertically: true,
    },
    {
        title: 'Visning',
        features: [FeatureKeys.SimplifiedExperience],
        stackVertically: true,
    },
    {
        title: 'Azure AI',
        features: [FeatureKeys.AzureContentSafety, FeatureKeys.AzureAISearch],
        stackVertically: true,
    },
    {
        title: 'Eksperimentell',
        description: 'Dei relaterte ikona og menyvalga er skjulte inntil du slår dette på',
        features: [FeatureKeys.BotAsDocs, FeatureKeys.MultiUserChat, FeatureKeys.RLHF],
    },
];

export const initialState: AppState = {
    alerts: [],
    activeUserInfo: DefaultActiveUserInfo,
    authConfig: {} as AuthConfig,
    tokenUsage: {},
    features: Features,
    settings: Settings,
    serviceInfo: {
        memoryStore: { types: [], selectedType: '' },
        availablePlugins: [],
        version: '',
        isContentSafetyEnabled: false,
    },
    isMaintenance: false,
};
