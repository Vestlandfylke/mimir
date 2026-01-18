import { AuthenticatedTemplate, UnauthenticatedTemplate, useIsAuthenticated, useMsal } from '@azure/msal-react';
import { FluentProvider, makeStyles, shorthands, tokens } from '@fluentui/react-components';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import Chat from './components/chat/Chat';
import { LoadingOverlay, Login } from './components/views';
import { AuthHelper } from './libs/auth/AuthHelper';
import { teamsAuthHelper } from './libs/auth/TeamsAuthHelper';
import { useChat, useFile } from './libs/hooks';
import { AlertType } from './libs/models/AlertType';
import { EmbeddedAppHelper } from './libs/utils/EmbeddedAppHelper';
import { logger } from './libs/utils/Logger';
import { useAppDispatch, useAppSelector } from './redux/app/hooks';
import { RootState } from './redux/app/store';
import { FeatureKeys } from './redux/features/app/AppState';
import { addAlert, setActiveUserInfo, setServiceInfo } from './redux/features/app/appSlice';
import { semanticKernelDarkTheme, semanticKernelLightTheme } from './styles';

export const useClasses = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh', // Fallback for older browsers
        // @ts-expect-error dvh is valid CSS but not in types yet
        height: '100dvh', // Dynamic viewport height - accounts for mobile browser chrome
        width: '100%',
        ...shorthands.overflow('hidden'),
        // Ensure the container doesn't exceed the viewport
        maxHeight: '100vh',
        // @ts-expect-error dvh is valid CSS but not in types yet
        maxHeight: '100dvh',
    },
    header: {
        alignItems: 'center',
        backgroundColor: tokens.colorBrandForeground2,
        color: tokens.colorNeutralForegroundOnBrand,
        display: 'flex',
        '& h1': {
            paddingLeft: tokens.spacingHorizontalXL,
            display: 'flex',
        },
        height: '48px',
        minHeight: '48px', // Prevent header from shrinking
        flexShrink: 0, // Never shrink the header
        justifyContent: 'space-between',
        width: '100%',
    },
    persona: {
        marginRight: tokens.spacingHorizontalXXL,
    },
    cornerItems: {
        display: 'flex',
        ...shorthands.gap(tokens.spacingHorizontalS),
    },
});

export enum AppState {
    ProbeForBackend,
    SettingUserInfo,
    ErrorLoadingChats,
    ErrorLoadingUserInfo,
    LoadChats,
    LoadingChats,
    Chat,
    SigningOut,
}

