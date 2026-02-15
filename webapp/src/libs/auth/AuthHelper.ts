// Copyright (c) Microsoft. All rights reserved.

import {
    AccountInfo,
    Configuration,
    EndSessionRequest,
    IPublicClientApplication,
    InteractionStatus,
    LogLevel,
} from '@azure/msal-browser';
import debug from 'debug';
import { Constants } from '../../Constants';
import { store } from '../../redux/app/store';
import { EmbeddedAppHelper } from '../utils/EmbeddedAppHelper';
import { teamsAuthHelper } from './TeamsAuthHelper';
import { TokenHelper } from './TokenHelper';

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
                // Only log errors and warnings to reduce console noise
                switch (level) {
                    case LogLevel.Error:
                        log('error:', message);
                        return;
                    case LogLevel.Warning:
                        log('warn:', message);
                        return;
                    default:
                        // Suppress Info and Verbose logs
                        return;
                }
            },
            logLevel: LogLevel.Warning, // Only log Warning and above
        },
        windowHashTimeout: 15000, // Applies just to popup calls - In milliseconds
        iframeHashTimeout: 15000, // Applies just to silent calls - In milliseconds
        loadFrameTimeout: 15000, // Applies to both silent and popup calls - In milliseconds
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

    // Step 2: If in Teams, use Teams-specific authentication flow
    if (EmbeddedAppHelper.isInTeams()) {
        log('In Teams context, starting Teams authentication flow...');

        // Initialize Teams SDK
        const teamsInitialized = await teamsAuthHelper.initialize();
        if (!teamsInitialized) {
            log('Teams SDK failed to initialize, falling back to standard auth');
        } else {
            // Try Teams SSO (silent) first
            const ssoResult = await teamsAuthHelper.attemptSilentSso(scopes);
            if (ssoResult.success && ssoResult.token) {
                log('Teams SSO successful, trying to get MSAL account...');
                sessionStorage.setItem('teamsToken', ssoResult.token);

                // Try to get MSAL account using the SSO hint from Teams context
                try {
                    const context = await teamsAuthHelper.getContext();
                    if (context?.user?.loginHint) {
                        log('Attempting MSAL ssoSilent with Teams login hint:', context.user.loginHint);
                        const response = await instance.ssoSilent({
                            scopes,
                            loginHint: context.user.loginHint,
                        });
                        instance.setActiveAccount(response.account);
                        log('MSAL SSO with Teams hint successful');
                        return;
                    }
                } catch (msalError) {
                    log('MSAL ssoSilent with Teams hint failed:', msalError);
                }
            }

            // Fallback: Use Teams SDK authentication (opens popup via Teams API, not window.open)
            log('Using Teams SDK interactive authentication...');
            try {
                const teamsAuthResult = await teamsAuthHelper.authenticateInteractive(instance, scopes);
                if (teamsAuthResult.success && teamsAuthResult.token) {
                    log('Teams interactive authentication successful');
                    // Store the token for API calls
                    sessionStorage.setItem('teamsToken', teamsAuthResult.token);
                    log('Stored Teams token from interactive auth');
                    return;
                } else {
                    log('Teams interactive auth failed:', teamsAuthResult.error);
                }
            } catch (teamsError) {
                log('Teams SDK authentication error:', teamsError);
            }
        }

        // Final fallback: Try MSAL popup (may fail if Teams blocks it)
        log('Attempting MSAL popup as final fallback...');
        try {
            const response = await instance.loginPopup({
                scopes,
                extraScopesToConsent: Constants.msal.msGraphAppScopes,
            });
            instance.setActiveAccount(response.account);
            log('MSAL popup authentication successful in Teams');
            return;
        } catch (popupError) {
            log('MSAL popup failed in Teams (expected - Teams blocks popups):', popupError);
            throw new Error(
                `Teams authentication failed. Please try refreshing the page or use Teams in a browser. Error: ${popupError instanceof Error ? popupError.message : 'Popup blocked'}`,
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

// Check if a JWT token is expired (with 5 minute buffer)
const isTokenExpired = (token: string): boolean => {
    try {
        // JWT tokens are base64 encoded: header.payload.signature
        const payload = token.split('.')[1];
        if (!payload) return true;

        const decoded = JSON.parse(atob(payload)) as { exp?: number };
        const exp = decoded.exp;
        if (!exp) return true;

        // Check if token expires within 5 minutes (300 seconds buffer)
        const now = Math.floor(Date.now() / 1000);
        const isExpired = exp < now + 300;

        if (isExpired) {
            log(
                'Token is expired or expiring soon. Exp:',
                new Date(exp * 1000).toISOString(),
                'Now:',
                new Date(now * 1000).toISOString(),
            );
        }

        return isExpired;
    } catch (error) {
        log('Error checking token expiration:', error);
        return true; // Assume expired if we can't parse
    }
};

// SKaaS = Semantic Kernel as a Service
// Gets token with scopes to authorize SKaaS specifically
const getSKaaSAccessToken = async (instance: IPublicClientApplication, inProgress: InteractionStatus) => {
    if (!isAuthAAD()) {
        return '';
    }

    // In Teams context, try to use Teams SSO token first
    if (EmbeddedAppHelper.isInTeams()) {
        // Check if we have a stored Teams token that is still valid
        const teamsToken = sessionStorage.getItem('teamsToken');
        if (teamsToken && !isTokenExpired(teamsToken)) {
            log('Using stored Teams SSO token for API call');
            return teamsToken;
        }

        // Token is missing or expired, clear it and get a fresh one
        if (teamsToken) {
            log('Stored Teams token is expired, getting fresh token');
            sessionStorage.removeItem('teamsToken');
        }

        // Try to get a fresh Teams SSO token
        try {
            const initialized = await teamsAuthHelper.initialize();
            if (initialized) {
                const result = await teamsAuthHelper.attemptSilentSso(getMsalScopes());
                if (result.success && result.token) {
                    log('Got fresh Teams SSO token for API call');
                    sessionStorage.setItem('teamsToken', result.token);
                    return result.token;
                }
            }
        } catch (teamsError) {
            log('Failed to get Teams SSO token, falling back to MSAL:', teamsError);
        }
    }

    // Fall back to MSAL token
    return await TokenHelper.getAccessTokenUsingMsal(inProgress, instance, getMsalScopes());
};

/**
 * Clear MSAL cache from localStorage and sessionStorage.
 * This helps recover from corrupted auth state that causes errors like
 * "stubbed_public_client_application_called".
 */
const clearMsalCache = () => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
            key &&
            (key.startsWith('msal.') || key.includes('login.windows.net') || key.includes('login.microsoftonline.com'))
        ) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach((key) => {
        localStorage.removeItem(key);
    });

    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (
            key &&
            (key.startsWith('msal.') || key.includes('login.windows.net') || key.includes('login.microsoftonline.com'))
        ) {
            sessionKeysToRemove.push(key);
        }
    }
    sessionKeysToRemove.forEach((key) => {
        sessionStorage.removeItem(key);
    });

    log('MSAL cache cleared from localStorage and sessionStorage');
};

