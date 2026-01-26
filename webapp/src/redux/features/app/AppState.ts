// Copyright (c) Microsoft. All rights reserved.

import { AuthConfig } from '../../../libs/auth/AuthHelper';
import { AlertType } from '../../../libs/models/AlertType';
import { IAvailableTemplate } from '../../../libs/models/ChatTemplate';
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
    /** Custom label for the retry button (default: "Prøv igjen") */
    retryLabel?: string;
    /** Show a "Oppdater sida" button that refreshes the page */
    showRefresh?: boolean;
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
    connectionReconnected: boolean; // Flag to trigger message sync after reconnection
    availableTemplates: IAvailableTemplate[]; // Specialized assistants available to the user
    isChatManagementModalOpen: boolean; // Flag to show chat management modal when at chat limit
    brandColor: BrandColorKey; // Selected brand/accent color
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

// Load dark mode preference from localStorage
const getSavedDarkModePreference = (): boolean => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('mimir-dark-mode');
    return saved === 'true';
};

// Available brand colors from Vestland design guide
export const BrandColors = {
    cyan: { hex: '#9ADBE8', name: 'Cyan' },
    pink: { hex: '#E06287', name: 'Rosa' },
    purple: { hex: '#CAA2DD', name: 'Lilla' },
    lime: { hex: '#E1D555', name: 'Limegrøn' },
    teal: { hex: '#00C7B1', name: 'Turkis' },
    olive: { hex: '#B7DD79', name: 'Olivengrøn' },
    yellow: { hex: '#FDDA25', name: 'Gul' },
    red: { hex: '#FF5C39', name: 'Raud' },
    green: { hex: '#50A684', name: 'Grøn' },
    mint: { hex: '#3CDBC0', name: 'Mint' },
    orange: { hex: '#FF9E1B', name: 'Oransje' },
    salmon: { hex: '#F8B5C4', name: 'Lakserosa' },
    tealblue: { hex: '#0088A3', name: 'Havblå' },
    petrol: { hex: '#006D8F', name: 'Petrol' },
} as const;

export type BrandColorKey = keyof typeof BrandColors;

// Get default brand color (cyan for both light and dark mode)
export const getDefaultBrandColor = (): BrandColorKey => {
    return 'cyan';
};

// Load brand color preference from localStorage
const getSavedBrandColor = (): BrandColorKey => {
    if (typeof window === 'undefined') return 'cyan';
    const saved = localStorage.getItem('mimir-brand-color');
    if (saved && saved in BrandColors) {
        return saved as BrandColorKey;
    }
    return getDefaultBrandColor();
};

export const Features = {
    [FeatureKeys.DarkMode]: {
        enabled: getSavedDarkModePreference(),
        label: 'Mørk modus',
    },
    [FeatureKeys.SimplifiedExperience]: {
        enabled: true,
        label: 'Forenkla pratoppleving',
    },
    [FeatureKeys.PluginsPlannersAndPersonas]: {
        enabled: true,
        label: 'Planar & Tilpassing',
        description: 'Planar- og tilpassingsflikkane er skjulte inntil du slår dette på',
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
        enabled: true,
        label: 'Eksporter pratsesjonar',
    },
    [FeatureKeys.MultiUserChat]: {
        enabled: true,
        label: 'Deling av live pratsesjonar',
        description: 'Gjer det mogleg med flerbrukarpratsesjonar. Ikkje tilgjengeleg når autorisasjon er deaktivert.',
    },
    [FeatureKeys.RLHF]: {
        enabled: false,
        label: 'Forsterka læring frå menneskeleg tilbakemelding',
        description:
            'Gjer det mogleg for brukarar å stemme på svar generert av modellen. Berre for demonstrasjonsformål.',
        // TODO: [Issue #42] Send og lagra tilbakemelding i backend
    },
};

export const Settings = [
    {
        // Grunnleggande innstillingar må stå først i indeksen. Legg alle nye innstillingar til slutten av arrayen.
        title: 'Grunnleggande',
        features: [FeatureKeys.DarkMode],
        stackVertically: true,
    },
    {
        title: 'Visning',
        features: [FeatureKeys.SimplifiedExperience],
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
    connectionReconnected: false,
    availableTemplates: [],
    isChatManagementModalOpen: false,
    brandColor: getSavedBrandColor(),
};
