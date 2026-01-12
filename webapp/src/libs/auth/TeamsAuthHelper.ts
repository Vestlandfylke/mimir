// Copyright (c) Microsoft. All rights reserved.
// Teams-specific authentication helper with SSO support

import { app, authentication } from '@microsoft/teams-js';
import { IPublicClientApplication } from '@azure/msal-browser';
import debug from 'debug';
import { Constants } from '../../Constants';
import { store } from '../../redux/app/store';

const log = debug(Constants.debug.root).extend('teamsAuth');

export interface TeamsAuthResult {
    success: boolean;
    token?: string;
    error?: string;
    isSilent: boolean;
}

class TeamsAuthHelper {
    private initialized = false;
    private initializationPromise: Promise<boolean> | null = null;

    /**
     * Initialize Teams SDK
     * Must be called before any Teams operations
     */
    async initialize(): Promise<boolean> {
        if (this.initialized) {
            return true;
        }

        // Return existing promise if initialization is in progress
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = (async () => {
            try {
                log('Initializing Teams SDK...');
                await app.initialize();
                this.initialized = true;
                log('Teams SDK initialized successfully');
                return true;
            } catch (error) {
                log('Failed to initialize Teams SDK:', error);
                this.initialized = false;
                return false;
            }
        })();

        return this.initializationPromise;
    }

    /**
     * Check if Teams SDK is available and initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Attempt silent SSO authentication in Teams
     * This uses the user's Teams token without any UI
     */
    async attemptSilentSso(scopes: string[]): Promise<TeamsAuthResult> {
        if (!this.initialized) {
            const initSuccess = await this.initialize();
            if (!initSuccess) {
                return {
                    success: false,
                    error: 'Teams SDK not available',
                    isSilent: true,
                };
            }
        }

        try {
            log('Attempting silent SSO with scopes:', scopes);

            const token = await authentication.getAuthToken({
                silent: true,
                // Teams will only prompt if absolutely necessary
                // This keeps the experience as silent as possible
            });

            log('Silent SSO successful');
            return {
                success: true,
                token,
                isSilent: true,
            };
        } catch (error) {
            log('Silent SSO failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Silent authentication failed',
                isSilent: true,
            };
        }
    }

    /**
     * Interactive authentication for Teams (fallback when SSO fails)
     * Opens authentication popup within Teams
     */
    async authenticateInteractive(_msalInstance: IPublicClientApplication, scopes: string[]): Promise<TeamsAuthResult> {
        if (!this.initialized) {
            const initSuccess = await this.initialize();
            if (!initSuccess) {
                return {
                    success: false,
                    error: 'Teams SDK not available',
                    isSilent: false,
                };
            }
        }

        try {
            log('Starting interactive Teams authentication...');

            // Get auth config from store
            const authConfig = store.getState().app.authConfig;
            if (!authConfig) {
                return {
                    success: false,
                    error: 'Auth configuration not available',
                    isSilent: false,
                };
            }

            // Build URL with OAuth parameters for auth-start.html
            const authStartUrl = new URL(`${window.location.origin}/auth-start.html`);
            authStartUrl.searchParams.set('clientId', authConfig.aadClientId);
            authStartUrl.searchParams.set('authority', authConfig.aadAuthority);
            authStartUrl.searchParams.set('scope', scopes.join(' '));
            authStartUrl.searchParams.set('redirectUri', `${window.location.origin}/auth-end.html`);

            log('Auth start URL:', authStartUrl.toString());

            // Use Teams authentication API to open popup
            const result = await authentication.authenticate({
                url: authStartUrl.toString(),
                width: 600,
                height: 535,
            });

            log('Interactive authentication successful');
            return {
                success: true,
                token: result,
                isSilent: false,
            };
        } catch (error) {
            log('Interactive authentication failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Interactive authentication failed',
                isSilent: false,
            };
        }
    }

    /**
     * Complete authentication flow - try silent first, fallback to interactive
     */
    async authenticate(msalInstance: IPublicClientApplication, scopes: string[]): Promise<TeamsAuthResult> {
        log('Starting Teams authentication flow...');

        // Step 1: Try silent SSO first
        const silentResult = await this.attemptSilentSso(scopes);
        if (silentResult.success) {
            log('Authentication completed via silent SSO');
            return silentResult;
        }

        log('Silent SSO failed, falling back to interactive auth');

        // Step 2: If silent fails, use interactive
        const interactiveResult = await this.authenticateInteractive(msalInstance, scopes);
        return interactiveResult;
    }

    /**
     * Get Teams context (user info, team info, etc.)
     */
    async getContext() {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const context = await app.getContext();
            log('Teams context:', context);
            return context;
        } catch (error) {
            log('Failed to get Teams context:', error);
            return null;
        }
    }

    /**
     * Notify Teams that auth was successful
     */
    notifySuccess(result?: string) {
        if (this.initialized) {
            authentication.notifySuccess(result);
        }
    }

    /**
     * Notify Teams that auth failed
     */
    notifyFailure(reason: string) {
        if (this.initialized) {
            authentication.notifyFailure(reason);
        }
    }
}

// Export singleton instance
export const teamsAuthHelper = new TeamsAuthHelper();
