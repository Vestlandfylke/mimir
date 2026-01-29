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
    onConfirm: () => void;
    onCancel: () => void;
    isDeleting: boolean;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
    isOpen,
    chatsToDelete,
    onConfirm,
    onCancel,
    isDeleting,
}) => {
    const classes = useClasses();

    const count = chatsToDelete.length;

    return (
        <Dialog
            open={isOpen}
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
                            <span>Stadfest sletting</span>
                        </div>
                    </DialogTitle>

                    <DialogContent className={classes.content}>
                        <Text className={classes.warningText}>
                            Er du sikker på at du vil slette {count} samtale{count === 1 ? '' : 'r'}? Denne handlinga
                            kan ikkje angrast.
                        </Text>

                        <div className={classes.chatList}>
                            {chatsToDelete.map((chat) => (
                                <div key={chat.id} className={classes.chatItem} title={chat.title}>
                                    {chat.title}
                                </div>
                            ))}
                        </div>
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
                                    Slettar...
                                </>
                            ) : (
                                `Slett ${count} samtale${count === 1 ? '' : 'r'}`
                            )}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
