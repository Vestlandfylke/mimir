// Copyright (c) Microsoft. All rights reserved.

import { FC, useCallback, useState } from 'react';

import { useMsal } from '@azure/msal-react';
import {
    Avatar,
    Button,
    Menu,
    MenuDivider,
    MenuItem,
    MenuList,
    MenuPopover,
    MenuTrigger,
    Persona,
    makeStyles,
    shorthands,
    tokens,
} from '@fluentui/react-components';
import {
    ChatMultiple20Regular,
    Settings24Regular,
    Info20Regular,
    QuestionCircle20Regular,
} from '@fluentui/react-icons';
import { AuthHelper } from '../../libs/auth/AuthHelper';
import { useAppDispatch, useAppSelector } from '../../redux/app/hooks';
import { RootState, resetState } from '../../redux/app/store';
import { FeatureKeys } from '../../redux/features/app/AppState';
import { setChatManagementModalOpen } from '../../redux/features/app/appSlice';
import { SettingsDialog } from './settings-dialog/SettingsDialog';
import { useTour } from '../tour';

export const useClasses = makeStyles({
    root: {
        marginRight: tokens.spacingHorizontalXL,
    },
    persona: {
        ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingVerticalMNudge),
        overflowWrap: 'break-word',
    },
});

interface IUserSettingsProps {
    setLoadingState: () => void;
}

export const UserSettingsMenu: FC<IUserSettingsProps> = ({ setLoadingState }) => {
    const classes = useClasses();
    const dispatch = useAppDispatch();
    const { instance } = useMsal();
    const { startTour, setTourCompleted } = useTour();

    const { activeUserInfo, features } = useAppSelector((state: RootState) => state.app);
    const isDarkMode = features[FeatureKeys.DarkMode].enabled;

    const [openSettingsDialog, setOpenSettingsDialog] = useState(false);

    const onLogout = useCallback(() => {
        setLoadingState();
        AuthHelper.logoutAsync(instance);
        resetState();
    }, [instance, setLoadingState]);

    const onManageChats = useCallback(() => {
        dispatch(setChatManagementModalOpen(true));
    }, [dispatch]);

    const onStartTour = useCallback(() => {
        setTourCompleted(false); // Reset completion status
        startTour();
    }, [startTour, setTourCompleted]);

    return (
        <>
            {AuthHelper.isAuthAAD() ? (
                <Menu>
                    <MenuTrigger disableButtonEnhancement>
                        {
                            <Avatar
                                className={classes.root}
                                key={activeUserInfo?.username}
                                name={activeUserInfo?.username}
                                size={28}
                                color={isDarkMode ? 'neutral' : 'colorful'}
                                style={
                                    isDarkMode
                                        ? {
                                              backgroundColor: 'transparent',
                                              color: '#ffffff',
                                              border: '1px solid rgba(255, 255, 255, 0.6)',
                                          }
                                        : undefined
                                }
                                badge={
                                    !features[FeatureKeys.SimplifiedExperience].enabled
                                        ? { status: 'available' }
                                        : undefined
                                }
                                data-testid="userSettingsButton"
                            />
                        }
                    </MenuTrigger>
                    <MenuPopover>
                        <MenuList>
                            <Persona
                                className={classes.persona}
                                name={activeUserInfo?.username}
                                secondaryText={activeUserInfo?.email}
                                presence={
                                    !features[FeatureKeys.SimplifiedExperience].enabled
                                        ? { status: 'available' }
                                        : undefined
                                }
                                avatar={{ color: 'colorful' }}
                            />
                            <MenuDivider />
                            <MenuItem
                                data-testid="settingsMenuItem"
                                onClick={() => {
                                    setOpenSettingsDialog(true);
                                }}
                            >
                                Innstillingar
                            </MenuItem>
                            <MenuItem
                                data-testid="manageChatsMenuItem"
                                icon={<ChatMultiple20Regular />}
                                onClick={onManageChats}
                            >
                                Administrer samtalar
                            </MenuItem>
                            <MenuItem data-testid="startTourMenuItem" icon={<Info20Regular />} onClick={onStartTour}>
                                Lær å bruke Mimir
                            </MenuItem>
                            <MenuItem
                                data-testid="helpMenuItem"
                                icon={<QuestionCircle20Regular />}
                                onClick={() => {
                                    window.open(
                                        'https://hjelp.vlfk.no/tas/public/ssp/content/serviceflow?unid=faf1006c-a321-41c1-9351-b5152954267f',
                                        '_blank',
                                        'noopener,noreferrer',
                                    );
                                }}
                            >
                                Hjelp og support
                            </MenuItem>
                            <MenuDivider />
                            <MenuItem data-testid="logOutMenuButton" onClick={onLogout}>
                                Logg ut
                            </MenuItem>
                        </MenuList>
                    </MenuPopover>
                </Menu>
            ) : (
                <Button
                    data-testid="settingsButtonWithoutAuth"
                    style={{ color: 'white' }}
                    appearance="transparent"
                    icon={<Settings24Regular color="white" />}
                    onClick={() => {
                        setOpenSettingsDialog(true);
                    }}
                >
                    Innstillingar
                </Button>
            )}
            <SettingsDialog
                open={openSettingsDialog}
                closeDialog={() => {
                    setOpenSettingsDialog(false);
                }}
            />
        </>
    );
};
