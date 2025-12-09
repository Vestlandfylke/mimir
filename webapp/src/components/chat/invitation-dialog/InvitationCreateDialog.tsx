// Copyright (c) Microsoft. All rights reserved.

import {
    Button,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Label,
    makeStyles,
    tokens,
} from '@fluentui/react-components';
import { Checkmark20Filled } from '@fluentui/react-icons';
import React, { useCallback, useEffect } from 'react';

const useStyles = makeStyles({
    content: {
        display: 'flex',
        flexDirection: 'column',
        rowGap: tokens.spacingVerticalMNudge,
    },
});

interface InvitationCreateDialogProps {
    onCancel: () => void;
    chatId: string;
}

export const InvitationCreateDialog: React.FC<InvitationCreateDialogProps> = ({ onCancel, chatId }) => {
    const [isIdCopied, setIsIdCopied] = React.useState<boolean>(false);

    const classes = useStyles();

    const copyId = useCallback(() => {
        void navigator.clipboard.writeText(chatId).then(() => {
            setIsIdCopied(true);
        });
    }, [chatId]);

    // Kopier chatId til utklippstavlen som standard når komponenten monteres.
    useEffect(() => {
        copyId();
    }, [copyId]);

    return (
        <div>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>Inviter andre til botten din</DialogTitle>
                    <DialogContent className={classes.content}>
                        <Label>
                            Vennligst oppgi følgjande Chat ID til vennene dine slik at dei kan bli med i chatten.
                        </Label>
                        <Label data-testid="invitationDialogChatIDLabel" weight="semibold">
                            {chatId}
                        </Label>
                    </DialogContent>
                    <DialogActions>
                        <Button data-testid="invitationDialogCloseButton" appearance="secondary" onClick={onCancel}>
                            Lukk
                        </Button>
                        <Button
                            data-testid="invitationDialogChatIDCopyButton"
                            appearance="primary"
                            onClick={copyId}
                            icon={isIdCopied ? <Checkmark20Filled /> : null}
                        >
                            {isIdCopied ? 'Kopiert' : 'Kopier'}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </div>
    );
};
