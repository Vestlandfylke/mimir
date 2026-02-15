import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import ReactDOM from 'react-dom/client';
import { Provider as ReduxProvider } from 'react-redux';
import App from './App';
import './index.css';
import { AuthConfig, AuthHelper } from './libs/auth/AuthHelper';
import { store } from './redux/app/store';

import React from 'react';
import { teamsAuthHelper } from './libs/auth/TeamsAuthHelper';
import { BackendServiceUrl } from './libs/services/BaseService';
import { EmbeddedAppHelper } from './libs/utils/EmbeddedAppHelper';
import { logger } from './libs/utils/Logger';
import { setAuthConfig } from './redux/features/app/appSlice';

let container: HTMLElement | null = null;
let root: ReactDOM.Root | undefined = undefined;
let msalInstance: PublicClientApplication;

document.addEventListener('DOMContentLoaded', () => {
    if (!container) {
        container = document.getElementById('root');
        if (!container) {
            throw new Error('Could not find root element');
        }
        root = ReactDOM.createRoot(container);

        void initializeAndRenderApp();
    }
});

async function initializeAndRenderApp() {
    // Initialize Teams SDK FIRST if we're in Teams
    // This MUST happen before any other app initialization
    if (EmbeddedAppHelper.isInTeams()) {
        try {
            await teamsAuthHelper.initialize();
        } catch {
            // Teams SDK initialization failed - will fall back to standard auth
        }
    }

    renderApp();
}

// Use shared clearMsalCache from AuthHelper
const clearMsalCache = AuthHelper.clearMsalCache;

export function renderApp() {
    fetch(new URL('authConfig', BackendServiceUrl))
        .then((response) => (response.ok ? (response.json() as Promise<AuthConfig>) : Promise.reject()))
        .then(async (authConfig: AuthConfig) => {
            store.dispatch(setAuthConfig(authConfig));

            if (AuthHelper.isAuthAAD()) {
                try {
                    msalInstance = new PublicClientApplication(AuthHelper.getMsalConfig(authConfig));
                    await msalInstance.initialize();

                    // Handle redirect promise (for redirect-based auth)
                    void msalInstance
                        .handleRedirectPromise()
                        .then((response) => {
                            if (response) {
                                msalInstance.setActiveAccount(response.account);
                                // Clear recovery flag on successful auth
                                AuthHelper.clearRecoveryFlag();
                            }
                        })
                        .catch((error) => {
                            // If redirect handling fails, clear cache and let user re-authenticate
                            logger.warn('MSAL redirect handling failed, clearing cache:', error);
                            clearMsalCache();
                        });

                    // Attempt silent SSO on startup
                    await AuthHelper.initializeAndAttemptSso(msalInstance);

                    // render with the MsalProvider if AAD is enabled
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    root!.render(
                        <React.StrictMode>
                            <ReduxProvider store={store}>
                                <MsalProvider instance={msalInstance}>
                                    <App />
                                </MsalProvider>
                            </ReduxProvider>
                        </React.StrictMode>,
                    );
                } catch (error) {
                    // MSAL initialization failed - likely corrupted cache
                    logger.error('MSAL initialization failed, clearing cache and retrying:', error);
                    clearMsalCache();

                    // Retry initialization after clearing cache
                    try {
                        msalInstance = new PublicClientApplication(AuthHelper.getMsalConfig(authConfig));
                        await msalInstance.initialize();

                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        root!.render(
                            <React.StrictMode>
                                <ReduxProvider store={store}>
                                    <MsalProvider instance={msalInstance}>
                                        <App />
                                    </MsalProvider>
                                </ReduxProvider>
                            </React.StrictMode>,
                        );
                    } catch (retryError) {
                        logger.error('MSAL initialization failed after retry:', retryError);
                        // Render without MSAL - user will need to log in again
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        root!.render(
                            <React.StrictMode>
                                <ReduxProvider store={store}>
                                    <App />
                                </ReduxProvider>
                            </React.StrictMode>,
                        );
                    }
                }
            }
        })
        .catch(() => {
            store.dispatch(setAuthConfig(undefined));
        });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    root!.render(
        <React.StrictMode>
            <ReduxProvider store={store}>
                <App />
            </ReduxProvider>
        </React.StrictMode>,
    );
}
