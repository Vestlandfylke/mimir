// Copyright (c) Microsoft. All rights reserved.

import { useMsal } from '@azure/msal-react';
import {
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    makeStyles,
    shorthands,
    Spinner,
    Tab,
    TabList,
    Text,
    tokens,
    Tooltip,
} from '@fluentui/react-components';
import {
    ArrowUndo20Regular,
    Chat20Regular,
    Clock20Regular,
    Delete20Regular,
    DeleteDismiss20Regular,
    Dismiss24Regular,
    Document20Regular,
    People20Regular,
    PersonDeleteRegular,
} from '@fluentui/react-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Constants } from '../../../Constants';
import { AuthHelper } from '../../../libs/auth/AuthHelper';
import { useChat } from '../../../libs/hooks';
import { getDaysUntilDeletion, IArchivedChatSession } from '../../../libs/models/ArchivedChatSession';
import { ChatService } from '../../../libs/services/ChatService';
import { logger } from '../../../libs/utils/Logger';
import { useAppSelector } from '../../../redux/app/hooks';
import { RootState } from '../../../redux/app/store';
import { ChatState } from '../../../redux/features/conversations/ChatState';
import { ScrollBarStyles } from '../../../styles';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

// Mobile breakpoint
const MOBILE_BREAKPOINT = '768px';

const useClasses = makeStyles({
    surface: {
        maxWidth: '900px',
        width: '90vw',
        maxHeight: '85vh',
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            width: '95vw',
            maxWidth: '95vw',
            maxHeight: '90vh',
            ...shorthands.borderRadius(tokens.borderRadiusLarge),
        },
    },
    header: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
    },
    subtitle: {
        color: tokens.colorNeutralForeground2,
        fontSize: tokens.fontSizeBase300,
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
        minHeight: '300px',
        maxHeight: '60vh',
        ...ScrollBarStyles,
    },
    tableHeader: {
        display: 'grid',
        gridTemplateColumns: '40px 1fr 100px 80px 80px 80px',
        gap: tokens.spacingHorizontalS,
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
        backgroundColor: tokens.colorNeutralBackground3,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        fontWeight: tokens.fontWeightSemibold,
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground2,
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            gridTemplateColumns: '40px 1fr 80px',
            '& > *:nth-child(4)': { display: 'none' },
            '& > *:nth-child(5)': { display: 'none' },
            '& > *:nth-child(6)': { display: 'none' },
        },
    },
    tableRow: {
        display: 'grid',
        gridTemplateColumns: '40px 1fr 100px 80px 80px 80px',
        gap: tokens.spacingHorizontalS,
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        alignItems: 'center',
        '&:hover': {
            backgroundColor: tokens.colorNeutralBackground2Hover,
        },
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            gridTemplateColumns: '40px 1fr 80px',
            '& > *:nth-child(4)': { display: 'none' },
            '& > *:nth-child(5)': { display: 'none' },
            '& > *:nth-child(6)': { display: 'none' },
        },
    },
    selectedRow: {
        backgroundColor: tokens.colorNeutralBackground2Selected,
    },
    chatTitle: {
        ...shorthands.overflow('hidden'),
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontWeight: tokens.fontWeightSemibold,
    },
    metricCell: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground2,
    },
    metricIcon: {
        fontSize: '16px',
    },
    actions: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: tokens.spacingHorizontalM,
        ...shorthands.padding(tokens.spacingVerticalM, 0, 0, 0),
    },
    deleteButton: {
        backgroundColor: tokens.colorPaletteRedBackground3,
        color: '#1a1a1a',
        '&:hover': {
            backgroundColor: tokens.colorPaletteRedForeground1,
            color: '#1a1a1a',
        },
    },
    selectAllContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
    },
    selectionCount: {
        color: tokens.colorNeutralForeground2,
    },
    buttonGroup: {
        display: 'flex',
        gap: tokens.spacingHorizontalM,
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        ...shorthands.padding(tokens.spacingVerticalXXL),
        color: tokens.colorNeutralForeground3,
    },
    loadingCell: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabList: {
        marginBottom: tokens.spacingVerticalM,
    },
    daysRemaining: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
    },
    warningDays: {
        color: tokens.colorPaletteRedForeground1,
    },
    joinedBadge: {
        fontSize: tokens.fontSizeBase100,
        color: tokens.colorNeutralForeground3,
        backgroundColor: tokens.colorNeutralBackground5,
        ...shorthands.padding('1px', tokens.spacingHorizontalXS),
        ...shorthands.borderRadius(tokens.borderRadiusSmall),
        marginLeft: tokens.spacingHorizontalXS,
        whiteSpace: 'nowrap' as const,
    },
    leaveButton: {
        backgroundColor: tokens.colorPaletteMarigoldBackground3,
        color: '#1a1a1a',
        '&:hover': {
            backgroundColor: tokens.colorPaletteMarigoldForeground1,
            color: '#1a1a1a',
        },
    },
});

