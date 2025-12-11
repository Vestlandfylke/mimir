// Copyright (c) Microsoft. All rights reserved.
import {
    Button,
    Input,
    InputOnChangeData,
    makeStyles,
    mergeClasses,
    shorthands,
    Subtitle2Stronger,
    tokens,
} from '@fluentui/react-components';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import logo from '../../../assets/logo.png';
import { useChat, useFile } from '../../../libs/hooks';
import { getFriendlyChatName } from '../../../libs/hooks/useChat';
import { AlertType } from '../../../libs/models/AlertType';
import { ChatArchive } from '../../../libs/models/ChatArchive';
import { useAppDispatch, useAppSelector } from '../../../redux/app/hooks';
import { RootState } from '../../../redux/app/store';
import { addAlert } from '../../../redux/features/app/appSlice';
import { FeatureKeys } from '../../../redux/features/app/AppState';
import { Conversations } from '../../../redux/features/conversations/ConversationsState';
import { Breakpoints } from '../../../styles';
import { FileUploader } from '../../FileUploader';
import { Dismiss20, Filter20 } from '../../shared/BundledIcons';
import { isToday } from '../../utils/TextUtils';
import { NewBotMenu } from './bot-menu/NewBotMenu';
import { SimplifiedNewBotMenu } from './bot-menu/SimplifiedNewBotMenu';
import { ChatListSection } from './ChatListSection';

const useClasses = makeStyles({
    root: {
        display: 'flex',
        flexShrink: 0,
        width: '320px',
        backgroundColor: tokens.colorNeutralBackground4,
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        ...shorthands.overflow('hidden'),
        ...Breakpoints.small({
            width: '280px', // Full sidebar on mobile when visible
            minWidth: '280px',
        }),
        ...Breakpoints.extraSmall({
            width: '260px',
            minWidth: '260px',
        }),
    },
    list: {
        flexGrow: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        height: 'calc(100% - 200px)',
        maxHeight: 'calc(100% - 200px)',
        '&:hover': {
            '&::-webkit-scrollbar-thumb': {
                backgroundColor: tokens.colorScrollbarOverlay,
                visibility: 'visible',
            },
        },
        '&::-webkit-scrollbar-track': {
            backgroundColor: tokens.colorSubtleBackground,
        },
        alignItems: 'stretch',
    },

    header: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginRight: tokens.spacingVerticalM,
        marginLeft: tokens.spacingHorizontalXL,
        alignItems: 'center',
        height: '60px',
        ...Breakpoints.small({
            marginLeft: tokens.spacingHorizontalM,
            marginRight: '48px', // Space for close button
        }),
    },
    title: {
        flexGrow: 1,
        fontSize: tokens.fontSizeBase500,
        ...Breakpoints.small({
            fontSize: tokens.fontSizeBase400,
        }),
    },
    input: {
        flexGrow: 1,
        ...shorthands.padding(tokens.spacingHorizontalNone),
        ...shorthands.border(tokens.borderRadiusNone),
        backgroundColor: tokens.colorSubtleBackground,
        fontSize: tokens.fontSizeBase500,
    },
    logoContainer: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '100px',
        ...shorthands.padding(tokens.spacingVerticalM),
        ...Breakpoints.small({
            height: '80px',
            padding: tokens.spacingVerticalS,
        }),
    },
    logo: {
        maxWidth: '80%',
        maxHeight: '80%',
        ...Breakpoints.small({
            maxWidth: '150px',
        }),
    },
    feedbackContainer: {
        width: '80%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: tokens.spacingVerticalM,
        ...Breakpoints.small({
            width: '100%',
            padding: tokens.spacingVerticalS,
        }),
    },
    feedbackButton: {
        width: '80%',
        maxWidth: '200px',
        padding: tokens.spacingVerticalM,
        fontSize: 'calc(0.8rem + 0.5vw)',
        marginBottom: '50%',
        ...Breakpoints.small({
            width: '80%',
            maxWidth: '180px',
            fontSize: tokens.fontSizeBase300,
            padding: tokens.spacingVerticalS,
            marginBottom: '30%',
        }),
        backgroundColor: tokens.colorBrandBackground,
        color: tokens.colorNeutralForegroundOnBrand,
        borderRadius: tokens.borderRadiusMedium,
        textAlign: 'center',
        boxShadow: tokens.shadow4,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
            backgroundColor: tokens.colorBrandBackgroundHover,
        },
    },
});

interface ConversationsView {
    latestConversations?: Conversations;
    olderConversations?: Conversations;
}

