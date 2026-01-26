// Copyright (c) Microsoft. All rights reserved.

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
    Text,
    tokens,
    Tooltip,
} from '@fluentui/react-components';
import {
    Delete20Regular,
    Dismiss24Regular,
    Document20Regular,
    Chat20Regular,
    People20Regular,
    Clock20Regular,
} from '@fluentui/react-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { AuthHelper } from '../../../libs/auth/AuthHelper';
import { ChatService } from '../../../libs/services/ChatService';
import { useAppSelector } from '../../../redux/app/hooks';
import { RootState } from '../../../redux/app/store';
import { ChatState } from '../../../redux/features/conversations/ChatState';
import { Constants } from '../../../Constants';
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
        color: tokens.colorNeutralForegroundOnBrand,
        '&:hover': {
            backgroundColor: tokens.colorPaletteRedForeground1,
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

export const ChatManagementModal: React.FC<ChatManagementModalProps> = ({ isOpen, onClose, onDeleteChats }) => {
    const classes = useClasses();
    const { instance, inProgress } = useMsal();
    const { conversations } = useAppSelector((state: RootState) => state.conversations);

    const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
    const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});
    const [loadingDocuments, setLoadingDocuments] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    const chatService = useMemo(() => new ChatService(), []);

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
            await onDeleteChats(Array.from(selectedChatIds));
            setSelectedChatIds(new Set());
        } finally {
            setIsDeleting(false);
            setShowConfirmDialog(false);
        }
    }, [selectedChatIds, onDeleteChats]);

    const selectedChats = useMemo(() => {
        return sortedChats.filter((c) => selectedChatIds.has(c.id));
    }, [sortedChats, selectedChatIds]);

    const allSelected = selectedChatIds.size === sortedChats.length && sortedChats.length > 0;
    const someSelected = selectedChatIds.size > 0 && selectedChatIds.size < sortedChats.length;

    const getMessageCount = (chat: ChatState): number => {
        // Count only user messages (not system/bot messages)
        return chat.messages.filter((m) => m.userId !== 'bot').length;
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
                                    Du har {sortedChats.length} av {Constants.app.maxChats} samtalar. Vel samtalar å
                                    slette.
                                </Text>
                            </div>
                        </DialogTitle>

                        <DialogContent className={classes.content}>
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

                                    {sortedChats.map((chat) => (
                                        <div
                                            key={chat.id}
                                            className={`${classes.tableRow} ${selectedChatIds.has(chat.id) ? classes.selectedRow : ''}`}
                                        >
                                            <Checkbox
                                                checked={selectedChatIds.has(chat.id)}
                                                onChange={(_, data) => {
                                                    handleSelectChat(chat.id, !!data.checked);
                                                }}
                                                aria-label={`Vel ${chat.title}`}
                                            />

                                            <Tooltip content={chat.title} relationship="label">
                                                <Text className={classes.chatTitle}>{chat.title}</Text>
                                            </Tooltip>

                                            <div className={classes.metricCell}>
                                                <Clock20Regular className={classes.metricIcon} />
                                                <span>{formatRelativeTime(chat.lastUpdatedTimestamp)}</span>
                                            </div>

                                            <div className={classes.metricCell}>
                                                <Chat20Regular className={classes.metricIcon} />
                                                <span>{getMessageCount(chat)}</span>
                                            </div>

                                            <div className={classes.metricCell}>
                                                {loadingDocuments.has(chat.id) ? (
                                                    <Spinner size="tiny" />
                                                ) : (
                                                    <>
                                                        <Document20Regular className={classes.metricIcon} />
                                                        <span>{documentCounts[chat.id] ?? 0}</span>
                                                    </>
                                                )}
                                            </div>

                                            <div className={classes.metricCell}>
                                                <People20Regular className={classes.metricIcon} />
                                                <span>{chat.users.length}</span>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </DialogContent>

                        <DialogActions className={classes.actions}>
                            <div className={classes.selectAllContainer}>
                                {selectedChatIds.size > 0 && (
                                    <Text size={200} className={classes.selectionCount}>
                                        {selectedChatIds.size} vald{selectedChatIds.size === 1 ? '' : 'e'}
                                    </Text>
                                )}
                            </div>

                            <div className={classes.buttonGroup}>
                                <Button
                                    appearance="primary"
                                    icon={<Delete20Regular />}
                                    onClick={handleDeleteClick}
                                    disabled={selectedChatIds.size === 0 || isDeleting}
                                    className={selectedChatIds.size > 0 ? classes.deleteButton : undefined}
                                >
                                    {isDeleting ? <Spinner size="tiny" /> : `Slett valde (${selectedChatIds.size})`}
                                </Button>
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
                chatsToDelete={selectedChats}
                onConfirm={() => {
                    void handleConfirmDelete();
                }}
                onCancel={() => {
                    setShowConfirmDialog(false);
                }}
                isDeleting={isDeleting}
            />
        </>
    );
};
