// Copyright (c) Microsoft. All rights reserved.

import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    makeStyles,
    Persona,
    shorthands,
    Spinner,
    Subtitle2Stronger,
    Text,
    tokens,
} from '@fluentui/react-components';
import { ArrowLeft20Regular, ArrowUndo20Regular, Delete20Regular, DeleteDismiss20Regular } from '@fluentui/react-icons';
import { FC, useCallback, useEffect, useState } from 'react';
import { COPY } from '../../../assets/strings';
import { useChat } from '../../../libs/hooks/useChat';
import {
    IArchivedChatSession,
    formatDeletedDate,
    getDaysUntilDeletion,
} from '../../../libs/models/ArchivedChatSession';
import { ChatService } from '../../../libs/services/ChatService';
import { logger } from '../../../libs/utils/Logger';
import { useAppSelector } from '../../../redux/app/hooks';
import { RootState } from '../../../redux/app/store';
import { FeatureKeys } from '../../../redux/features/app/AppState';
import { Breakpoints, SharedStyles } from '../../../styles';

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
            width: '280px',
            minWidth: '280px',
        }),
    },
    header: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        height: '60px',
        ...shorthands.padding(tokens.spacingVerticalNone, tokens.spacingHorizontalM),
        gap: tokens.spacingHorizontalS,
    },
    title: {
        flexGrow: 1,
        fontSize: tokens.fontSizeBase500,
    },
    list: {
        flexGrow: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        '&:hover': {
            '&::-webkit-scrollbar-thumb': {
                backgroundColor: tokens.colorScrollbarOverlay,
                visibility: 'visible',
            },
        },
        '&::-webkit-scrollbar-track': {
            backgroundColor: tokens.colorSubtleBackground,
        },
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: tokens.colorNeutralForeground3,
        ...shorthands.padding(tokens.spacingVerticalXXL),
        textAlign: 'center',
    },
    emptyIcon: {
        fontSize: '48px',
        marginBottom: tokens.spacingVerticalM,
        color: tokens.colorNeutralForeground4,
    },
    item: {
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
        flexShrink: 0,
        overflow: 'hidden',
        '&:hover': {
            backgroundColor: tokens.colorNeutralBackground1Hover,
        },
    },
    itemBody: {
        minWidth: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        marginLeft: tokens.spacingHorizontalXS,
        alignSelf: 'center',
    },
    itemHeader: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemTitle: {
        ...SharedStyles.overflowEllipsis,
        fontSize: tokens.fontSizeBase300,
        color: tokens.colorNeutralForeground1,
    },
    itemMeta: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalXXS,
    },
    itemTimestamp: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
    },
    itemRetention: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorPaletteRedForeground1,
    },
    itemActions: {
        display: 'flex',
        flexDirection: 'row',
        gap: tokens.spacingHorizontalXS,
        marginTop: tokens.spacingVerticalXS,
    },
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: tokens.spacingVerticalM,
    },
});

interface TrashListProps {
    onBack: () => void;
}