export const ChatList: FC = () => {
    const classes = useClasses();
    const { features } = useAppSelector((state: RootState) => state.app);
    const { conversations } = useAppSelector((state: RootState) => state.conversations);

    const [isFiltering, setIsFiltering] = useState(false);
    const [filterText, setFilterText] = useState('');
    const [conversationsView, setConversationsView] = useState<ConversationsView>({
        latestConversations: conversations,
    });

    const chat = useChat();
    const fileHandler = useFile();
    const dispatch = useAppDispatch();

    const sortConversations = (conversations: Conversations): ConversationsView => {
        const getTimestamp = (id: string) => {
            const convo = conversations[id];
            if (convo.lastUpdatedTimestamp !== undefined) {
                return convo.lastUpdatedTimestamp;
            }
            // convo.messages is assumed non-empty because a conversation is created with an initial bot message
            const lastMsg = convo.messages[convo.messages.length - 1];
            return lastMsg.timestamp;
        };

        const sortedIds = Object.keys(conversations).sort((a, b) => {
            const tsA = getTimestamp(a);
            const tsB = getTimestamp(b);
            return tsB - tsA; // Newest first
        });

        const latestConversations: Conversations = {};
        const olderConversations: Conversations = {};
        sortedIds.forEach((id) => {
            const timestamp = getTimestamp(id);
            if (isToday(new Date(timestamp))) {
                latestConversations[id] = conversations[id];
            } else {
                olderConversations[id] = conversations[id];
            }
        });
        return {
            latestConversations: latestConversations,
            olderConversations: olderConversations,
        };
    };

    useEffect(() => {
        const nonHiddenConversations: Conversations = {};
        for (const key in conversations) {
            const conversation = conversations[key];
            if (
                !conversation.hidden &&
                (!filterText ||
                    getFriendlyChatName(conversation).toLocaleUpperCase().includes(filterText.toLocaleUpperCase()))
            ) {
                nonHiddenConversations[key] = conversation;
            }
        }

        setConversationsView(sortConversations(nonHiddenConversations));
    }, [conversations, filterText]);

    const onFilterClick = () => {
        setIsFiltering(true);
    };

    const onFilterCancel = () => {
        setFilterText('');
        setIsFiltering(false);
    };

    const onSearch = (ev: React.ChangeEvent<HTMLInputElement>, data: InputOnChangeData) => {
        ev.preventDefault();
        setFilterText(data.value);
    };

    const fileUploaderRef = useRef<HTMLInputElement>(null);
    const onUpload = useCallback(
        (file: File) => {
            fileHandler.loadFile<ChatArchive>(file, chat.uploadBot).catch((error) =>
                dispatch(
                    addAlert({
                        message: `Kunne ikkje lese opplasta fil. ${error instanceof Error ? error.message : ''}`,
                        type: AlertType.Error,
                    }),
                ),
            );
        },
        [fileHandler, chat, dispatch],
    );

    return (
        <div className={classes.root}>
            <div className={classes.header}>
                {features[FeatureKeys.SimplifiedExperience].enabled ? (
                    <>
                        <SimplifiedNewBotMenu onFileUpload={() => fileUploaderRef.current?.click()} />
                        <FileUploader ref={fileUploaderRef} acceptedExtensions={['.json']} onSelectedFile={onUpload} />
                    </>
                ) : (
                    <>
                        {!isFiltering && (
                            <>
                                <Subtitle2Stronger className={classes.title}>Samtaler</Subtitle2Stronger>
                                <Button icon={<Filter20 />} appearance="transparent" onClick={onFilterClick} />
                                <NewBotMenu onFileUpload={() => fileUploaderRef.current?.click()} />
                                <FileUploader
                                    ref={fileUploaderRef}
                                    acceptedExtensions={['.json']}
                                    onSelectedFile={onUpload}
                                />
                            </>
                        )}
                        {isFiltering && (
                            <>
                                <Input
                                    placeholder="Filtrer etter namn"
                                    className={mergeClasses(classes.input, classes.title)}
                                    onChange={onSearch}
                                    autoFocus
                                />
                                <Button icon={<Dismiss20 />} appearance="transparent" onClick={onFilterCancel} />
                            </>
                        )}
                    </>
                )}
            </div>
            <div aria-label={'chat liste'} className={classes.list}>
                {conversationsView.latestConversations && (
                    <ChatListSection header="I dag" conversations={conversationsView.latestConversations} />
                )}
                {conversationsView.olderConversations && (
                    <ChatListSection header="Eldre" conversations={conversationsView.olderConversations} />
                )}
            </div>
            <div className={classes.feedbackContainer}>
                <Button
                    appearance="primary"
                    className={classes.feedbackButton}
                    onClick={() => window.open('https://forms.office.com/e/nPZciRWFFc', '_blank')}
                >
                    Innspel
                </Button>
            </div>
            <div className={classes.logoContainer}>
                <img src={logo} alt="Logo" className={classes.logo} />
            </div>
        </div>
    );
};
