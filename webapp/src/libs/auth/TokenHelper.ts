import {
    IPublicClientApplication,
    InteractionRequiredAuthError,
    InteractionStatus,
    PopupRequest,
} from '@azure/msal-browser';
import { Constants } from '../../Constants';
import { AuthHelper } from './AuthHelper';

enum TokenErrors {
    InteractionInProgress = 'interaction_in_progress',
}

/*
 * This implementation follows incremental consent, and token acquisition is limited to one
 * resource at a time (scopes), but user can consent to many resources upfront (extraScopesToConsent)
 *
 * @param silentOnly - If true, will not trigger interactive auth (popup/redirect) on failure.
 *                     Use this for background operations where you don't want to interrupt the user.
 */
export const getAccessTokenUsingMsal = async (
    inProgress: InteractionStatus,
    msalInstance: IPublicClientApplication,
    scopes: string[],
    extraScopesToConsent?: string[],
    silentOnly = false,
) => {
    const account = msalInstance.getActiveAccount();

    // If no account and silentOnly, return empty string (caller should handle gracefully)
    if (!account && silentOnly) {
        return '';
    }

    // If no account and not silentOnly, throw error (will trigger login flow)
    if (!account) {
        throw new Error('No active account - user needs to login');
    }

    const authority = AuthHelper.getAuthConfig()?.aadAuthority;
    const accessTokenRequest: PopupRequest = {
        authority,
        scopes,
        extraScopesToConsent,
        account,
    };

    return await acquireToken(accessTokenRequest, msalInstance, inProgress, silentOnly).catch(async (e) => {
        if (e instanceof Error && e.message === (TokenErrors.InteractionInProgress as string)) {
            return await interactionInProgressHandler(inProgress, msalInstance, accessTokenRequest, silentOnly);
        }

        throw e;
    });
};

const acquireToken = async (
    accessTokenRequest: PopupRequest,
    msalInstance: IPublicClientApplication,
    interactionStatus: InteractionStatus,
    silentOnly = false,
) => {
    return await msalInstance
        .acquireTokenSilent(accessTokenRequest)
        .then(function (accessTokenResponse) {
            // Acquire token silent success
            return accessTokenResponse.accessToken;
        })
        .catch(async (error) => {
            if (error instanceof InteractionRequiredAuthError) {
                // If silentOnly mode, don't trigger interactive auth - just return empty string
                if (silentOnly) {
                    return '';
                }

                // Since app can trigger concurrent interactive requests, first check
                // if any other interaction is in progress proper to invoking a new one
                if (interactionStatus !== InteractionStatus.None) {
                    // throw a new error to be handled in the caller above
                    throw new Error(TokenErrors.InteractionInProgress);
                } else {
                    // Use the configured auth method (popup or redirect)
                    if (Constants.msal.method === 'redirect') {
                        // For redirect, we need to redirect the user - this won't return
                        await msalInstance.acquireTokenRedirect({ ...accessTokenRequest });
                        // This line won't be reached, but TypeScript needs a return
                        throw new Error('Redirecting for authentication...');
                    } else {
                        return await msalInstance
                            .acquireTokenPopup({ ...accessTokenRequest })
                            .then(function (accessTokenResponse) {
                                // Acquire token interactive success
                                return accessTokenResponse.accessToken;
                            })
                            .catch(function (error) {
                                // Acquire token interactive failure
                                throw new Error(`Received error while retrieving access token: ${error as string}`);
                            });
                    }
                }
            }
            throw new Error(`Received error while retrieving access token: ${error as string}`);
        });
};

const interactionInProgressHandler = async (
    interactionStatus: InteractionStatus,
    msalInstance: IPublicClientApplication,
    accessTokenRequest: PopupRequest,
    silentOnly = false,
) => {
    // Polls the interaction status from the application
    // state and resolves when it's equal to "None".
    waitFor(() => interactionStatus === InteractionStatus.None);

    // Wait is over, call acquireToken again to re-try acquireTokenSilent
    return await acquireToken(accessTokenRequest, msalInstance, interactionStatus, silentOnly);
};

const waitFor = (hasInteractionCompleted: () => boolean) => {
    const checkInteraction = () => {
        if (!hasInteractionCompleted()) {
            setTimeout(checkInteraction, 500);
        }
    };

    checkInteraction();
};

export const TokenHelper = {
    getAccessTokenUsingMsal,
};