export const TrashList: FC<TrashListProps> = ({ onBack }) => {
    const classes = useClasses();
    const { features } = useAppSelector((state: RootState) => state.app);
    const chat = useChat();
    const chatService = new ChatService();

    const [archivedChats, setArchivedChats] = useState<IArchivedChatSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [restoringId, setRestoringId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadArchivedChats = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const chats = await chatService.getArchivedChatsAsync();
            setArchivedChats(chats);
        } catch (err) {
            logger.error('Failed to load archived chats:', err);
            setError(COPY.TRASH_ERROR);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadArchivedChats();
    }, [loadArchivedChats]);

    const handleRestore = async (chatId: string) => {
        try {
            setRestoringId(chatId);
            await chatService.restoreChatAsync(chatId);
            // Remove from list after successful restore
            setArchivedChats((prev) => prev.filter((c) => c.originalChatId !== chatId));
            // Refresh the main chat list so the restored chat appears
            await chat.loadChats();
        } catch (err) {
            logger.error('Failed to restore chat:', err);
            alert('Kunne ikkje gjenopprette samtalen');
        } finally {
            setRestoringId(null);
        }
    };

    const handlePermanentDelete = async (chatId: string) => {
        try {
            setDeletingId(chatId);
            await chatService.permanentlyDeleteChatAsync(chatId);
            // Remove from list after successful deletion
            setArchivedChats((prev) => prev.filter((c) => c.originalChatId !== chatId));
        } catch (err) {
            logger.error('Failed to permanently delete chat:', err);
            alert('Kunne ikkje slette samtalen permanent');
        } finally {
            setDeletingId(null);
        }
    };

    const botProfilePicture = features[FeatureKeys.DarkMode].enabled
        ? '/assets/bot-icon-dark.png'
        : '/assets/bot-icon-light.png';

    if (loading) {
        return (
            <div className={classes.root}>
                <div className={classes.header}>
                    <Button icon={<ArrowLeft20Regular />} appearance="subtle" onClick={onBack} title="Tilbake" />
                    <Subtitle2Stronger className={classes.title}>Papirkorg</Subtitle2Stronger>
                </div>
                <div className={classes.loadingContainer}>
                    <Spinner size="medium" />
                    <Text>{COPY.TRASH_LOADING}</Text>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={classes.root}>
                <div className={classes.header}>
                    <Button icon={<ArrowLeft20Regular />} appearance="subtle" onClick={onBack} title="Tilbake" />
                    <Subtitle2Stronger className={classes.title}>Papirkorg</Subtitle2Stronger>
                </div>
                <div className={classes.emptyState}>
                    <Text>{error}</Text>
                    <Button appearance="primary" onClick={() => void loadArchivedChats()} style={{ marginTop: '16px' }}>
                        Prøv igjen
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={classes.root}>
            <div className={classes.header}>
                <Button icon={<ArrowLeft20Regular />} appearance="subtle" onClick={onBack} title="Tilbake" />
                <Subtitle2Stronger className={classes.title}>Papirkorg</Subtitle2Stronger>
            </div>

            {archivedChats.length === 0 ? (
                <div className={classes.emptyState}>
                    <DeleteDismiss20Regular className={classes.emptyIcon} />
                    <Text size={400} weight="semibold">
                        {COPY.TRASH_EMPTY}
                    </Text>
                    <Text size={300}>Sletta samtaler vil vises her i 180 dagar</Text>
                </div>
            ) : (
                <div className={classes.list}>
                    {archivedChats.map((chat) => {
                        const daysRemaining = getDaysUntilDeletion(chat.deletedAt);
                        const isRestoring = restoringId === chat.originalChatId;
                        const isDeleting = deletingId === chat.originalChatId;
                        const isProcessing = isRestoring || isDeleting;

                        return (
                            <div key={chat.id} className={classes.item}>
                                <Persona avatar={{ image: { src: botProfilePicture } }} />
                                <div className={classes.itemBody}>
                                    <div className={classes.itemHeader}>
                                        <Text className={classes.itemTitle} title={chat.title}>
                                            {chat.title}
                                        </Text>
                                    </div>
                                    <div className={classes.itemMeta}>
                                        <Text className={classes.itemTimestamp}>
                                            Sletta: {formatDeletedDate(chat.deletedAt)}
                                        </Text>
                                        <Text className={classes.itemRetention}>
                                            {daysRemaining > 0
                                                ? COPY.DAYS_UNTIL_DELETE(daysRemaining)
                                                : 'Vil snart bli sletta permanent'}
                                        </Text>
                                    </div>
                                    <div className={classes.itemActions}>
                                        <Button
                                            icon={isRestoring ? <Spinner size="tiny" /> : <ArrowUndo20Regular />}
                                            appearance="subtle"
                                            size="small"
                                            onClick={() => void handleRestore(chat.originalChatId)}
                                            disabled={isProcessing}
                                        >
                                            Gjenopprett
                                        </Button>
                                        <Dialog>
                                            <DialogTrigger disableButtonEnhancement>
                                                <Button
                                                    icon={isDeleting ? <Spinner size="tiny" /> : <Delete20Regular />}
                                                    appearance="subtle"
                                                    size="small"
                                                    disabled={isProcessing}
                                                >
                                                    Slett permanent
                                                </Button>
                                            </DialogTrigger>
                                            <DialogSurface>
                                                <DialogBody>
                                                    <DialogTitle>Slett permanent?</DialogTitle>
                                                    <DialogContent>{COPY.TRASH_DELETE_CONFIRM}</DialogContent>
                                                    <DialogActions>
                                                        <DialogTrigger disableButtonEnhancement>
                                                            <Button appearance="secondary">Avbryt</Button>
                                                        </DialogTrigger>
                                                        <Button
                                                            appearance="primary"
                                                            onClick={() =>
                                                                void handlePermanentDelete(chat.originalChatId)
                                                            }
                                                        >
                                                            Slett permanent
                                                        </Button>
                                                    </DialogActions>
                                                </DialogBody>
                                            </DialogSurface>
                                        </Dialog>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
