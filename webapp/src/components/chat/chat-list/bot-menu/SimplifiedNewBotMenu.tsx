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

export const SimplifiedNewBotMenu: FC<SimplifiedNewBotMenuProps> = () => {
    const chat = useChat();
    const { features } = useAppSelector((state: RootState) => state.app);

    // Det er nødvendig å halde menyen open for å behalde referansen til FileUploader
    // når file uploader blir klikka på.
    const [isJoiningBot, setIsJoiningBot] = useState(false);

    const onAddChat = () => {
        void chat.createChat();
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
                        <Divider />
                        <MenuItem
                            data-testid="joinABotMenuItem"
                            disabled={!features[FeatureKeys.MultiUserChat].enabled}
                            onClick={onJoinClick}
                        >
                            Bli med i delt samtaleøkt
                        </MenuItem>
                    </MenuList>
                </MenuPopover>
            </Menu>
            {isJoiningBot && <InvitationJoinDialog onCloseDialog={onCloseDialog} />}
        </div>
    );
};
