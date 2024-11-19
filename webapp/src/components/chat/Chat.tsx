import { Subtitle1 } from '@fluentui/react-components';
import React from 'react';
import { AuthHelper } from '../..//libs/auth/AuthHelper';
import { AppState, useClasses } from '../../App';
import { UserSettingsMenu } from '../header/UserSettingsMenu';
import { PluginGallery } from '../open-api-plugins/PluginGallery';
import { BackendProbe, ChatView, Error, Loading } from '../views';

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
    return (
        <div className={classes.container}>
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
            {appState === AppState.ProbeForBackend && <BackendProbe onBackendFound={onBackendFound} />}
            {appState === AppState.SettingUserInfo && (
                <Loading text={'Venligst vent, me henter informasjonen din...'} />
            )}
            {appState === AppState.ErrorLoadingUserInfo && (
                <Error text={'Klarte ikkje å laste brukarinfo. Vennligst prøv å logge ut og inn igjen.'} />
            )}
            {appState === AppState.ErrorLoadingChats && (
                <Error text={'Klarte ikkje å laste samtalar. Vennligst prøv å oppdatere sida.'} />
            )}
            {appState === AppState.LoadingChats && <Loading text="Laster inn..." />}
            {appState === AppState.Chat && <ChatView />}
        </div>
    );
};
export default Chat;
