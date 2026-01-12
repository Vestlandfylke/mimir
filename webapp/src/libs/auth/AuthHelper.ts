// Copyright (c) Microsoft. All rights reserved.

import {
    Configuration,
    EndSessionRequest,
    IPublicClientApplication,
    InteractionStatus,
    LogLevel,
    AccountInfo,
} from '@azure/msal-browser';
import debug from 'debug';
import { Constants } from '../../Constants';
import { store } from '../../redux/app/store';
import { TokenHelper } from './TokenHelper';
import { EmbeddedAppHelper } from '../utils/EmbeddedAppHelper';
import { teamsAuthHelper } from './TeamsAuthHelper';

const log = debug(Constants.debug.root).extend('authHelper');

export const enum AuthType {
    None = 'None',
    AAD = 'AzureAd',
}

export interface AuthConfig {
    authType: AuthType;
    aadAuthority: string;
    aadClientId: string;
    aadApiScope: string;
}

const getMsalConfig = (authConfig: AuthConfig): Configuration => ({
    auth: {
        clientId: authConfig.aadClientId,
        authority: authConfig.aadAuthority,
        redirectUri: window.origin,
    },
    cache: Constants.msal.cache,
    system: {
        loggerOptions: {
            loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
                if (containsPii) {
                    return;
                }
                switch (level) {
                    case LogLevel.Error:
                        log('error:', message);
                        return;
                    case LogLevel.Info:
                        log('info:', message);
                        return;
                    case LogLevel.Verbose:
                        log('verbose:', message);
                        return;
                    case LogLevel.Warning:
                        log('warn:', message);
                        return;
                    default:
                        log(message);
                }
            },
        },
        windowHashTimeout: 9000, // Applies just to popup calls - In milliseconds
        iframeHashTimeout: 9000, // Applies just to silent calls - In milliseconds
        loadFrameTimeout: 9000, // Applies to both silent and popup calls - In milliseconds
    },
});

const getMsalScopes = () => {
    const aadApiScope = getAuthConfig()?.aadApiScope;
    return Constants.msal.semanticKernelScopes.concat(aadApiScope ?? []);
};

const logoutRequest: EndSessionRequest = {
    postLogoutRedirectUri: window.origin,
};

const ssoSilentRequest = async (msalInstance: IPublicClientApplication) => {
    await msalInstance.ssoSilent({
        account: msalInstance.getActiveAccount() ?? undefined,
        scopes: getMsalScopes(),
    });
};

/**
 * Attempt silent authentication first, fallback to interactive
 * This provides the best user experience across all contexts
 */
const loginAsync = async (instance: IPublicClientApplication) => {
    const scopes = getMsalScopes();

    log('Starting authentication flow...');

    // Step 1: Try silent authentication first
    const silentSuccess = await attemptSilentLogin(instance);
    if (silentSuccess) {
        log('Silent authentication successful');
        return;
    }

    log('Silent authentication failed, proceeding with interactive login');

    // Step 2: If in Teams, first try Teams SSO, then MSAL popup
    if (EmbeddedAppHelper.isInTeams()) {
        log('In Teams context, attempting Teams SSO first...');

        // Initialize Teams SDK
        await teamsAuthHelper.initialize();

        // Try Teams SSO (silent)
        const ssoResult = await teamsAuthHelper.attemptSilentSso(scopes);
        if (ssoResult.success && ssoResult.token) {
            log('Teams SSO successful, storing token for API calls');
            // Store the Teams SSO token for use in API calls
            // The backend should accept this token via the Authorization header
            sessionStorage.setItem('teamsToken', ssoResult.token);

            // Try to get MSAL account using the SSO hint
            try {
                const context = await teamsAuthHelper.getContext();
                if (context?.user?.loginHint) {
                    log('Attempting MSAL silent with Teams login hint:', context.user.loginHint);
                    const response = await instance.ssoSilent({
                        scopes,
                        loginHint: context.user.loginHint,
                    });
                    instance.setActiveAccount(response.account);
                    log('MSAL SSO with Teams hint successful');
                    return;
                }
            } catch (msalError) {
                log('MSAL SSO with Teams hint failed, falling back to popup:', msalError);
            }
        }

        // Fallback: Use MSAL popup in Teams (redirect doesn't work in iframes)
        log('Using MSAL popup for Teams authentication');
        try {
            const response = await instance.loginPopup({
                scopes,
                extraScopesToConsent: Constants.msal.msGraphAppScopes,
            });
            instance.setActiveAccount(response.account);
            log('MSAL popup authentication successful in Teams');
            return;
        } catch (popupError) {
            log('MSAL popup failed in Teams:', popupError);
            throw new Error(
                `Teams authentication failed: ${popupError instanceof Error ? popupError.message : 'Unknown error'}`,
            );
        }
    }

    // Step 3: Standard browser authentication
    if (Constants.msal.method === 'redirect') {
        await instance.loginRedirect({
            scopes,
            extraScopesToConsent: Constants.msal.msGraphAppScopes,
        });
    } else {
        await instance.loginPopup({
            scopes,
            extraScopesToConsent: Constants.msal.msGraphAppScopes,
        });
    }
};