interface ChatManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDeleteChats: (chatIds: string[]) => Promise<void>;
}

/**
 * Formats a timestamp as a relative time string in Norwegian (Nynorsk)
 */
function formatRelativeTime(timestamp: number | undefined): string {
    if (!timestamp) return 'Ukjent';

    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 30) {
        const months = Math.floor(days / 30);
        return months === 1 ? '1 månad sidan' : `${months} månader sidan`;
    }
    if (days > 0) {
        return days === 1 ? 'i går' : `${days} dagar sidan`;
    }
    if (hours > 0) {
        return hours === 1 ? '1 time sidan' : `${hours} timar sidan`;
    }
    if (minutes > 0) {
        return minutes === 1 ? '1 minutt sidan' : `${minutes} minutt sidan`;
    }
    return 'akkurat no';
}

type TabValue = 'active' | 'archived';

export const ChatManagementModal: React.FC<ChatManagementModalProps> = ({ isOpen, onClose, onDeleteChats }) => {
    const classes = useClasses();
    const { instance, inProgress } = useMsal();
    const { conversations } = useAppSelector((state: RootState) => state.conversations);
    const { activeUserInfo } = useAppSelector((state: RootState) => state.app);
    const chat = useChat();

    const [activeTab, setActiveTab] = useState<TabValue>('active');
    const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
    const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});
    const [loadingDocuments, setLoadingDocuments] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    // Archived chats state
    const [archivedChats, setArchivedChats] = useState<IArchivedChatSession[]>([]);
    const [loadingArchived, setLoadingArchived] = useState(false);
    const [archivedError, setArchivedError] = useState<string | null>(null);
    const [selectedArchivedIds, setSelectedArchivedIds] = useState<Set<string>>(new Set());
    const [isRestoring, setIsRestoring] = useState(false);
    const [isPermanentlyDeleting, setIsPermanentlyDeleting] = useState(false);
    const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);

    const chatService = useMemo(() => new ChatService(), []);

    // Determine if the current user is the creator of a chat
    const isCreator = useCallback(
        (chatItem: ChatState): boolean => {
            return !chatItem.createdBy || chatItem.createdBy === activeUserInfo?.id;
        },
        [activeUserInfo],
    );

    // Get non-hidden chats sorted by oldest first
    const sortedChats = useMemo(() => {
        return Object.values(conversations)
            .filter((c) => !c.hidden && !c.disabled)
            .sort((a, b) => {
                const timeA = a.lastUpdatedTimestamp ?? 0;
                const timeB = b.lastUpdatedTimestamp ?? 0;
                return timeA - timeB; // Ascending (oldest first)
            });
    }, [conversations]);

    // Fetch document counts for all chats when modal opens
    useEffect(() => {
        if (!isOpen) {
            // Reset state when modal closes
            setSelectedChatIds(new Set());
            setDocumentCounts({});
            setLoadingDocuments(new Set());
            return;
        }

        const fetchDocumentCounts = async () => {
            const accessToken = await AuthHelper.getSKaaSAccessToken(instance, inProgress);

            // Mark all chats as loading
            setLoadingDocuments(new Set(sortedChats.map((c) => c.id)));

            // Fetch document counts in parallel
            const promises = sortedChats.map(async (chat) => {
                try {
                    const documents = await chatService.getChatMemorySourcesAsync(chat.id, accessToken);
                    return { chatId: chat.id, count: documents.length };
                } catch {
                    return { chatId: chat.id, count: 0 };
                }
            });

            const results = await Promise.all(promises);

            const counts: Record<string, number> = {};
            results.forEach((result) => {
                counts[result.chatId] = result.count;
            });

            setDocumentCounts(counts);
            setLoadingDocuments(new Set());
        };

        void fetchDocumentCounts();
    }, [isOpen, sortedChats, instance, inProgress, chatService]);

    // Fetch archived chats when archive tab is opened
    useEffect(() => {
        if (!isOpen || activeTab !== 'archived') {
            return;
        }

        const fetchArchivedChats = async () => {
            setLoadingArchived(true);
            setArchivedError(null);

            try {
                const accessToken = await AuthHelper.getSKaaSAccessToken(instance, inProgress);
                const archived = await chatService.getArchivedChatsAsync(accessToken);
                // Sort by deletion date, most recent first
                archived.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
                setArchivedChats(archived);
            } catch (error) {
                logger.error('Failed to fetch archived chats:', error);
                setArchivedError('Kunne ikkje laste sletta samtalar.');
            } finally {
                setLoadingArchived(false);
            }
        };

        void fetchArchivedChats();
    }, [isOpen, activeTab, instance, inProgress, chatService]);

    // Reset archived selection when tab changes or modal closes
    useEffect(() => {
        if (!isOpen) {
            setActiveTab('active');
            setSelectedArchivedIds(new Set());
            setArchivedChats([]);
        }
    }, [isOpen]);

    const handleSelectChat = useCallback((chatId: string, checked: boolean) => {
        setSelectedChatIds((prev) => {
            const next = new Set(prev);
            if (checked) {
                next.add(chatId);
            } else {
                next.delete(chatId);
            }
            return next;
        });
    }, []);

    const handleSelectAll = useCallback(
        (checked: boolean) => {
            if (checked) {
                setSelectedChatIds(new Set(sortedChats.map((c) => c.id)));
            } else {
                setSelectedChatIds(new Set());
            }
        },
        [sortedChats],
    );

    const handleDeleteClick = useCallback(() => {
        if (selectedChatIds.size === 0) return;
        setShowConfirmDialog(true);
    }, [selectedChatIds]);

    const handleConfirmDelete = useCallback(async () => {
        if (selectedChatIds.size === 0) return;

        setIsDeleting(true);
        try {
            // Split selected chats into owned (delete) and joined (leave)
            const ownedChatIds: string[] = [];
            const joinedChatIds: string[] = [];

            for (const chatId of selectedChatIds) {
                const chatItem = conversations[chatId];
                if (!isCreator(chatItem) && chatItem.users.length > 1) {
                    joinedChatIds.push(chatId);
                } else {
                    ownedChatIds.push(chatId);
                }
            }

            // Delete owned chats
            if (ownedChatIds.length > 0) {
                await onDeleteChats(ownedChatIds);
            }

            // Leave joined chats
            for (const chatId of joinedChatIds) {
                await chat.leaveChat(chatId);
            }

            setSelectedChatIds(new Set());
        } finally {
            setIsDeleting(false);
            setShowConfirmDialog(false);
        }
    }, [selectedChatIds, onDeleteChats, conversations, isCreator, chat]);

    const selectedChats = useMemo(() => {
        return sortedChats.filter((c) => selectedChatIds.has(c.id));
    }, [sortedChats, selectedChatIds]);

    // Split selected chats into owned and joined for display
    const { ownedSelectedChats, joinedSelectedChats } = useMemo(() => {
        const owned: ChatState[] = [];
        const joined: ChatState[] = [];
        for (const chatItem of selectedChats) {
            if (!isCreator(chatItem) && chatItem.users.length > 1) {
                joined.push(chatItem);
            } else {
                owned.push(chatItem);
            }
        }
        return { ownedSelectedChats: owned, joinedSelectedChats: joined };
    }, [selectedChats, isCreator]);

    const allSelected = selectedChatIds.size === sortedChats.length && sortedChats.length > 0;
    const someSelected = selectedChatIds.size > 0 && selectedChatIds.size < sortedChats.length;

    // Archived chats handlers
    const handleSelectArchivedChat = useCallback((chatId: string, checked: boolean) => {
        setSelectedArchivedIds((prev) => {
            const next = new Set(prev);
            if (checked) {
                next.add(chatId);
            } else {
                next.delete(chatId);
            }
            return next;
        });
    }, []);

    const handleSelectAllArchived = useCallback(
        (checked: boolean) => {
            if (checked) {
                setSelectedArchivedIds(new Set(archivedChats.map((c) => c.id)));
            } else {
                setSelectedArchivedIds(new Set());
            }
        },
        [archivedChats],
    );

    const handleRestoreClick = useCallback(async () => {
        if (selectedArchivedIds.size === 0) return;

        setIsRestoring(true);
        try {
            const accessToken = await AuthHelper.getSKaaSAccessToken(instance, inProgress);

            // Restore selected chats one by one using the original chat ID
            for (const archivedId of selectedArchivedIds) {
                const archivedChat = archivedChats.find((c) => c.id === archivedId);
                if (archivedChat) {
                    // The restore endpoint expects the original chat ID, not the archived record ID
                    await chatService.restoreChatAsync(archivedChat.originalChatId, accessToken);
                }
            }

            // Refresh both lists
            setSelectedArchivedIds(new Set());
            setArchivedChats((prev) => prev.filter((c) => !selectedArchivedIds.has(c.id)));

            // Refresh the main chat list
            await chat.loadChats();
        } catch (error) {
            logger.error('Failed to restore chats:', error);
        } finally {
            setIsRestoring(false);
        }
    }, [selectedArchivedIds, archivedChats, instance, inProgress, chatService, chat]);

    const handlePermanentDeleteClick = useCallback(() => {
        if (selectedArchivedIds.size === 0) return;
        setShowPermanentDeleteConfirm(true);
    }, [selectedArchivedIds]);

    const handleConfirmPermanentDelete = useCallback(async () => {
        if (selectedArchivedIds.size === 0) return;

        setIsPermanentlyDeleting(true);
        try {
            const accessToken = await AuthHelper.getSKaaSAccessToken(instance, inProgress);

            // Permanently delete selected chats one by one using the original chat ID
            for (const archivedId of selectedArchivedIds) {
                const archivedChat = archivedChats.find((c) => c.id === archivedId);
                if (archivedChat) {
                    // The permanent delete endpoint expects the original chat ID, not the archived record ID
                    await chatService.permanentlyDeleteChatAsync(archivedChat.originalChatId, accessToken);
                }
            }

            // Remove from list
            setSelectedArchivedIds(new Set());
            setArchivedChats((prev) => prev.filter((c) => !selectedArchivedIds.has(c.id)));
        } catch (error) {
            logger.error('Failed to permanently delete chats:', error);
        } finally {
            setIsPermanentlyDeleting(false);
            setShowPermanentDeleteConfirm(false);
        }
    }, [selectedArchivedIds, archivedChats, instance, inProgress, chatService]);

    const allArchivedSelected = selectedArchivedIds.size === archivedChats.length && archivedChats.length > 0;
    const someArchivedSelected = selectedArchivedIds.size > 0 && selectedArchivedIds.size < archivedChats.length;

    const getMessageCount = (chat: ChatState): number => {
        // Count only user messages (not system/bot messages)
        return chat.messages.filter((m) => m.userId !== 'bot').length;
    };

    const renderActiveChatsView = () => (
        <>
            {sortedChats.length === 0 ? (
                <div className={classes.emptyState}>
                    <Text>Ingen samtalar å vise</Text>
                </div>
            ) : (
                <>
                    <div className={classes.tableHeader}>
                        <Checkbox
                            checked={allSelected ? true : someSelected ? 'mixed' : false}
                            onChange={(_, data) => {
                                handleSelectAll(!!data.checked);
                            }}
                            aria-label="Vel alle"
                        />
                        <span>Tittel</span>
                        <span>Sist aktiv</span>
                        <span>Meldingar</span>
                        <span>Dokument</span>
                        <span>Deltakarar</span>
                    </div>

                    {sortedChats.map((chatItem) => {
                        const isJoinedChat = !isCreator(chatItem) && chatItem.users.length > 1;
                        return (
                            <div
                                key={chatItem.id}
                                className={`${classes.tableRow} ${selectedChatIds.has(chatItem.id) ? classes.selectedRow : ''}`}
                            >
                                <Checkbox
                                    checked={selectedChatIds.has(chatItem.id)}
                                    onChange={(_, data) => {
                                        handleSelectChat(chatItem.id, !!data.checked);
                                    }}
                                    aria-label={`Vel ${chatItem.title}`}
                                />

                                <Tooltip
                                    content={
                                        isJoinedChat
                                            ? `${chatItem.title} (delt samtale – du kan forlate)`
                                            : chatItem.title
                                    }
                                    relationship="label"
                                >
                                    <Text className={classes.chatTitle}>
                                        {chatItem.title}
                                        {isJoinedChat && <span className={classes.joinedBadge}>Delt</span>}
                                    </Text>
                                </Tooltip>

                                <div className={classes.metricCell}>
                                    <Clock20Regular className={classes.metricIcon} />
                                    <span>{formatRelativeTime(chatItem.lastUpdatedTimestamp)}</span>
                                </div>

                                <div className={classes.metricCell}>
                                    <Chat20Regular className={classes.metricIcon} />
                                    <span>{getMessageCount(chatItem)}</span>
                                </div>

                                <div className={classes.metricCell}>
                                    {loadingDocuments.has(chatItem.id) ? (
                                        <Spinner size="tiny" />
                                    ) : (
                                        <>
                                            <Document20Regular className={classes.metricIcon} />
                                            <span>{documentCounts[chatItem.id] ?? 0}</span>
                                        </>
                                    )}
                                </div>

                                <div className={classes.metricCell}>
                                    <People20Regular className={classes.metricIcon} />
                                    <span>{chatItem.users.length}</span>
                                </div>
                            </div>
                        );
                    })}
                </>
            )}
        </>
    );

    const renderArchivedChatsView = () => {
        if (loadingArchived) {
            return (
                <div className={classes.emptyState}>
                    <Spinner size="medium" />
                    <Text style={{ marginTop: tokens.spacingVerticalM }}>Lastar sletta samtalar...</Text>
                </div>
            );
        }

        if (archivedError) {
            return (
                <div className={classes.emptyState}>
                    <Text>{archivedError}</Text>
                </div>
            );
        }

        if (archivedChats.length === 0) {
            return (
                <div className={classes.emptyState}>
                    <Text>Ingen sletta samtalar å gjenopprette.</Text>
                </div>
            );
        }

        return (
            <>
                <div className={classes.tableHeader}>
                    <Checkbox
                        checked={allArchivedSelected ? true : someArchivedSelected ? 'mixed' : false}
                        onChange={(_, data) => {
                            handleSelectAllArchived(!!data.checked);
                        }}
                        aria-label="Vel alle"
                    />
                    <span>Tittel</span>
                    <span>Sletta</span>
                    <span>Meldingar</span>
                    <span>Dokument</span>
                    <span>Deltakarar</span>
                </div>

                {archivedChats.map((archivedChat) => {
                    const daysRemaining = getDaysUntilDeletion(archivedChat.deletedAt);
                    const isWarning = daysRemaining <= 30;

                    return (
                        <div
                            key={archivedChat.id}
                            className={`${classes.tableRow} ${selectedArchivedIds.has(archivedChat.id) ? classes.selectedRow : ''}`}
                        >
                            <Checkbox
                                checked={selectedArchivedIds.has(archivedChat.id)}
                                onChange={(_, data) => {
                                    handleSelectArchivedChat(archivedChat.id, !!data.checked);
                                }}
                                aria-label={`Vel ${archivedChat.title}`}
                            />

                            <Tooltip
                                content={
                                    <div>
                                        <div>{archivedChat.title}</div>
                                        <div style={{ fontSize: '0.85em', opacity: 0.8 }}>
                                            {daysRemaining} {daysRemaining === 1 ? 'dag' : 'dagar'} til sletting
                                            {isWarning && ' ⚠️'}
                                        </div>
                                    </div>
                                }
                                relationship="label"
                            >
                                <Text className={classes.chatTitle}>{archivedChat.title}</Text>
                            </Tooltip>

                            <div className={classes.metricCell}>
                                <Clock20Regular className={classes.metricIcon} />
                                <span>{formatRelativeTime(new Date(archivedChat.deletedAt).getTime())}</span>
                            </div>

                            <div className={classes.metricCell}>
                                <Chat20Regular className={classes.metricIcon} />
                                <span>{archivedChat.messageCount}</span>
                            </div>

                            <div className={classes.metricCell}>
                                <Document20Regular className={classes.metricIcon} />
                                <span>{archivedChat.documentCount}</span>
                            </div>

                            <div className={classes.metricCell}>
                                <People20Regular className={classes.metricIcon} />
                                <span>{archivedChat.participantCount}</span>
                            </div>
                        </div>
                    );
                })}
            </>
        );
    };

    return (
        <>
            <Dialog
                open={isOpen}
                onOpenChange={(_, data) => {
                    if (!data.open) {
                        onClose();
                    }
                }}
            >
                <DialogSurface className={classes.surface}>
                    <DialogBody>
                        <DialogTitle
                            action={
                                <DialogTrigger action="close">
                                    <Button appearance="subtle" aria-label="Lukk" icon={<Dismiss24Regular />} />
                                </DialogTrigger>
                            }
                        >
                            <div className={classes.header}>
                                <span>Administrer samtalar</span>
                                <Text className={classes.subtitle}>
                                    {activeTab === 'active'
                                        ? `Du har ${sortedChats.length} av ${Constants.app.maxChats} samtalar. Vel samtalar å slette eller forlate.`
                                        : `${archivedChats.length} sletta samtalar. Samtalar vert permanent sletta etter 180 dagar.`}
                                </Text>
                            </div>
                        </DialogTitle>

                        <TabList
                            className={classes.tabList}
                            selectedValue={activeTab}
                            onTabSelect={(_, data) => {
                                setActiveTab(data.value as TabValue);
                            }}
                        >
                            <Tab value="active">Aktive samtalar</Tab>
                            <Tab value="archived">Papirkorg</Tab>
                        </TabList>

                        <DialogContent className={classes.content}>
                            {activeTab === 'active' ? renderActiveChatsView() : renderArchivedChatsView()}
                        </DialogContent>

                        <DialogActions className={classes.actions}>
                            <div className={classes.selectAllContainer}>
                                {activeTab === 'active' && selectedChatIds.size > 0 && (
                                    <Text size={200} className={classes.selectionCount}>
                                        {selectedChatIds.size} vald{selectedChatIds.size === 1 ? '' : 'e'}
                                    </Text>
                                )}
                                {activeTab === 'archived' && selectedArchivedIds.size > 0 && (
                                    <Text size={200} className={classes.selectionCount}>
                                        {selectedArchivedIds.size} vald{selectedArchivedIds.size === 1 ? '' : 'e'}
                                    </Text>
                                )}
                            </div>

                            <div className={classes.buttonGroup}>
                                {activeTab === 'active' ? (
                                    <Button
                                        appearance="primary"
                                        icon={
                                            joinedSelectedChats.length > 0 && ownedSelectedChats.length === 0 ? (
                                                <PersonDeleteRegular />
                                            ) : (
                                                <Delete20Regular />
                                            )
                                        }
                                        onClick={handleDeleteClick}
                                        disabled={selectedChatIds.size === 0 || isDeleting}
                                        className={
                                            selectedChatIds.size > 0
                                                ? joinedSelectedChats.length > 0 && ownedSelectedChats.length === 0
                                                    ? classes.leaveButton
                                                    : classes.deleteButton
                                                : undefined
                                        }
                                    >
                                        {isDeleting ? (
                                            <Spinner size="tiny" />
                                        ) : ownedSelectedChats.length > 0 && joinedSelectedChats.length > 0 ? (
                                            `Slett (${ownedSelectedChats.length}) / Forlat (${joinedSelectedChats.length})`
                                        ) : joinedSelectedChats.length > 0 ? (
                                            `Forlat valde (${joinedSelectedChats.length})`
                                        ) : (
                                            `Slett valde (${ownedSelectedChats.length})`
                                        )}
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            appearance="primary"
                                            icon={<ArrowUndo20Regular />}
                                            onClick={() => {
                                                void handleRestoreClick();
                                            }}
                                            disabled={selectedArchivedIds.size === 0 || isRestoring}
                                        >
                                            {isRestoring ? (
                                                <Spinner size="tiny" />
                                            ) : (
                                                `Gjenopprett (${selectedArchivedIds.size})`
                                            )}
                                        </Button>
                                        <Button
                                            appearance="secondary"
                                            icon={<DeleteDismiss20Regular />}
                                            onClick={handlePermanentDeleteClick}
                                            disabled={selectedArchivedIds.size === 0 || isPermanentlyDeleting}
                                        >
                                            {isPermanentlyDeleting ? (
                                                <Spinner size="tiny" />
                                            ) : (
                                                `Slett permanent (${selectedArchivedIds.size})`
                                            )}
                                        </Button>
                                    </>
                                )}
                                <Button appearance="secondary" onClick={onClose}>
                                    Lukk
                                </Button>
                            </div>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>

            <DeleteConfirmDialog
                isOpen={showConfirmDialog}
                chatsToDelete={ownedSelectedChats}
                chatsToLeave={joinedSelectedChats}
                onConfirm={() => {
                    void handleConfirmDelete();
                }}
                onCancel={() => {
                    setShowConfirmDialog(false);
                }}
                isDeleting={isDeleting}
            />

            {/* Permanent delete confirmation dialog */}
            <Dialog
                open={showPermanentDeleteConfirm}
                onOpenChange={(_, data) => {
                    if (!data.open) {
                        setShowPermanentDeleteConfirm(false);
                    }
                }}
            >
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>Slett permanent</DialogTitle>
                        <DialogContent>
                            <Text>
                                Er du sikker på at du vil slette {selectedArchivedIds.size} samtale
                                {selectedArchivedIds.size === 1 ? '' : 'r'} permanent? Dette kan ikkje angrast.
                            </Text>
                        </DialogContent>
                        <DialogActions>
                            <Button
                                appearance="secondary"
                                onClick={() => {
                                    setShowPermanentDeleteConfirm(false);
                                }}
                            >
                                Avbryt
                            </Button>
                            <Button
                                appearance="primary"
                                onClick={() => {
                                    void handleConfirmPermanentDelete();
                                }}
                                disabled={isPermanentlyDeleting}
                            >
                                {isPermanentlyDeleting ? <Spinner size="tiny" /> : 'Slett permanent'}
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </>
    );
};
