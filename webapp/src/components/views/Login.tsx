// Copyright (c) Microsoft. All rights reserved.

import { useMsal } from '@azure/msal-react';
import { Body1, Button, makeStyles, Spinner, tokens } from '@fluentui/react-components';
import React, { useEffect, useState } from 'react';
import { AuthHelper } from '../../libs/auth/AuthHelper';
import { teamsAuthHelper } from '../../libs/auth/TeamsAuthHelper';
import { EmbeddedAppHelper } from '../../libs/utils/EmbeddedAppHelper';
import { logger } from '../../libs/utils/Logger';
import { getErrorDetails } from '../utils/TextUtils';
import logo from '../../assets/sidestilt-logo-vlfk.svg';

interface LoginProps {
    onTeamsAuthSuccess?: () => void;
}

const useClasses = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        background: `linear-gradient(135deg, ${tokens.colorNeutralBackground1} 0%, ${tokens.colorNeutralBackground3} 100%)`,
        position: 'relative',
        overflow: 'hidden',
    },
    backgroundPattern: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.03,
        backgroundImage: `radial-gradient(circle at 25% 25%, ${tokens.colorBrandBackground} 2px, transparent 2px),
                         radial-gradient(circle at 75% 75%, ${tokens.colorBrandBackground} 2px, transparent 2px)`,
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 1,
        maxWidth: '420px',
        textAlign: 'center',
        padding: tokens.spacingHorizontalXXL,
    },
    logo: {
        width: '120px',
        height: 'auto',
        marginBottom: tokens.spacingVerticalL,
    },
    title: {
        fontSize: '28px',
        fontWeight: '600',
        color: tokens.colorNeutralForeground1,
        marginBottom: tokens.spacingVerticalS,
    },
    subtitle: {
        fontSize: '14px',
        color: tokens.colorNeutralForeground3,
        marginBottom: tokens.spacingVerticalXXL,
        lineHeight: '1.5',
    },
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: tokens.spacingVerticalM,
    },
    loadingText: {
        fontSize: '13px',
        color: tokens.colorNeutralForeground3,
    },
    loginButton: {
        backgroundColor: tokens.colorBrandBackground,
        color: tokens.colorNeutralForegroundOnBrand,
        padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalXXL}`,
        fontSize: '15px',
        fontWeight: '500',
        borderRadius: tokens.borderRadiusMedium,
        ':hover': {
            backgroundColor: tokens.colorBrandBackgroundHover,
        },
    },
    embeddedNote: {
        marginTop: tokens.spacingVerticalXL,
        fontSize: '11px',
        color: tokens.colorNeutralForeground4,
    },
});

export const Login: React.FC<LoginProps> = ({ onTeamsAuthSuccess }) => {
    const { instance } = useMsal();
    const classes = useClasses();
    const [silentAuthInProgress, setSilentAuthInProgress] = useState(true);
    const [silentAuthMessage, setSilentAuthMessage] = useState('Logger inn...');

    // Attempt silent authentication when component mounts
    useEffect(() => {
        const attemptSilentAuth = async () => {
            try {
                logger.debug('Login component: Attempting silent authentication...');
                setSilentAuthInProgress(true);
                setSilentAuthMessage('Logger inn...');

                const success = await AuthHelper.attemptSilentLogin(instance);

                if (success) {
                    logger.debug('Login component: Silent authentication successful');
                    setSilentAuthMessage('Velkommen tilbake!');
                    // The app will automatically redirect once authentication is detected
                } else {
                    logger.debug('Login component: Silent authentication not available');

                    // If we are in Teams, try Teams SSO
                    if (EmbeddedAppHelper.isInTeams()) {
                        logger.debug('Login component: In Teams, attempting Teams SSO...');
                        setSilentAuthMessage('Logger inn via Teams...');

                        try {
                            // Initialize Teams SDK
                            const initialized = await teamsAuthHelper.initialize();
                            if (initialized) {
                                // Try Teams SSO
                                const ssoResult = await teamsAuthHelper.attemptSilentSso([]);
                                if (ssoResult.success && ssoResult.token) {
                                    logger.debug('Login component: Teams SSO successful!');
                                    sessionStorage.setItem('teamsToken', ssoResult.token);
                                    setSilentAuthMessage('Velkommen tilbake!');

                                    // Notify parent that Teams auth succeeded
                                    if (onTeamsAuthSuccess) {
                                        onTeamsAuthSuccess();
                                    }
                                    return;
                                }
                            }

                            // If Teams SSO failed, try the full Teams auth flow
                            logger.debug('Login component: Teams SSO failed, trying full auth flow...');
                            void AuthHelper.loginAsync(instance)
                                .then(() => {
                                    // Check if we got a Teams token
                                    const teamsToken = sessionStorage.getItem('teamsToken');
                                    if (teamsToken && onTeamsAuthSuccess) {
                                        onTeamsAuthSuccess();
                                    }
                                })
                                .catch((e: unknown) => {
                                    const context = EmbeddedAppHelper.getAppContext();
                                    setSilentAuthInProgress(false);
                                    alert(`Feil ved innlogging (${context}): ${getErrorDetails(e)}`);
                                });
                        } catch (teamsError) {
                            logger.error('Login component: Teams auth error:', teamsError);
                            setSilentAuthInProgress(false);
                        }
                    } else {
                        setSilentAuthInProgress(false);
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
        }, 300);

        return () => {
            clearTimeout(timer);
        };
    }, [instance, onTeamsAuthSuccess]);

    const handleLogin = () => {
        setSilentAuthInProgress(true);
        setSilentAuthMessage('Logger inn...');

        void AuthHelper.loginAsync(instance).catch((e: unknown) => {
            const context = EmbeddedAppHelper.getAppContext();
            setSilentAuthInProgress(false);
            alert(`Feil ved innlogging (${context}): ${getErrorDetails(e)}`);
        });
    };

    return (
        <div className={classes.container}>
            <div className={classes.backgroundPattern} />
            <div className={classes.content}>
                <img src={logo} alt="Vestland fylkeskommune" className={classes.logo} />
                <h1 className={classes.title}>Mimir</h1>
                <p className={classes.subtitle}>KI-assistent for Vestland fylkeskommune</p>

                {silentAuthInProgress ? (
                    <div className={classes.loadingContainer}>
                        <Spinner size="medium" />
                        <span className={classes.loadingText}>{silentAuthMessage}</span>
                    </div>
                ) : (
                    <Button
                        className={classes.loginButton}
                        appearance="primary"
                        onClick={handleLogin}
                        data-testid="signinButton"
                    >
                        Logg inn med Microsoft
                    </Button>
                )}

                {EmbeddedAppHelper.isInIframe() && (
                    <Body1 className={classes.embeddedNote}>Køyrer i {EmbeddedAppHelper.getAppContext()}</Body1>
                )}
            </div>
        </div>
    );
};
