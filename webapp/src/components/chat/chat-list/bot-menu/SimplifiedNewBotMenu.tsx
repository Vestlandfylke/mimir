// Copyright (c) Microsoft. All rights reserved.

import { FC, useState } from 'react';

import {
    Badge,
    Button,
    Divider,
    Menu,
    MenuItem,
    MenuList,
    MenuPopover,
    MenuTrigger,
    Tooltip,
    tokens,
} from '@fluentui/react-components';
import { BotRegular, PersonRegular, SparkleRegular } from '@fluentui/react-icons';
import { useChat } from '../../../../libs/hooks';
import { useAppSelector } from '../../../../redux/app/hooks';
import { RootState } from '../../../../redux/app/store';
import { FeatureKeys } from '../../../../redux/features/app/AppState';
import { Add20 } from '../../../shared/BundledIcons';
import { InvitationJoinDialog } from '../../invitation-dialog/InvitationJoinDialog';

interface SimplifiedNewBotMenuProps {
    onFileUpload: () => void;
}

/**
 * Get an icon for a template based on its icon identifier.
 */
const getTemplateIcon = (icon?: string) => {
    switch (icon) {
        case 'leader':
            return <PersonRegular />;
        case 'klarsprak':
            return <SparkleRegular />;
        default:
            return <SparkleRegular />;
    }
};

export const SimplifiedNewBotMenu: FC<SimplifiedNewBotMenuProps> = ({ onFileUpload }) => {
    const chat = useChat();
    const { features, availableTemplates } = useAppSelector((state: RootState) => state.app);

    // It needs to keep the menu open to keep the FileUploader reference
    // when the file uploader is clicked.
    const [isJoiningBot, setIsJoiningBot] = useState(false);

    const onAddChat = () => {
        void chat.createChat();
    };

    const onAddTemplateChat = (templateId: string, displayName: string) => {
        void chat.createChat(templateId, displayName);
    };

    const onJoinClick = () => {
        setIsJoiningBot(true);
    };

    const onCloseDialog = () => {
        setIsJoiningBot(false);
    };

    const hasTemplates = availableTemplates.length > 0;

    return (
        <div>
            <Menu>
                <MenuTrigger disableButtonEnhancement>
                    <Tooltip content="Legg til ei samtaleøkt" relationship="label">
                        <Button
                            data-tour="new-chat-button"
                            data-testid="createNewConversationButton"
                            icon={<Add20 />}
                            appearance="transparent"
                        />
                    </Tooltip>
                </MenuTrigger>
                <MenuPopover>
                    <MenuList>
                        {/* Standard Mimir assistant */}
                        <Divider style={{ margin: '8px 0' }}>
                            <Badge appearance="outline" color="brand" size="small" style={{ fontSize: '0.65rem' }}>
                                Generell assistent
                            </Badge>
                        </Divider>
                        <MenuItem
                            data-testid="addNewBotMenuItem"
                            icon={<BotRegular style={{ color: tokens.colorBrandForeground1 }} />}
                            onClick={onAddChat}
                            style={{
                                backgroundColor: tokens.colorNeutralBackground1Hover,
                                borderLeft: `3px solid ${tokens.colorBrandForeground1}`,
                                marginLeft: '4px',
                                marginRight: '4px',
                                borderRadius: '4px',
                                marginBottom: '4px',
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 600 }}>Mimir</div>
                                <div
                                    style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--colorNeutralForeground3)',
                                        marginTop: '2px',
                                    }}
                                >
                                    Generell KI-assistent for alle oppgåver
                                </div>
                            </div>
                        </MenuItem>

                        {/* Specialized assistants section */}
                        {hasTemplates && (
                            <>
                                <Divider style={{ margin: '8px 0' }}>
                                    <Badge
                                        appearance="outline"
                                        color="informative"
                                        size="small"
                                        style={{ fontSize: '0.65rem' }}
                                    >
                                        Spesialiserte assistentar
                                    </Badge>
                                </Divider>
                                {availableTemplates.map((template) => (
                                    <MenuItem
                                        key={template.id}
                                        data-testid={`addTemplate-${template.id}`}
                                        icon={getTemplateIcon(template.icon)}
                                        onClick={() => {
                                            onAddTemplateChat(template.id, template.displayName);
                                        }}
                                        style={{
                                            backgroundColor: tokens.colorNeutralBackground1Hover,
                                            borderLeft: `3px solid ${tokens.colorBrandForeground1}`,
                                            marginLeft: '4px',
                                            marginRight: '4px',
                                            borderRadius: '4px',
                                            marginBottom: '4px',
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{template.displayName}</div>
                                            {template.description && (
                                                <div
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--colorNeutralForeground3)',
                                                        marginTop: '2px',
                                                    }}
                                                >
                                                    {template.description}
                                                </div>
                                            )}
                                        </div>
                                    </MenuItem>
                                ))}
                            </>
                        )}

                        <Divider style={{ margin: '8px 0' }} />
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