/**
 * Attempt silent authentication without user interaction
 * Returns true if successful, false if interactive login is needed
 */
const attemptSilentLogin = async (instance: IPublicClientApplication): Promise<boolean> => {
    try {
        log('Attempting silent authentication...');

        // Try to get account from cache
        const accounts = instance.getAllAccounts();
        if (accounts.length === 0) {
            log('No cached accounts found');
            return false;
        }

        // Use the first account (or active account if set)
        const account = instance.getActiveAccount() ?? accounts[0];
        log('Found cached account:', account.username);

        // Attempt silent token acquisition
        const response = await instance.acquireTokenSilent({
            scopes: getMsalScopes(),
            account: account,
        });

        instance.setActiveAccount(response.account);
        log('Silent token acquisition successful');
        return true;
    } catch (error) {
        log('Silent authentication failed:', error);
        return false;
    }
};

/**
 * Initialize and attempt silent SSO (for Teams and browser)
 */
const initializeAndAttemptSso = async (instance: IPublicClientApplication): Promise<AccountInfo | null> => {
    try {
        // If in Teams, try Teams SSO first
        if (EmbeddedAppHelper.isInTeams()) {
            log('Initializing Teams SSO...');
            await teamsAuthHelper.initialize();

            const result = await teamsAuthHelper.attemptSilentSso(getMsalScopes());
            if (result.success && result.token) {
                log('Teams SSO successful');
                // Note: You might need to exchange this token with your backend
                // For now, we'll continue with MSAL silent flow
            }
        }

        // Try MSAL silent authentication
        const accounts = instance.getAllAccounts();
        if (accounts.length > 0) {
            const account = instance.getActiveAccount() ?? accounts[0];

            const response = await instance.acquireTokenSilent({
                scopes: getMsalScopes(),
                account: account,
            });

            instance.setActiveAccount(response.account);
            return response.account;
        }

        return null;
    } catch (error) {
        log('SSO initialization failed:', error);
        return null;
    }
};

const logoutAsync = (instance: IPublicClientApplication) => {
    if (Constants.msal.method === 'popup') {
        void instance.logoutPopup(logoutRequest);
    }
    if (Constants.msal.method === 'redirect') {
        void instance.logoutRedirect(logoutRequest);
    }
};

const getAuthConfig = () => store.getState().app.authConfig;
const isAuthAAD = () => getAuthConfig()?.authType === AuthType.AAD;

// SKaaS = Semantic Kernel as a Service
// Gets token with scopes to authorize SKaaS specifically
const getSKaaSAccessToken = async (instance: IPublicClientApplication, inProgress: InteractionStatus) => {
    return isAuthAAD() ? await TokenHelper.getAccessTokenUsingMsal(inProgress, instance, getMsalScopes()) : '';
};

export const AuthHelper = {
    getSKaaSAccessToken,
    getMsalConfig,
    getMsalScopes,
    logoutRequest,
    ssoSilentRequest,
    loginAsync,
    logoutAsync,
    isAuthAAD,
    getAuthConfig,
    attemptSilentLogin,
    initializeAndAttemptSso,
};
