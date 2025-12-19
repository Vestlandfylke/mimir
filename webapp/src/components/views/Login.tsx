// Copyright (c) Microsoft. All rights reserved.

import { useMsal } from '@azure/msal-react';
import { Body1, Button, Image, Spinner, Title3 } from '@fluentui/react-components';
import React, { useEffect, useState } from 'react';
import { AuthHelper } from '../../libs/auth/AuthHelper';
import { EmbeddedAppHelper } from '../../libs/utils/EmbeddedAppHelper';
import { logger } from '../../libs/utils/Logger';
import signInLogo from '../../ms-symbollockup_signin_light.png';
import { useSharedClasses } from '../../styles';
import { getErrorDetails } from '../utils/TextUtils';

export const Login: React.FC = () => {
    const { instance } = useMsal();
    const classes = useSharedClasses();
    const [silentAuthInProgress, setSilentAuthInProgress] = useState(true);
    const [silentAuthMessage, setSilentAuthMessage] = useState('Prøver automatisk pålogging...');

    // Attempt silent authentication when component mounts
    useEffect(() => {
        const attemptSilentAuth = async () => {
            try {
                logger.debug('Login component: Attempting silent authentication...');
                setSilentAuthInProgress(true);
                setSilentAuthMessage('Prøver automatisk pålogging...');

                const success = await AuthHelper.attemptSilentLogin(instance);

                if (success) {
                    logger.debug('Login component: Silent authentication successful');
                    setSilentAuthMessage('Pålogging vellykket! Laster inn...');
                    // The app will automatically redirect once authentication is detected
                } else {
                    logger.debug('Login component: Silent authentication not available');
                    setSilentAuthInProgress(false);

                    // If we are in Teams (desktop/web) and silent SSO failed, kick off Teams auth immediately.
                    // This fixes the desktop case where the login button isn't clickable.
                    if (EmbeddedAppHelper.isInTeams()) {
                        logger.debug('Login component: In Teams and silent SSO failed, starting Teams auth');
                        setSilentAuthInProgress(true);
                        setSilentAuthMessage('Logger inn via Teams...');
                        void AuthHelper.loginAsync(instance).catch((e: unknown) => {
                            const context = EmbeddedAppHelper.getAppContext();
                            setSilentAuthInProgress(false);
                            alert(`Feil ved innlogging (${context}): ${getErrorDetails(e)}`);
                        });
                    }
                }
            } catch (error) {
                logger.error('Login component: Silent authentication error:', error);
                setSilentAuthInProgress(false);
            }
        };

        // Add a small delay to avoid flickering if auth is very fast
        const timer = setTimeout(() => {
            void attemptSilentAuth();
        }, 500);

        return () => {
            clearTimeout(timer);
        };
    }, [instance]);

    const handleLogin = () => {
        setSilentAuthInProgress(true);
        setSilentAuthMessage('Logger inn...');

        // Use the dynamic authentication method (popup for iframes, redirect for browser)
        // Note: We don't await here to avoid Promise return type (React onClick expects void)
        void AuthHelper.loginAsync(instance).catch((e: unknown) => {
            const context = EmbeddedAppHelper.getAppContext();
            setSilentAuthInProgress(false);
            alert(`Feil ved innlogging (${context}): ${getErrorDetails(e)}`);
        });
    };

    return (
        <div className={classes.informativeView}>
            <Title3>Velkommen til Mimir</Title3>
            <Body1>
                Den klokaste av alle gudar i norrøn mytologi! Mimir voktar kunnskapens brønn under Yggdrasil, og no har
                du tilgang til visdommen hans.
                <br />
                <br />
                Mimir er her for å gi deg verdifulle råd og innsikt – akkurat som han gjorde for Odin.
            </Body1>

            {silentAuthInProgress ? (
                <div style={{ marginTop: '30px', textAlign: 'center' }}>
                    <Spinner size="large" label={silentAuthMessage} />
                </div>
            ) : (
                <Button
                    style={{ padding: 0, marginTop: '20px' }}
                    appearance="transparent"
                    onClick={handleLogin}
                    data-testid="signinButton"
                >
                    <Image src={signInLogo} />
                </Button>
            )}

            {EmbeddedAppHelper.isInIframe() && (
                <Body1 style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
                    Køyrer i innebygd modus ({EmbeddedAppHelper.getAppContext()})
                </Body1>
            )}
        </div>
    );
};