const App = () => {
    const classes = useClasses();
    const [appState, setAppState] = React.useState(AppState.ProbeForBackend);
    const [isTeamsAuthenticated, setIsTeamsAuthenticated] = useState(false);
    const dispatch = useAppDispatch();
    const { instance } = useMsal();
    const isMsalAuthenticated = useIsAuthenticated();
    const { features, isMaintenance } = useAppSelector((state: RootState) => state.app);

    const chat = useChat();
    const file = useFile();

    // Check for existing Teams token on mount
    useEffect(() => {
        if (EmbeddedAppHelper.isInTeams() && !isMsalAuthenticated) {
            const teamsToken = sessionStorage.getItem('teamsToken');
            if (teamsToken) {
                logger.debug('Found existing Teams token, setting authenticated');
                setIsTeamsAuthenticated(true);
            }
        }
    }, [isMsalAuthenticated]);

    // Prevent pinch-to-zoom on trackpad while allowing Ctrl+scroll for text zoom
    // Browser sends trackpad pinch as wheel events with ctrlKey=true, same as Ctrl+scroll
    // We track if Ctrl key was physically pressed to distinguish between them
    useEffect(() => {
        let isCtrlKeyPhysicallyPressed = false;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Control') {
                isCtrlKeyPhysicallyPressed = true;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control') {
                isCtrlKeyPhysicallyPressed = false;
            }
        };

        const preventPinchZoom = (e: WheelEvent) => {
            // If ctrlKey is set but we didn't see a physical Ctrl keypress,
            // it's likely a trackpad pinch gesture - block it
            if (e.ctrlKey && !isCtrlKeyPhysicallyPressed) {
                e.preventDefault();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        // Use passive: false to allow preventDefault
        document.addEventListener('wheel', preventPinchZoom, { passive: false });

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
            document.removeEventListener('wheel', preventPinchZoom);
        };
    }, []);

    // Combined authentication status
    const isAuthenticated = isMsalAuthenticated || isTeamsAuthenticated;

    const handleAppStateChange = useCallback((newState: AppState) => {
        setAppState(newState);
    }, []);

    // Callback for when Teams auth succeeds in Login component
    const handleTeamsAuthSuccess = useCallback(() => {
        logger.debug('Teams authentication successful callback');
        setIsTeamsAuthenticated(true);

        // Try to get user info from Teams context
        void (async () => {
            try {
                const context = await teamsAuthHelper.getContext();
                if (context?.user) {
                    dispatch(
                        setActiveUserInfo({
                            id: context.user.id || 'teams-user',
                            email: context.user.loginHint ?? context.user.userPrincipalName ?? '',
                            username: context.user.displayName ?? context.user.loginHint ?? 'Teams User',
                        }),
                    );
                }
            } catch (error) {
                logger.error('Failed to get Teams context for user info:', error);
            }
        })();
    }, [dispatch]);

    useEffect(() => {
        if (isMaintenance && appState !== AppState.ProbeForBackend) {
            handleAppStateChange(AppState.ProbeForBackend);
            return;
        }

        if (isAuthenticated && appState === AppState.SettingUserInfo) {
            // For MSAL authentication, get user info from the account
            if (isMsalAuthenticated) {
                const account = instance.getActiveAccount();
                if (!account) {
                    handleAppStateChange(AppState.ErrorLoadingUserInfo);
                } else {
                    dispatch(
                        setActiveUserInfo({
                            id: `${account.localAccountId}.${account.tenantId}`,
                            email: account.username,
                            username: account.name ?? account.username,
                        }),
                    );

                    if (account.username.split('@')[1] === 'microsoft.com') {
                        dispatch(
                            addAlert({
                                message:
                                    'By using Chat Copilot, you agree to protect sensitive data, not store it in chat, and allow chat history collection for service improvements. This tool is for internal use only.',
                                type: AlertType.Info,
                            }),
                        );
                    }

                    handleAppStateChange(AppState.LoadChats);
                }
            } else if (isTeamsAuthenticated) {
                // For Teams authentication, user info was already set in handleTeamsAuthSuccess
                // or we'll get it from Teams context
                void (async () => {
                    try {
                        const context = await teamsAuthHelper.getContext();
                        if (context?.user) {
                            dispatch(
                                setActiveUserInfo({
                                    id: context.user.id || `teams-${Date.now()}`,
                                    email: context.user.loginHint ?? context.user.userPrincipalName ?? '',
                                    username: context.user.displayName ?? context.user.loginHint ?? 'Teams User',
                                }),
                            );
                        } else {
                            // Fallback: create a basic user info
                            dispatch(
                                setActiveUserInfo({
                                    id: `teams-${Date.now()}`,
                                    email: 'teams@user',
                                    username: 'Teams User',
                                }),
                            );
                        }
                        handleAppStateChange(AppState.LoadChats);
                    } catch (error) {
                        logger.error('Failed to get Teams user info:', error);
                        // Still proceed even if we can't get user info
                        handleAppStateChange(AppState.LoadChats);
                    }
                })();
            }
        }

        if ((isAuthenticated || !AuthHelper.isAuthAAD()) && appState === AppState.LoadChats) {
            handleAppStateChange(AppState.LoadingChats);
            void Promise.all([
                chat
                    .loadChats()
                    .then(() => {
                        handleAppStateChange(AppState.Chat);
                    })
                    .catch((error) => {
                        logger.error('Error loading chats:', error);
                        handleAppStateChange(AppState.ErrorLoadingChats);
                    }),
                file.getContentSafetyStatus(),
                chat.getServiceInfo().then((serviceInfo) => {
                    if (serviceInfo) {
                        dispatch(setServiceInfo(serviceInfo));
                    }
                }),
                // Load available templates (specialized assistants)
                chat.loadAvailableTemplates(),
            ]);
        } // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instance, isAuthenticated, isMsalAuthenticated, isTeamsAuthenticated, appState, isMaintenance]);

    const theme = features[FeatureKeys.DarkMode].enabled ? semanticKernelDarkTheme : semanticKernelLightTheme;

    // Render logic that handles both MSAL and Teams authentication
    const renderContent = () => {
        if (!AuthHelper.isAuthAAD()) {
            // No auth required
            return <Chat classes={classes} appState={appState} setAppState={handleAppStateChange} />;
        }

        // If authenticated via Teams (but not MSAL), render Chat directly
        if (isTeamsAuthenticated && !isMsalAuthenticated) {
            return <Chat classes={classes} appState={appState} setAppState={handleAppStateChange} />;
        }

        // Standard MSAL flow
        return (
            <>
                <UnauthenticatedTemplate>
                    <div className={classes.container} style={{ position: 'relative' }}>
                        <Login onTeamsAuthSuccess={handleTeamsAuthSuccess} />
                        {appState === AppState.SigningOut && (
                            <LoadingOverlay text="Logger ut..." isDark={features[FeatureKeys.DarkMode].enabled} />
                        )}
                    </div>
                </UnauthenticatedTemplate>
                <AuthenticatedTemplate>
                    <Chat classes={classes} appState={appState} setAppState={handleAppStateChange} />
                </AuthenticatedTemplate>
            </>
        );
    };

    return (
        <FluentProvider className="app-container" theme={theme}>
            {renderContent()}
        </FluentProvider>
    );
};

export default App;
