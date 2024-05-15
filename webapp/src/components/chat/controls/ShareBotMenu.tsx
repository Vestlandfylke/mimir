// Copyright (c) Microsoft. All rights reserved.

import React, { FC, useCallback } from 'react';

import { Button, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger, Tooltip } from '@fluentui/react-components';
import { ArrowDownloadRegular, PeopleTeamAddRegular, ShareRegular } from '@fluentui/react-icons';
import { useChat, useFile } from '../../../libs/hooks';
import { useAppSelector } from '../../../redux/app/hooks';
import { RootState } from '../../../redux/app/store';
import { FeatureKeys } from '../../../redux/features/app/AppState';
import { InvitationCreateDialog } from '../invitation-dialog/InvitationCreateDialog';

interface ShareBotMenuProps {
    chatId: string;
    chatTitle: string;
}

export const ShareBotMenu: FC<ShareBotMenuProps> = ({ chatId, chatTitle }) => {
    const chat = useChat();
    const { downloadFile } = useFile();
    const [isGettingInvitationId, setIsGettingInvitationId] = React.useState(false);
    const { features } = useAppSelector((state: RootState) => state.app);

    const onDownloadBotClick = useCallback(() => {
        // TODO: [Issue #47] Legg til ein lastingindikator
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
                        <Button data-testid="shareButton" icon={<ShareRegular />} appearance="transparent" />
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
                            Last ned botten din
                        </MenuItem>

                        <MenuItem
                            data-testid="inviteOthersMenuItem"
                            icon={<PeopleTeamAddRegular />}
                            onClick={() => {
                                setIsGettingInvitationId(true);
                            }}
                            disabled={!features[FeatureKeys.MultiUserChat].enabled}
                        >
                            Inviter andre til botten din
                        </MenuItem>
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
        </div>
    );
};
