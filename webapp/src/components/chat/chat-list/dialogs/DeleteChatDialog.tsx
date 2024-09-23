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

interface IEditChatNameProps {
    chatId: string;
}

export const DeleteChatDialog: React.FC<IEditChatNameProps> = ({ chatId }) => {
    const classes = useClasses();
    const chat = useChat();

    const { conversations } = useAppSelector((state) => state.conversations);
    const chatName = getFriendlyChatName(conversations[chatId]);

    const onDeleteChat = () => {
        void chat.deleteChat(chatId);
    };

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
                        Denne handlinga vil permanent slette samtalen, og alle tilknytta ressursar og minner, for alle
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
