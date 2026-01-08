// Copyright (c) Microsoft. All rights reserved.

import {
    Button,
    Dialog,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Label,
    makeStyles,
    Menu,
    MenuItem,
    MenuList,
    MenuPopover,
    MenuTrigger,
    Persona,
    Popover,
    PopoverSurface,
    PopoverTrigger,
    SelectTabEventHandler,
    shorthands,
    Tab,
    TabList,
    TabValue,
    tokens,
    Tooltip,
} from '@fluentui/react-components';
import { Edit24Filled, EditRegular, Map16Regular, MoreVertical24Regular, Person16Regular } from '@fluentui/react-icons';
import React, { useCallback, useState } from 'react';
import { useAppSelector } from '../../redux/app/hooks';
import { RootState } from '../../redux/app/store';
import { FeatureKeys } from '../../redux/features/app/AppState';
import { useChat, useFile } from '../../libs/hooks';
import { Breakpoints } from '../../styles';
import { Alerts } from '../shared/Alerts';
import { ArrowDownload16, Delete16, Edit, Share20 } from '../shared/BundledIcons';
import { ChatRoom } from './ChatRoom';
import { ParticipantsList } from './controls/ParticipantsList';
import { ShareBotMenu } from './controls/ShareBotMenu';
import { EditChatName } from './shared/EditChatName';
import { DocumentsTab } from './tabs/DocumentsTab';
import { PersonaTab } from './tabs/PersonaTab';
import { PlansTab } from './tabs/PlansTab';
import { DeleteChatDialog } from './chat-list/dialogs/DeleteChatDialog';
import { InvitationCreateDialog } from './invitation-dialog/InvitationCreateDialog';

const useClasses = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: tokens.colorNeutralBackground3, // Same gray background as ChatRoom
        ...shorthands.overflow('hidden'), // Prevent scrollbars
    },
    header: {
        ...shorthands.borderBottom('1px', 'solid', 'rgb(0 0 0 / 10%)'),
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
        backgroundColor: tokens.colorNeutralBackground4,
        display: 'flex',
        flexDirection: 'row',
        boxSizing: 'border-box',
        width: '100%',
        justifyContent: 'space-between',
        // Add left padding on mobile for hamburger menu button
        '@media (max-width: 744px)': {
            paddingLeft: '48px', // Space for hamburger button
        },
    },
    title: {
        ...shorthands.gap(tokens.spacingHorizontalM),
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        ...Breakpoints.small({
            ...shorthands.gap(tokens.spacingHorizontalS),
        }),
    },
    // Hide persona info on mobile to save space
    personaInfo: {
        display: 'flex',
        alignItems: 'center',
        ...shorthands.gap(tokens.spacingHorizontalM),
        ...Breakpoints.small({
            display: 'none',
        }),
    },
    controls: {
        display: 'flex',
        alignItems: 'center',
        ...Breakpoints.small({
            display: 'none', // Hide on mobile
        }),
    },
    mobileActions: {
        display: 'none',
        ...Breakpoints.small({
            display: 'flex',
            alignItems: 'center',
        }),
    },
    popoverHeader: {
        ...shorthands.margin('0'),
        paddingBottom: tokens.spacingVerticalXXS,
        fontStyle: 'normal',
        fontWeight: '600',
    },
    popover: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        ...shorthands.padding(tokens.spacingVerticalXXL),
        ...shorthands.gap(tokens.spacingVerticalMNudge),
        width: '398px',
    },
    input: {
        width: '100%',
    },
    buttons: {
        display: 'flex',
        alignSelf: 'end',
        ...shorthands.gap(tokens.spacingVerticalS),
    },
    alerts: {
        display: 'flex',
        flexDirection: 'column',
        ...shorthands.margin(0, '72px'),
    },
});

