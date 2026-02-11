// Copyright (c) Microsoft. All rights reserved.

import React, { FC, useCallback, useState } from 'react';

import { Button, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger, Tooltip } from '@fluentui/react-components';
import { ArrowDownloadRegular, PeopleTeamAddRegular, PersonDeleteRegular, ShareRegular } from '@fluentui/react-icons';
import { useChat, useFile } from '../../../libs/hooks';
import { useAppSelector } from '../../../redux/app/hooks';
import { RootState } from '../../../redux/app/store';
import { FeatureKeys } from '../../../redux/features/app/AppState';
import { LeaveChatDialog } from '../chat-list/dialogs/LeaveChatDialog';
import { InvitationCreateDialog } from '../invitation-dialog/InvitationCreateDialog';

interface ShareBotMenuProps {
    chatId: string;
    chatTitle: string;
}

export const ShareBotMenu: FC<ShareBotMenuProps> = ({ chatId, chatTitle }) => {
    const chat = useChat();
    const { downloadFile } = useFile();
    const [isGettingInvitationId, setIsGettingInvitationId] = React.useState(false);
    const [isLeavingChat, setIsLeavingChat] = useState(false);
    const { features, activeUserInfo } = useAppSelector((state: RootState) => state.app);
    const { conversations } = useAppSelector((state: RootState) => state.conversations);

    const conversation = conversations[chatId];
    const isCreator = !conversation.createdBy || conversation.createdBy === activeUserInfo?.id;
    const isSharedChat = conversation.users.length > 1;
    const canLeave = isSharedChat && !isCreator;

    const onDownloadBotClick = useCallback(() => {
        // TODO: [Issue #47] Add a loading indicator
        void chat.downloadBot(chatId).then((content) => {
            downloadFile(
                `chat-historikk-${chatTitle}-${new Date().toISOString()}.json`,
                JSON.stringify(content),
                'text/json',
            );
        });
    }, [chat, chatId, chatTitle, downloadFile]);

    return (
        <div>
            <Menu>
                <MenuTrigger disableButtonEnhancement>
                    <Tooltip content="Del" relationship="label">
                        <Button
                            data-tour="share-button"
                            data-testid="shareButton"
                            icon={<ShareRegular />}
                            appearance="transparent"
                        />
                    </Tooltip>
                </MenuTrigger>
                <MenuPopover>
                    <MenuList>
                        <MenuItem
                            data-testid="downloadBotMenuItem"
                            icon={<ArrowDownloadRegular />}
                            onClick={onDownloadBotClick}
                            disabled={!features[FeatureKeys.BotAsDocs].enabled}
                        >
                            Last ned samtale historikken
                        </MenuItem>

                        <MenuItem
                            data-testid="inviteOthersMenuItem"
                            icon={<PeopleTeamAddRegular />}
                            onClick={() => {
                                setIsGettingInvitationId(true);
                            }}
                            disabled={!features[FeatureKeys.MultiUserChat].enabled}
                        >
                            Inviter andre til samtalen
                        </MenuItem>

                        {canLeave && (
                            <MenuItem
                                data-testid="leaveChatMenuItem"
                                icon={<PersonDeleteRegular />}
                                onClick={() => {
                                    setIsLeavingChat(true);
                                }}
                            >
                                Forlat samtalen
                            </MenuItem>
                        )}
                    </MenuList>
                </MenuPopover>
            </Menu>
            {isGettingInvitationId && (
                <InvitationCreateDialog
                    onCancel={() => {
                        setIsGettingInvitationId(false);
                    }}
                    chatId={chatId}
                />
            )}
            {isLeavingChat && (
                <LeaveChatDialog
                    chatId={chatId}
                    open={isLeavingChat}
                    onClose={() => {
                        setIsLeavingChat(false);
                    }}
                />
            )}
        </div>
    );
};
