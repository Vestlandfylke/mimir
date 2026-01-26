import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import ReactDOM from 'react-dom/client';
import { Provider as ReduxProvider } from 'react-redux';
import App from './App';
import { Constants } from './Constants';
import './index.css';
import { AuthConfig, AuthHelper } from './libs/auth/AuthHelper';
import { store } from './redux/app/store';

import React from 'react';
import { teamsAuthHelper } from './libs/auth/TeamsAuthHelper';
import { BackendServiceUrl } from './libs/services/BaseService';
import { EmbeddedAppHelper } from './libs/utils/EmbeddedAppHelper';
import { logger } from './libs/utils/Logger';
import { setAuthConfig } from './redux/features/app/appSlice';

if (!localStorage.getItem('debug')) {
    localStorage.setItem('debug', `${Constants.debug.root}:*`);
}

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
        logger.debug('Detected Teams context, initializing Teams SDK...');
        try {
            const teamsInitSuccess = await teamsAuthHelper.initialize();
            if (teamsInitSuccess) {
                logger.debug('Teams SDK initialized successfully');
            } else {
                logger.warn('Teams SDK initialization failed');
            }
        } catch (error) {
            logger.error('Error initializing Teams SDK:', error);
        }
    }

    renderApp();
}

export function renderApp() {
    // Log the app context for debugging (only in development)
    logger.info(`Mimir running in: ${EmbeddedAppHelper.getAppContext()}`);
    logger.info(`Auth method: ${Constants.msal.method}`);
    logger.info(`Is in Teams: ${EmbeddedAppHelper.isInTeams()}`);

    fetch(new URL('authConfig', BackendServiceUrl))
        .then((response) => (response.ok ? (response.json() as Promise<AuthConfig>) : Promise.reject()))
        .then(async (authConfig: AuthConfig) => {
            store.dispatch(setAuthConfig(authConfig));

            if (AuthHelper.isAuthAAD()) {
                msalInstance = new PublicClientApplication(AuthHelper.getMsalConfig(authConfig));
                await msalInstance.initialize();

                // Handle redirect promise (for redirect-based auth)
                const redirectResponse = await msalInstance.handleRedirectPromise();
                if (redirectResponse) {
                    msalInstance.setActiveAccount(redirectResponse.account);
                    logger.debug('Authentication successful via redirect');
                }

                // Ensure an active account is set if we have any accounts
                if (!msalInstance.getActiveAccount()) {
                    const accounts = msalInstance.getAllAccounts();
                    if (accounts.length > 0) {
                        msalInstance.setActiveAccount(accounts[0]);
                        logger.debug('Set active account from cache:', accounts[0].username);
                    }
                }

                // Attempt silent SSO in background (don't block render)
                logger.debug('Attempting silent SSO...');
                void AuthHelper.initializeAndAttemptSso(msalInstance).then((ssoAccount) => {
                    if (ssoAccount) {
                        logger.debug('Silent SSO successful:', ssoAccount.username);
                    } else {
                        logger.debug('Silent SSO not available - user will need to login interactively');
                    }
                });

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
            } else {
                // render without MsalProvider if AAD is not enabled
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                root!.render(
                    <React.StrictMode>
                        <ReduxProvider store={store}>
                            <App />
                        </ReduxProvider>
                    </React.StrictMode>,
                );
            }
        })
        .catch(() => {
            store.dispatch(setAuthConfig(undefined));
            // render without MsalProvider on auth config fetch failure
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            root!.render(
                <React.StrictMode>
                    <ReduxProvider store={store}>
                        <App />
                    </ReduxProvider>
                </React.StrictMode>,
            );
        });
}
