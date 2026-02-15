// Copyright (c) Microsoft. All rights reserved.

import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    makeStyles,
    shorthands,
    Spinner,
    Text,
    tokens,
} from '@fluentui/react-components';
import { Warning24Regular } from '@fluentui/react-icons';
import React from 'react';
import { ChatState } from '../../../redux/features/conversations/ChatState';
import { ScrollBarStyles } from '../../../styles';

const useClasses = makeStyles({
    surface: {
        maxWidth: '500px',
    },
    warningHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalM,
    },
    warningIcon: {
        color: tokens.colorPaletteRedForeground1,
        fontSize: '24px',
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
    },
    chatList: {
        maxHeight: '200px',
        ...ScrollBarStyles,
        backgroundColor: tokens.colorNeutralBackground3,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    },
    chatItem: {
        ...shorthands.padding(tokens.spacingVerticalXS, 0),
        ...shorthands.overflow('hidden'),
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: tokens.fontSizeBase200,
    },
    actions: {
        display: 'flex',
        gap: tokens.spacingHorizontalM,
        justifyContent: 'flex-end',
    },
    deleteButton: {
        backgroundColor: tokens.colorPaletteRedBackground3,
        color: '#1a1a1a',
        '&:hover': {
            backgroundColor: tokens.colorPaletteRedForeground1,
            color: '#1a1a1a',
        },
    },
    warningText: {
        color: tokens.colorNeutralForeground2,
    },
});

interface DeleteConfirmDialogProps {
    isOpen: boolean;
    chatsToDelete: ChatState[];
    chatsToLeave?: ChatState[];
    onConfirm: () => void;
    onCancel: () => void;
    isDeleting: boolean;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
    isOpen,
    chatsToDelete,
    chatsToLeave = [],
    onConfirm,
    onCancel,
    isDeleting,
}) => {
    const classes = useClasses();

    const deleteCount = chatsToDelete.length;
    const leaveCount = chatsToLeave.length;
    const totalCount = deleteCount + leaveCount;

    const getTitle = () => {
        if (deleteCount > 0 && leaveCount > 0) return 'Stadfest sletting og forlating';
        if (leaveCount > 0) return 'Stadfest forlating';
        return 'Stadfest sletting';
    };

    const getButtonText = () => {
        if (isDeleting) return null;
        if (deleteCount > 0 && leaveCount > 0) {
            return `Slett (${deleteCount}) og forlat (${leaveCount})`;
        }
        if (leaveCount > 0) {
            return `Forlat ${leaveCount} samtale${leaveCount === 1 ? '' : 'r'}`;
        }
        return `Slett ${deleteCount} samtale${deleteCount === 1 ? '' : 'r'}`;
    };

    return (
        <Dialog
            open={isOpen && totalCount > 0}
            onOpenChange={(_, data) => {
                if (!data.open && !isDeleting) {
                    onCancel();
                }
            }}
        >
            <DialogSurface className={classes.surface}>
                <DialogBody>
                    <DialogTitle>
                        <div className={classes.warningHeader}>
                            <Warning24Regular className={classes.warningIcon} />
                            <span>{getTitle()}</span>
                        </div>
                    </DialogTitle>

                    <DialogContent className={classes.content}>
                        {deleteCount > 0 && (
                            <>
                                <Text className={classes.warningText}>
                                    {leaveCount > 0
                                        ? `${deleteCount} samtale${deleteCount === 1 ? '' : 'r'} du eig vil bli sletta:`
                                        : `Er du sikker på at du vil slette ${deleteCount} samtale${deleteCount === 1 ? '' : 'r'}? Denne handlinga kan ikkje angrast.`}
                                </Text>
                                <div className={classes.chatList}>
                                    {chatsToDelete.map((chat) => (
                                        <div key={chat.id} className={classes.chatItem} title={chat.title}>
                                            {chat.title}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {leaveCount > 0 && (
                            <>
                                <Text className={classes.warningText}>
                                    {deleteCount > 0
                                        ? `${leaveCount} delte samtale${leaveCount === 1 ? '' : 'r'} du vil forlate:`
                                        : `Er du sikker på at du vil forlate ${leaveCount} delte samtale${leaveCount === 1 ? '' : 'r'}? Du kan bli med igjen seinare.`}
                                </Text>
                                <div className={classes.chatList}>
                                    {chatsToLeave.map((chat) => (
                                        <div key={chat.id} className={classes.chatItem} title={chat.title}>
                                            {chat.title}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </DialogContent>

                    <DialogActions className={classes.actions}>
                        <Button appearance="secondary" onClick={onCancel} disabled={isDeleting}>
                            Avbryt
                        </Button>
                        <Button
                            appearance="primary"
                            onClick={onConfirm}
                            disabled={isDeleting}
                            className={classes.deleteButton}
                        >
                            {isDeleting ? (
                                <>
                                    <Spinner size="tiny" style={{ marginRight: tokens.spacingHorizontalS }} />
                                    Arbeider...
                                </>
                            ) : (
                                getButtonText()
                            )}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
