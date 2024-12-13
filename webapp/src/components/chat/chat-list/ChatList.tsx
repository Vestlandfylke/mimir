// Copyright (c) Microsoft. All rights reserved.
import logo from '../../../assets/logo.png';
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
            width: '80px',
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
            justifyContent: 'center',
        }),
    },
    title: {
        flexGrow: 1,
        ...Breakpoints.small({
            display: 'none',
        }),
        fontSize: tokens.fontSizeBase500,
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
            padding: '0',
        }),
    },
    logo: {
        maxWidth: '80%',
        maxHeight: '80%',
        ...Breakpoints.small({
            width: '97%',
            maxWidth: '80px',
            padding: '0',
        }),
    },
    feedbackContainer: {
        width: '80%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: tokens.spacingVerticalM,
    },
    feedbackButton: {
        width: '80%',
        maxWidth: '200px',
        padding: tokens.spacingVerticalM,
        fontSize: 'calc(0.8rem + 0.5vw)',
        marginBottom: '50%',
        ...Breakpoints.small({
            width: '50%',
            maxWidth: '80px',
            fontSize: 'calc(0.4rem + 0.4vw)',
            padding: '8px',
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
        const sortedIds = Object.keys(conversations).sort((a, b) => {
            if (conversations[a].lastUpdatedTimestamp === undefined) {
                return 1;
            }
            if (conversations[b].lastUpdatedTimestamp === undefined) {
                return -1;
            }

            return conversations[a].lastUpdatedTimestamp - conversations[b].lastUpdatedTimestamp;
        });

        const latestConversations: Conversations = {};
        const olderConversations: Conversations = {};
        sortedIds.forEach((id) => {
            if (isToday(new Date(conversations[id].lastUpdatedTimestamp ?? 0))) {
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
                        message: `Failed to parse uploaded file. ${error instanceof Error ? error.message : ''}`,
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
                    <SimplifiedNewBotMenu onFileUpload={() => fileUploaderRef.current?.click()} />
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
                    Tilbakemelding
                </Button>
            </div>
            <div className={classes.logoContainer}>
                <img src={logo} alt="Logo" className={classes.logo} />
            </div>
        </div>
    );
};
