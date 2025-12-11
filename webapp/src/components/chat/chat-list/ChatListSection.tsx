import { makeStyles, shorthands, Text, tokens } from '@fluentui/react-components';
import { getFriendlyChatName } from '../../../libs/hooks/useChat';
import { ChatMessageType } from '../../../libs/models/ChatMessage';
import { useAppSelector } from '../../../redux/app/hooks';
import { RootState } from '../../../redux/app/store';
import { Conversations } from '../../../redux/features/conversations/ConversationsState';
import { Breakpoints } from '../../../styles';
import { ChatListItem } from './ChatListItem';

const useClasses = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        ...shorthands.gap(tokens.spacingVerticalXXS),
        paddingBottom: 0,
        overflowY: 'hidden',
    },

    header: {
        marginTop: 0,
        paddingBottom: tokens.spacingVerticalXS,
        marginLeft: tokens.spacingHorizontalXL,
        marginRight: tokens.spacingHorizontalXL,
        fontWeight: tokens.fontWeightRegular,
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
        ...Breakpoints.small({
            marginLeft: tokens.spacingHorizontalM,
            marginRight: tokens.spacingHorizontalM,
        }),
    },
});

interface IChatListSectionProps {
    header?: string;
    conversations: Conversations;
}

export const ChatListSection: React.FC<IChatListSectionProps> = ({ header, conversations }) => {
    const classes = useClasses();
    const { selectedId } = useAppSelector((state: RootState) => state.conversations);

    // Sort by timestamp descending (newest first)
    const keys = Object.keys(conversations).sort((a, b) => {
        const convoA = conversations[a];
        const convoB = conversations[b];
        const lastMsgA = convoA.messages[convoA.messages.length - 1];
        const lastMsgB = convoB.messages[convoB.messages.length - 1];
        const tsA = convoA.lastUpdatedTimestamp ?? lastMsgA.timestamp;
        const tsB = convoB.lastUpdatedTimestamp ?? lastMsgB.timestamp;
        return tsB - tsA; // Newest first
    });

    return keys.length > 0 ? (
        <div className={classes.root}>
            <Text className={classes.header}>{header}</Text>
            {keys.map((id) => {
                const convo = conversations[id];
                const messages = convo.messages;
                const lastMessage = messages[convo.messages.length - 1];
                const isSelected = id === selectedId;
                return (
                    <ChatListItem
                        id={id}
                        key={id}
                        isSelected={isSelected}
                        header={getFriendlyChatName(convo)}
                        timestamp={convo.lastUpdatedTimestamp ?? lastMessage.timestamp}
                        preview={
                            messages.length > 0
                                ? lastMessage.type === ChatMessageType.Document
                                    ? 'Sendte ei fil'
                                    : lastMessage.type === ChatMessageType.Plan
                                      ? 'Klikk for å sjå føreslegen plan'
                                      : lastMessage.content
                                : 'Klikk for å starte chatten'
                        }
                        botProfilePicture={convo.botProfilePicture}
                    />
                );
            })}
        </div>
    ) : null;
};
