import { Subtitle1 } from '@fluentui/react-components';
import React from 'react';
import { AuthHelper } from '../..//libs/auth/AuthHelper';
import { AppState, useClasses } from '../../App';
import dekorImage from '../../assets/decor_long2.png';
import { useAppSelector } from '../../redux/app/hooks';
import { RootState } from '../../redux/app/store';
import { FeatureKeys } from '../../redux/features/app/AppState';
import { UserSettingsMenu } from '../header/UserSettingsMenu';
import { PluginGallery } from '../open-api-plugins/PluginGallery';
import { BackendProbe, ChatView, Error, LoadingOverlay, ServiceUnavailableOverlay } from '../views';

const Chat = ({
    classes,
    appState,
    setAppState,
}: {
    classes: ReturnType<typeof useClasses>;
    appState: AppState;
    setAppState: (state: AppState) => void;
}) => {
    const { features, serviceError } = useAppSelector((state: RootState) => state.app);
    const isDarkMode = features[FeatureKeys.DarkMode].enabled;
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
                <img src={dekorImage} alt="" className={classes.headerDecor} aria-hidden="true" />
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
            {isLoading && <LoadingOverlay text={loadingText} isDark={isDarkMode} />}

            {/* Backend probe and errors */}
            {appState === AppState.ProbeForBackend && <BackendProbe onBackendFound={onBackendFound} />}
            {appState === AppState.ErrorLoadingUserInfo && (
                <Error text={'Klarte ikkje å laste brukarinfo. Prøv å logge ut og inn igjen, eller oppdater sida.'} />
            )}
            {appState === AppState.ErrorLoadingChats && <Error text={'Klarte ikkje å laste samtalar.'} />}

            {/* Service unavailable overlay - shown when critical backend/AI errors occur */}
            {serviceError && <ServiceUnavailableOverlay />}
        </div>
    );
};
export default Chat;
