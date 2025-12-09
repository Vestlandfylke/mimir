// Copyright (c) Microsoft. All rights reserved.

import { FC, useState } from 'react';

import {
    Button,
    Divider,
    Menu,
    MenuItem,
    MenuList,
    MenuPopover,
    MenuTrigger,
    Tooltip,
} from '@fluentui/react-components';
import { useChat } from '../../../../libs/hooks';
import { useAppSelector } from '../../../../redux/app/hooks';
import { RootState } from '../../../../redux/app/store';
import { FeatureKeys } from '../../../../redux/features/app/AppState';
import { Add20 } from '../../../shared/BundledIcons';
import { InvitationJoinDialog } from '../../invitation-dialog/InvitationJoinDialog';

interface SimplifiedNewBotMenuProps {
    onFileUpload: () => void;
}

export const SimplifiedNewBotMenu: FC<SimplifiedNewBotMenuProps> = ({ onFileUpload }) => {
    const chat = useChat();
    const { features } = useAppSelector((state: RootState) => state.app);

    // It needs to keep the menu open to keep the FileUploader reference
    // when the file uploader is clicked.
    const [isJoiningBot, setIsJoiningBot] = useState(false);

    const onAddChat = () => {
        void chat.createChat();
    };
    
    const onAddKlarsprakChat = () => {
        void chat.createChat('klarsprak');
    };
    
    const onJoinClick = () => {
        setIsJoiningBot(true);
    };

    const onCloseDialog = () => {
        setIsJoiningBot(false);
    };

    return (
        <div>
            <Menu>
                <MenuTrigger disableButtonEnhancement>
                    <Tooltip content="Legg til ei samtaleøkt" relationship="label">
                        <Button data-testid="createNewConversationButton" icon={<Add20 />} appearance="transparent" />
                    </Tooltip>
                </MenuTrigger>
                <MenuPopover>
                    <MenuList>
                        <MenuItem data-testid="addNewBotMenuItem" onClick={onAddChat}>
                            Ny samtaleøkt
                        </MenuItem>
                        <MenuItem data-testid="addKlarsprakBotMenuItem" onClick={onAddKlarsprakChat}>
                            📝 Klarspråk-assistent
                        </MenuItem>
                        <Divider />
                        <MenuItem
                            data-testid="joinABotMenuItem"
                            disabled={!features[FeatureKeys.MultiUserChat].enabled}
                            onClick={onJoinClick}
                        >
                            Bli med i delt samtaleøkt
                        </MenuItem>
                        <MenuItem
                            data-testid="uploadABotMenuItem"
                            disabled={!features[FeatureKeys.BotAsDocs].enabled}
                            onClick={onFileUpload}
                        >
                            Last opp ein bot
                        </MenuItem>
                    </MenuList>
                </MenuPopover>
            </Menu>
            {isJoiningBot && <InvitationJoinDialog onCloseDialog={onCloseDialog} />}
        </div>
    );
};