/**
 * Check if an error is a recoverable MSAL cache error that can be fixed
 * by clearing the browser cache and reloading.
 */
const isMsalCacheError = (error: unknown): boolean => {
    const errorString = error instanceof Error ? error.message : String(error);
    const cacheErrorPatterns = [
        'stubbed_public_client_application_called',
        'uninitialized_public_client_application',
        'BrowserAuthError',
    ];
    return cacheErrorPatterns.some((pattern) => errorString.toLowerCase().includes(pattern.toLowerCase()));
};

const MSAL_RECOVERY_KEY = 'msal_cache_recovery_attempted';

/**
 * Attempt auto-recovery from MSAL cache errors by clearing cache and reloading.
 * Returns true if recovery was initiated (page will reload), false if already attempted.
 */
const attemptCacheRecovery = (): boolean => {
    // Prevent infinite reload loops - only try once
    const alreadyAttempted = sessionStorage.getItem(MSAL_RECOVERY_KEY);
    if (alreadyAttempted) {
        log('MSAL cache recovery already attempted this session, skipping auto-recovery');
        sessionStorage.removeItem(MSAL_RECOVERY_KEY);
        return false;
    }

    log('Attempting MSAL cache recovery: clearing cache and reloading...');
    sessionStorage.setItem(MSAL_RECOVERY_KEY, 'true');
    clearMsalCache();
    window.location.reload();
    return true;
};

/**
 * Clear the recovery flag after a successful login.
 * Call this when authentication succeeds to reset the recovery state.
 */
const clearRecoveryFlag = () => {
    sessionStorage.removeItem(MSAL_RECOVERY_KEY);
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
    clearMsalCache,
    isMsalCacheError,
    attemptCacheRecovery,
    clearRecoveryFlag,
};
