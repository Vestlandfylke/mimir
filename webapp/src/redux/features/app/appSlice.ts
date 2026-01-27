// Copyright (c) Microsoft. All rights reserved.

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Constants } from '../../../Constants';
import { IAvailableTemplate } from '../../../libs/models/ChatTemplate';
import { ServiceInfo } from '../../../libs/models/ServiceInfo';
import { TokenUsage, TokenUsageFunctionNameMap } from '../../../libs/models/TokenUsage';
import { ActiveUserInfo, Alert, AppState, BrandColorKey, FeatureKeys, initialState, ServiceError } from './AppState';

export const appSlice = createSlice({
    name: 'app',
    initialState,
    reducers: {
        setMaintenance: (state: AppState, action: PayloadAction<boolean>) => {
            state.isMaintenance = action.payload;
        },
        setAlerts: (state: AppState, action: PayloadAction<Alert[]>) => {
            state.alerts = action.payload;
        },
        addAlert: (state: AppState, action: PayloadAction<Alert>) => {
            if (
                action.payload.id == Constants.app.CONNECTION_ALERT_ID ||
                isServerConnectionError(action.payload.message)
            ) {
                updateConnectionStatus(state, action.payload);
            } else {
                addNewAlert(state.alerts, action.payload);
            }
        },
        removeAlert: (state: AppState, action: PayloadAction<number>) => {
            state.alerts.splice(action.payload, 1);
        },
        removeAlertById: (state: AppState, action: PayloadAction<string>) => {
            const alertIndex = state.alerts.findIndex((alert) => alert.id === action.payload);
            if (alertIndex !== -1) {
                state.alerts.splice(alertIndex, 1);
            }
        },
        setActiveUserInfo: (state: AppState, action: PayloadAction<ActiveUserInfo>) => {
            state.activeUserInfo = action.payload;
        },
        updateTokenUsage: (state: AppState, action: PayloadAction<TokenUsage>) => {
            Object.keys(TokenUsageFunctionNameMap).forEach((key) => {
                action.payload[key] = getTotalTokenUsage(state.tokenUsage[key], action.payload[key]);
            });
            state.tokenUsage = action.payload;
        },
        // This sets the feature flag based on end user input
        toggleFeatureFlag: (state: AppState, action: PayloadAction<FeatureKeys>) => {
            const feature = state.features[action.payload];
            const newEnabled = !feature.enabled;

            state.features = {
                ...state.features,
                [action.payload]: {
                    ...feature,
                    enabled: newEnabled,
                },
            };

            // Persist dark mode preference to localStorage
            if (action.payload === FeatureKeys.DarkMode) {
                try {
                    localStorage.setItem('mimir-dark-mode', String(newEnabled));
                } catch {
                    // localStorage might be unavailable in some contexts
                }
            }
        },
        // This controls feature availability based on the state of backend
        toggleFeatureState: (
            state: AppState,
            action: PayloadAction<{
                feature: FeatureKeys;
                deactivate: boolean;
                enable: boolean;
            }>,
        ) => {
            const feature = state.features[action.payload.feature];
            state.features = {
                ...state.features,
                [action.payload.feature]: {
                    ...feature,
                    enabled: action.payload.deactivate ? false : action.payload.enable,
                    inactive: action.payload.deactivate,
                },
            };
        },
        setServiceInfo: (state: AppState, action: PayloadAction<ServiceInfo>) => {
            state.serviceInfo = action.payload;
        },
        setAuthConfig: (state: AppState, action: PayloadAction<AppState['authConfig']>) => {
            state.authConfig = action.payload;
        },
        setConnectionReconnected: (state: AppState, action: PayloadAction<boolean>) => {
            state.connectionReconnected = action.payload;
        },
        setAvailableTemplates: (state: AppState, action: PayloadAction<IAvailableTemplate[]>) => {
            state.availableTemplates = action.payload;
        },
        setChatManagementModalOpen: (state: AppState, action: PayloadAction<boolean>) => {
            state.isChatManagementModalOpen = action.payload;
        },
        setBrandColor: (state: AppState, action: PayloadAction<BrandColorKey>) => {
            state.brandColor = action.payload;
            // Persist to localStorage
            try {
                localStorage.setItem('mimir-brand-color', action.payload);
            } catch {
                // localStorage might be unavailable in some contexts
            }
        },
        setServiceError: (state: AppState, action: PayloadAction<ServiceError>) => {
            state.serviceError = action.payload;
        },
        clearServiceError: (state: AppState) => {
            state.serviceError = undefined;
        },
    },
});

export const {
    addAlert,
    removeAlert,
    removeAlertById,
    setAlerts,
    setActiveUserInfo,
    toggleFeatureFlag,
    toggleFeatureState,
    updateTokenUsage,
    setServiceInfo,
    setMaintenance,
    setAuthConfig,
    setConnectionReconnected,
    setAvailableTemplates,
    setChatManagementModalOpen,
    setBrandColor,
    setServiceError,
    clearServiceError,
} = appSlice.actions;

export default appSlice.reducer;

const getTotalTokenUsage = (previousSum?: number, current?: number) => {
    if (previousSum === undefined) {
        return current;
    }
    if (current === undefined) {
        return previousSum;
    }

    return previousSum + current;
};

const isServerConnectionError = (message: string) => {
    return (
        message.includes(`Cannot send data if the connection is not in the 'Connected' State.`) ||
        message.includes(`Server timeout elapsed without receiving a message from the server.`)
    );
};

const addNewAlert = (alerts: Alert[], newAlert: Alert) => {
    if (alerts.length === 3) {
        alerts.shift();
    }

    alerts.push(newAlert);
};

const updateConnectionStatus = (state: AppState, statusUpdate: Alert) => {
    if (isServerConnectionError(statusUpdate.message)) {
        // Constant message so alert UI doesn't feel glitchy on every connection error from SignalR
        statusUpdate.message = 'Tilkoplinga vart avbroten.';
        statusUpdate.showRefresh = true;
    }

    // There should only ever be one connection alert at a time,
    // so we tag the alert with a unique ID so we can remove if needed
    statusUpdate.id ??= Constants.app.CONNECTION_ALERT_ID;

    // Remove the existing connection alert if it exists
    const connectionAlertIndex = state.alerts.findIndex((alert) => alert.id === Constants.app.CONNECTION_ALERT_ID);
    if (connectionAlertIndex !== -1) {
        state.alerts.splice(connectionAlertIndex, 1);
    }

    addNewAlert(state.alerts, statusUpdate);
};
