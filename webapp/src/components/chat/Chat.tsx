import { Subtitle1 } from '@fluentui/react-components';
import React from 'react';
import { AuthHelper } from '../..//libs/auth/AuthHelper';
import { AppState, useClasses } from '../../App';
import { UserSettingsMenu } from '../header/UserSettingsMenu';
import { PluginGallery } from '../open-api-plugins/PluginGallery';
import { BackendProbe, ChatView, Error, LoadingOverlay } from '../views';

const Chat = ({
    classes,
    appState,
    setAppState,
}: {
    classes: ReturnType<typeof useClasses>;
    appState: AppState;
    setAppState: (state: AppState) => void;
}) => {
    const onBackendFound = React.useCallback(() => {
        setAppState(
            AuthHelper.isAuthAAD()
                ? // if AAD is enabled, we need to set the active account before loading chats
                  AppState.SettingUserInfo
                : // otherwise, we can load chats immediately
                  AppState.LoadChats,
        );
    }, [setAppState]);

    // Determine if we're in a loading state that should show the overlay
    const isLoading = appState === AppState.SettingUserInfo || appState === AppState.LoadingChats;
    const loadingText =
        appState === AppState.SettingUserInfo
            ? 'Hentar brukarinfo...'
            : appState === AppState.LoadingChats
              ? 'Lastar inn...'
              : '';

    return (
        <div className={classes.container} style={{ position: 'relative' }}>
            <div className={classes.header}>
                <Subtitle1 as="h1">Mimir</Subtitle1>
                {appState > AppState.SettingUserInfo && (
                    <div className={classes.cornerItems}>
                        <div className={classes.cornerItems}>
                            <PluginGallery />
                            <UserSettingsMenu
                                setLoadingState={() => {
                                    setAppState(AppState.SigningOut);
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Always render ChatView as background when past ProbeForBackend */}
            {appState > AppState.ProbeForBackend &&
                appState !== AppState.ErrorLoadingUserInfo &&
                appState !== AppState.ErrorLoadingChats && <ChatView />}

            {/* Show loading overlay on top of ChatView */}
            {isLoading && <LoadingOverlay text={loadingText} />}

            {/* Backend probe and errors */}
            {appState === AppState.ProbeForBackend && <BackendProbe onBackendFound={onBackendFound} />}
            {appState === AppState.ErrorLoadingUserInfo && (
                <Error text={'Klarte ikkje å laste brukarinfo. Vennligst prøv å logge ut og inn igjen.'} />
            )}
            {appState === AppState.ErrorLoadingChats && (
                <Error text={'Klarte ikkje å laste samtalar. Vennligst prøv å oppdatere sida.'} />
            )}
        </div>
    );
};
export default Chat;
