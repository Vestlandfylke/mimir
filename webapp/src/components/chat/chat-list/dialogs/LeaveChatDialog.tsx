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
import { PersonDeleteRegular } from '@fluentui/react-icons';
import { useChat } from '../../../../libs/hooks';
import { getFriendlyChatName } from '../../../../libs/hooks/useChat';
import { useAppSelector } from '../../../../redux/app/hooks';

const useClasses = makeStyles({
    root: {
        width: '450px',
    },
    actions: {
        paddingTop: '10%',
    },
});

interface ILeaveChatDialogProps {
    chatId: string;
    /** If provided, controls the dialog externally (no trigger button shown) */
    open?: boolean;
    /** Called when dialog should close (only used with external control) */
    onClose?: () => void;
}

export const LeaveChatDialog: React.FC<ILeaveChatDialogProps> = ({ chatId, open, onClose }) => {
    const classes = useClasses();
    const chat = useChat();

    const { conversations } = useAppSelector((state) => state.conversations);
    const chatName = getFriendlyChatName(conversations[chatId]);

    const onLeaveChat = () => {
        void chat.leaveChat(chatId);
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
                        <DialogTitle>Forlat samtalen: {chatName}?</DialogTitle>
                        <DialogContent>
                            Du vil ikkje lenger ha tilgang til denne samtalen. Dei andre deltakarane vil framleis kunne
                            bruke den. Du kan bli med igjen seinare ved å bruke samtale-koden.
                        </DialogContent>
                        <DialogActions className={classes.actions}>
                            <Button appearance="secondary" onClick={handleClose}>
                                Avbryt
                            </Button>
                            <Button appearance="primary" onClick={onLeaveChat}>
                                Forlat
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
                <Tooltip content={'Forlat samtalen'} relationship="label">
                    <Button icon={<PersonDeleteRegular />} appearance="transparent" aria-label="Forlat samtalen" />
                </Tooltip>
            </DialogTrigger>
            <DialogSurface className={classes.root}>
                <DialogBody>
                    <DialogTitle>Forlat samtalen: {chatName}?</DialogTitle>
                    <DialogContent>
                        Du vil ikkje lenger ha tilgang til denne samtalen. Dei andre deltakarane vil framleis kunne
                        bruke den. Du kan bli med igjen seinare ved å bruke samtale-koden.
                    </DialogContent>
                    <DialogActions className={classes.actions}>
                        <DialogTrigger action="close" disableButtonEnhancement>
                            <Button appearance="secondary">Avbryt</Button>
                        </DialogTrigger>
                        <DialogTrigger action="close" disableButtonEnhancement>
                            <Button appearance="primary" onClick={onLeaveChat}>
                                Forlat
                            </Button>
                        </DialogTrigger>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