export const ChatWindow: React.FC = () => {
    const classes = useClasses();
    const { features } = useAppSelector((state: RootState) => state.app);
    const { conversations, selectedId } = useAppSelector((state: RootState) => state.conversations);
    const showShareBotMenu = features[FeatureKeys.BotAsDocs].enabled || features[FeatureKeys.MultiUserChat].enabled;
    const chatName = conversations[selectedId].title;

    const chat = useChat();
    const { downloadFile } = useFile();

    const [isEditingDesktop, setIsEditingDesktop] = useState<boolean>(false);
    const [isEditingMobile, setIsEditingMobile] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [isSharing, setIsSharing] = useState<boolean>(false);
    const [selectedTab, setSelectedTab] = React.useState<TabValue>('chat');
    const onTabSelect: SelectTabEventHandler = (_event, data) => {
        setSelectedTab(data.value);
    };

    const onDownloadChat = useCallback(() => {
        void chat.downloadBot(selectedId).then((content) => {
            downloadFile(
                `chat-history-${selectedId}-${new Date().toISOString()}.json`,
                JSON.stringify(content),
                'text/json',
            );
        });
    }, [chat, selectedId, downloadFile]);

    return (
        <div className={classes.root}>
            <div className={classes.header}>
                <div className={classes.title}>
                    {!features[FeatureKeys.SimplifiedExperience].enabled && (
                        <div className={classes.personaInfo}>
                            <Persona
                                key={'Semantic Kernel Bot'}
                                size="medium"
                                avatar={{ image: { src: conversations[selectedId].botProfilePicture } }}
                                presence={{ status: 'available' }}
                            />
                            <Label size="large" weight="semibold">
                                {chatName}
                            </Label>
                            <Popover open={isEditingDesktop}>
                                <PopoverTrigger disableButtonEnhancement>
                                    <Tooltip content={'Rediger samtalenavn'} relationship="label">
                                        <Button
                                            data-testid="editChatTitleButton"
                                            icon={isEditingDesktop ? <Edit24Filled /> : <EditRegular />}
                                            appearance="transparent"
                                            onClick={() => {
                                                setIsEditingDesktop(true);
                                            }}
                                            disabled={!chatName}
                                            aria-label="Rediger samtalenavn"
                                        />
                                    </Tooltip>
                                </PopoverTrigger>
                                <PopoverSurface className={classes.popover}>
                                    <h3 className={classes.popoverHeader}>Botnamn</h3>
                                    <EditChatName
                                        name={chatName}
                                        chatId={selectedId}
                                        exitEdits={() => {
                                            setIsEditingDesktop(false);
                                        }}
                                        textButtons
                                    />
                                </PopoverSurface>
                            </Popover>
                        </div>
                    )}
                    <TabList selectedValue={selectedTab} onTabSelect={onTabSelect}>
                        <Tab data-testid="chatTab" id="chat" value="chat" aria-label="Chat-fane" title="Chat-fane">
                            Chat
                        </Tab>
                        <Tab
                            data-testid="documentsTab"
                            id="documents"
                            value="documents"
                            aria-label="Dokumenter-fane"
                            title="Dokumenter-fane"
                        >
                            Dokument
                        </Tab>
                        {features[FeatureKeys.PluginsPlannersAndPersonas].enabled && (
                            <>
                                <Tab
                                    data-testid="plansTab"
                                    id="plans"
                                    value="plans"
                                    icon={<Map16Regular />}
                                    aria-label="Planer-fane"
                                    title="Planer-fane"
                                >
                                    Planar
                                </Tab>
                                <Tab
                                    data-testid="personaTab"
                                    id="persona"
                                    value="persona"
                                    icon={<Person16Regular />}
                                    aria-label="Tilpassing-fane"
                                    title="Tilpassing-fane"
                                >
                                    Tilpassing
                                </Tab>
                            </>
                        )}
                    </TabList>
                </div>
                <div className={classes.controls}>
                    {!features[FeatureKeys.SimplifiedExperience].enabled && (
                        <div data-testid="chatParticipantsView">
                            <ParticipantsList participants={conversations[selectedId].users} />
                        </div>
                    )}
                    {showShareBotMenu && (
                        <div>
                            <ShareBotMenu chatId={selectedId} chatTitle={chatName} />
                        </div>
                    )}
                </div>
                {/* Mobile actions menu */}
                <div className={classes.mobileActions}>
                    <Menu>
                        <MenuTrigger disableButtonEnhancement>
                            <Button
                                appearance="subtle"
                                icon={<MoreVertical24Regular />}
                                aria-label="Fleire handlingar"
                            />
                        </MenuTrigger>
                        <MenuPopover>
                            <MenuList>
                                <MenuItem
                                    icon={<Edit />}
                                    onClick={() => {
                                        setIsEditingMobile(true);
                                    }}
                                >
                                    Rediger namn
                                </MenuItem>
                                {features[FeatureKeys.BotAsDocs].enabled && (
                                    <MenuItem icon={<ArrowDownload16 />} onClick={onDownloadChat}>
                                        Last ned
                                    </MenuItem>
                                )}
                                {features[FeatureKeys.MultiUserChat].enabled && (
                                    <MenuItem
                                        icon={<Share20 />}
                                        onClick={() => {
                                            setIsSharing(true);
                                        }}
                                    >
                                        Del
                                    </MenuItem>
                                )}
                                <MenuItem
                                    icon={<Delete16 />}
                                    onClick={() => {
                                        setIsDeleting(true);
                                    }}
                                >
                                    Slett samtale
                                </MenuItem>
                            </MenuList>
                        </MenuPopover>
                    </Menu>
                </div>
                <DeleteChatDialog
                    chatId={selectedId}
                    open={isDeleting}
                    onClose={() => {
                        setIsDeleting(false);
                    }}
                />
                {isSharing && (
                    <InvitationCreateDialog
                        chatId={selectedId}
                        onCancel={() => {
                            setIsSharing(false);
                        }}
                    />
                )}
                {/* Mobile edit dialog */}
                <Dialog
                    open={isEditingMobile}
                    onOpenChange={(_, data) => {
                        if (!data.open) setIsEditingMobile(false);
                    }}
                >
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>Rediger samtalenamn</DialogTitle>
                            <DialogContent>
                                <EditChatName
                                    name={chatName}
                                    chatId={selectedId}
                                    exitEdits={() => {
                                        setIsEditingMobile(false);
                                    }}
                                    textButtons
                                />
                            </DialogContent>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            </div>
            {selectedTab === 'chat' && <ChatRoom />}
            {selectedTab === 'documents' && <DocumentsTab />}
            {selectedTab === 'plans' && (
                <PlansTab
                    setChatTab={() => {
                        setSelectedTab('chat');
                    }}
                />
            )}
            {selectedTab === 'persona' && <PersonaTab />}
            {selectedTab !== 'chat' && (
                <div className={classes.alerts}>
                    <Alerts />
                </div>
            )}
        </div>
    );
};
