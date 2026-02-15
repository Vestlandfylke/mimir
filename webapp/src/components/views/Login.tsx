// Copyright (c) Microsoft. All rights reserved.

import { useMsal } from '@azure/msal-react';
import { Body1, Button, makeStyles, Spinner, tokens } from '@fluentui/react-components';
import React, { useEffect, useState } from 'react';
import logoDark from '../../assets/sidestilt-logo-kvit-skrift-vlfk.svg';
import logo from '../../assets/sidestilt-logo-vlfk.svg';
import { AuthHelper } from '../../libs/auth/AuthHelper';
import { teamsAuthHelper } from '../../libs/auth/TeamsAuthHelper';
import { EmbeddedAppHelper } from '../../libs/utils/EmbeddedAppHelper';
import { logger } from '../../libs/utils/Logger';
import { useAppSelector } from '../../redux/app/hooks';
import { RootState } from '../../redux/app/store';
import { FeatureKeys } from '../../redux/features/app/AppState';
import { getErrorDetails } from '../utils/TextUtils';

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
        width: '180px',
        height: 'auto',
        marginBottom: tokens.spacingVerticalL,
    },
    title: {
        fontSize: '32px',
        fontWeight: '600',
        color: tokens.colorNeutralForeground1,
        marginBottom: tokens.spacingVerticalS,
    },
    subtitle: {
        fontSize: '18px',
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
        fontWeight: '600',
    },
    loginButton: {
        backgroundColor: tokens.colorBrandBackground,
        color: '#1a1a1a',
        padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalXXL}`,
        fontSize: '15px',
        fontWeight: '500',
        borderRadius: tokens.borderRadiusMedium,
        ':hover': {
            backgroundColor: tokens.colorBrandBackgroundHover,
            color: '#1a1a1a',
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
    const { features } = useAppSelector((state: RootState) => state.app);
    const isDarkMode = features[FeatureKeys.DarkMode].enabled;
    const currentLogo = isDarkMode ? logoDark : logo;

    const handleLoginError = (e: unknown) => {
        // Check if this is a recoverable MSAL cache error
        if (AuthHelper.isMsalCacheError(e)) {
            logger.warn('Login: Detected MSAL cache error, attempting auto-recovery...', e);
            const recoveryInitiated = AuthHelper.attemptCacheRecovery();
            if (recoveryInitiated) {
                // Page will reload - show a message while that happens
                setSilentAuthMessage('Ryddar opp i innloggingsdata...');
                return;
            }
            // Recovery already attempted once - show error to user
            logger.error('Login: Auto-recovery already attempted, showing error to user');
        }

        const context = EmbeddedAppHelper.getAppContext();
        setSilentAuthInProgress(false);
        alert(`Feil ved innlogging (${context}): ${getErrorDetails(e)}`);
    };

    const handleLogin = () => {
        setSilentAuthInProgress(true);
        setSilentAuthMessage('Logger inn...');

        void AuthHelper.loginAsync(instance).catch(handleLoginError);
    };

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
                                .catch(handleLoginError);
                        } catch (teamsError) {
                            logger.error('Login component: Teams auth error:', teamsError);
                            setSilentAuthInProgress(false);
                        }
                    } else {
                        setSilentAuthInProgress(false);
                    }
                }
            } catch (error) {
                // Check if this is a recoverable MSAL cache error
                if (AuthHelper.isMsalCacheError(error)) {
                    logger.warn(
                        'Login component: Detected MSAL cache error during silent auth, attempting recovery...',
                    );
                    const recoveryInitiated = AuthHelper.attemptCacheRecovery();
                    if (recoveryInitiated) {
                        setSilentAuthMessage('Ryddar opp i innloggingsdata...');
                        return;
                    }
                }
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instance, onTeamsAuthSuccess]);

    return (
        <div className={classes.container}>
            <div className={classes.backgroundPattern} />
            <div className={classes.content}>
                <img src={currentLogo} alt="Vestland fylkeskommune" className={classes.logo} />
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
