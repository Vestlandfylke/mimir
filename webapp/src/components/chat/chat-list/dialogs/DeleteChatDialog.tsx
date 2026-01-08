import { Button } from '@fluentui/react-button';
import { Tooltip, makeStyles } from '@fluentui/react-components';
import {
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
} from '@fluentui/react-dialog';
import { useChat } from '../../../../libs/hooks';
import { getFriendlyChatName } from '../../../../libs/hooks/useChat';
import { useAppSelector } from '../../../../redux/app/hooks';
import { Delete16 } from '../../../shared/BundledIcons';

const useClasses = makeStyles({
    root: {
        width: '450px',
    },
    actions: {
        paddingTop: '10%',
    },
});

interface IDeleteChatDialogProps {
    chatId: string;
    /** If provided, controls the dialog externally (no trigger button shown) */
    open?: boolean;
    /** Called when dialog should close (only used with external control) */
    onClose?: () => void;
}

export const DeleteChatDialog: React.FC<IDeleteChatDialogProps> = ({ chatId, open, onClose }) => {
    const classes = useClasses();
    const chat = useChat();

    const { conversations } = useAppSelector((state) => state.conversations);
    const chatName = getFriendlyChatName(conversations[chatId]);

    const onDeleteChat = () => {
        void chat.deleteChat(chatId);
        onClose?.();
    };

    const handleClose = () => {
        onClose?.();
    };

    // External control mode (no trigger button)
    if (open !== undefined) {
        return (
            <Dialog
                modalType="alert"
                open={open}
                onOpenChange={(_, data) => {
                    if (!data.open) handleClose();
                }}
            >
                <DialogSurface className={classes.root}>
                    <DialogBody>
                        <DialogTitle>Er du sikker på at du vil slette samtalen: {chatName}?</DialogTitle>
                        <DialogContent>
                            Denne handlinga vil permanent slette samtalen, og alle tilknytta ressursar og minner, for
                            alle deltakarar, inkludert Mimir.
                        </DialogContent>
                        <DialogActions className={classes.actions}>
                            <Button appearance="secondary" onClick={handleClose}>
                                Avbryt
                            </Button>
                            <Button appearance="primary" onClick={onDeleteChat}>
                                Slett
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        );
    }

    // Original mode with trigger button
    return (
        <Dialog modalType="alert">
            <DialogTrigger>
                <Tooltip content={'Slett chatøkt'} relationship="label">
                    <Button icon={<Delete16 />} appearance="transparent" aria-label="Edit" />
                </Tooltip>
            </DialogTrigger>
            <DialogSurface className={classes.root}>
                <DialogBody>
                    <DialogTitle>Er du sikker på at du vil slette samtalen: {chatName}?</DialogTitle>
                    <DialogContent>
                        Denna handlinga vil permanent slette samtalen, og alle tilknytta ressursar og minner, for alle
                        deltakarar, inkludert Mimir.
                    </DialogContent>
                    <DialogActions className={classes.actions}>
                        <DialogTrigger action="close" disableButtonEnhancement>
                            <Button appearance="secondary">Avbryt</Button>
                        </DialogTrigger>
                        <DialogTrigger action="close" disableButtonEnhancement>
                            <Button appearance="primary" onClick={onDeleteChat}>
                                Slett
                            </Button>
                        </DialogTrigger>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
