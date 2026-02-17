// Copyright (c) Microsoft. All rights reserved.

import { useMsal } from '@azure/msal-react';
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
    shorthands,
    Spinner,
    Text,
    tokens,
    Tooltip,
} from '@fluentui/react-components';
import {
    ArrowDownload20Regular,
    Delete20Regular,
    Dismiss24Regular,
    Document20Regular,
    DocumentPdf20Regular,
    Image20Regular,
    SlideText20Regular,
    Table20Regular,
    TextDescription20Regular,
} from '@fluentui/react-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthHelper } from '../../libs/auth/AuthHelper';
import { FileService, IGeneratedFileInfo } from '../../libs/services/FileService';
import { BackendServiceUrl } from '../../libs/services/BaseService';
import { ScrollBarStyles } from '../../styles';

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
        gap: tokens.spacingVerticalXS,
        minHeight: '300px',
        maxHeight: '60vh',
        ...ScrollBarStyles,
    },
    tableHeader: {
        display: 'grid',
        gridTemplateColumns: '32px 1fr 100px 100px 100px 80px',
        gap: tokens.spacingHorizontalS,
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
        backgroundColor: tokens.colorNeutralBackground3,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        fontWeight: tokens.fontWeightSemibold,
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground2,
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            gridTemplateColumns: '32px 1fr 80px',
            '& > *:nth-child(3)': { display: 'none' },
            '& > *:nth-child(4)': { display: 'none' },
            '& > *:nth-child(5)': { display: 'none' },
        },
    },
    tableRow: {
        display: 'grid',
        gridTemplateColumns: '32px 1fr 100px 100px 100px 80px',
        gap: tokens.spacingHorizontalS,
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        alignItems: 'center',
        '&:hover': {
            backgroundColor: tokens.colorNeutralBackground2Hover,
        },
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            gridTemplateColumns: '32px 1fr 80px',
            '& > *:nth-child(3)': { display: 'none' },
            '& > *:nth-child(4)': { display: 'none' },
            '& > *:nth-child(5)': { display: 'none' },
        },
    },
    fileName: {
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
    actionsCell: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
        justifyContent: 'flex-end',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        ...shorthands.padding(tokens.spacingVerticalXXL),
        color: tokens.colorNeutralForeground3,
        gap: tokens.spacingVerticalS,
    },
    fileIcon: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerInfo: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
    },
});

interface FileManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function getFileIcon(fileName: string, contentType: string): React.ReactElement {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

    switch (ext) {
        case 'pdf':
            return <DocumentPdf20Regular />;
        case 'pptx':
        case 'ppt':
            return <SlideText20Regular />;
        case 'xlsx':
        case 'xls':
        case 'csv':
            return <Table20Regular />;
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'svg':
            return <Image20Regular />;
        case 'md':
        case 'txt':
            return <TextDescription20Regular />;
        case 'docx':
        case 'doc':
            return <Document20Regular />;
        default:
            if (contentType.startsWith('image/')) return <Image20Regular />;
            return <Document20Regular />;
    }
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('nb-NO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return 'Ukjent';
    }
}

function formatExpiresOn(dateString: string | null): string {
    if (!dateString) return 'Aldri';
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return 'Utløpt';
        if (diffDays === 1) return '1 dag';
        return `${diffDays} dagar`;
    } catch {
        return 'Ukjent';
    }
}

export const FileManagementModal: React.FC<FileManagementModalProps> = ({ isOpen, onClose }) => {
    const classes = useClasses();
    const { instance, inProgress } = useMsal();

    const [files, setFiles] = useState<IGeneratedFileInfo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deletingFileIds, setDeletingFileIds] = useState<Set<string>>(new Set());
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const fileService = useMemo(() => new FileService(), []);

    // Fetch files when modal opens
    useEffect(() => {
        if (!isOpen) {
            setFiles([]);
            setError(null);
            setDeletingFileIds(new Set());
            setConfirmDeleteId(null);
            return;
        }

        const fetchFiles = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const accessToken = await AuthHelper.getSKaaSAccessToken(instance, inProgress);
                const result = await fileService.getMyFilesAsync(accessToken);
                setFiles(result);
            } catch (err) {
                setError('Kunne ikkje laste filene dine. Prøv igjen seinare.');
                console.error('Failed to fetch files:', err);
            } finally {
                setIsLoading(false);
            }
        };

        void fetchFiles();
    }, [isOpen, instance, inProgress, fileService]);

    const handleDownload = useCallback(
        async (file: IGeneratedFileInfo) => {
            try {
                const accessToken = await AuthHelper.getSKaaSAccessToken(instance, inProgress);
                const baseUrl = BackendServiceUrl.replace(/\/$/, '');

                // On mobile/Teams WebViews, blob downloads don't work (download attribute
                // and programmatic anchor clicks are blocked). Use a token-based direct URL instead.
                const isMobileOrTeams =
                    /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ||
                    /Teams/i.test(navigator.userAgent) ||
                    // Teams desktop also uses embedded browser
                    /Electron/i.test(navigator.userAgent);

                if (isMobileOrTeams) {
                    const token = await fileService.getDownloadTokenAsync(file.id, accessToken);
                    const separator = file.downloadUrl.includes('?') ? '&' : '?';
                    const directUrl = `${baseUrl}${file.downloadUrl}${separator}dt=${encodeURIComponent(token)}`;
                    window.open(directUrl, '_blank');
                    return;
                }

                // Standard blob download for desktop browsers
                const url = `${baseUrl}${file.downloadUrl}`;
                const response = await fetch(url, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });

                if (!response.ok) {
                    throw new Error(`Download failed: ${response.status}`);
                }

                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = file.fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
            } catch (err) {
                console.error('Failed to download file:', err);
            }
        },
        [instance, inProgress, fileService],
    );

    const handleDeleteConfirm = useCallback(
        async (fileId: string) => {
            const file = files.find((f) => f.id === fileId);
            if (!file) return;

            setDeletingFileIds((prev) => new Set(prev).add(fileId));
            setConfirmDeleteId(null);

            try {
                const accessToken = await AuthHelper.getSKaaSAccessToken(instance, inProgress);
                await fileService.deleteFileAsync(fileId, file.chatId, accessToken);
                setFiles((prev) => prev.filter((f) => f.id !== fileId));
            } catch (err) {
                console.error('Failed to delete file:', err);
            } finally {
                setDeletingFileIds((prev) => {
                    const next = new Set(prev);
                    next.delete(fileId);
                    return next;
                });
            }
        },
        [files, instance, inProgress, fileService],
    );

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
                                <span>Mine filer</span>
                                <Text className={classes.subtitle}>
                                    {isLoading
                                        ? 'Lastar filer...'
                                        : files.length === 0
                                          ? 'Ingen genererte filer'
                                          : `${files.length} ${files.length === 1 ? 'fil' : 'filer'} generert av Mimir`}
                                </Text>
                            </div>
                        </DialogTitle>

                        <DialogContent className={classes.content}>
                            {isLoading ? (
                                <div className={classes.emptyState}>
                                    <Spinner size="medium" />
                                    <Text>Lastar filene dine...</Text>
                                </div>
                            ) : error ? (
                                <div className={classes.emptyState}>
                                    <Text>{error}</Text>
                                </div>
                            ) : files.length === 0 ? (
                                <div className={classes.emptyState}>
                                    <Document20Regular style={{ fontSize: '48px' }} />
                                    <Text weight="semibold">Du har ingen genererte filer</Text>
                                    <Text size={200}>
                                        Når Mimir lagar dokument, presentasjonar eller andre filer for deg, vil dei
                                        dukke opp her.
                                    </Text>
                                </div>
                            ) : (
                                <>
                                    <div className={classes.tableHeader}>
                                        <span></span>
                                        <span>Filnamn</span>
                                        <span>Storleik</span>
                                        <span>Oppretta</span>
                                        <span>Utløper</span>
                                        <span></span>
                                    </div>

                                    {files.map((file) => (
                                        <div key={file.id} className={classes.tableRow}>
                                            <div className={classes.fileIcon}>
                                                {getFileIcon(file.fileName, file.contentType)}
                                            </div>

                                            <Tooltip content={file.fileName} relationship="label">
                                                <Text className={classes.fileName}>{file.fileName}</Text>
                                            </Tooltip>

                                            <div className={classes.metricCell}>
                                                <span>{formatFileSize(file.size)}</span>
                                            </div>

                                            <div className={classes.metricCell}>
                                                <span>{formatDate(file.createdOn)}</span>
                                            </div>

                                            <div className={classes.metricCell}>
                                                <span>{formatExpiresOn(file.expiresOn)}</span>
                                            </div>

                                            <div className={classes.actionsCell}>
                                                <Tooltip content="Last ned" relationship="label">
                                                    <Button
                                                        appearance="subtle"
                                                        icon={<ArrowDownload20Regular />}
                                                        size="small"
                                                        onClick={() => {
                                                            void handleDownload(file);
                                                        }}
                                                        aria-label={`Last ned ${file.fileName}`}
                                                    />
                                                </Tooltip>
                                                <Tooltip content="Slett" relationship="label">
                                                    <Button
                                                        appearance="subtle"
                                                        icon={
                                                            deletingFileIds.has(file.id) ? (
                                                                <Spinner size="tiny" />
                                                            ) : (
                                                                <Delete20Regular />
                                                            )
                                                        }
                                                        size="small"
                                                        onClick={() => {
                                                            setConfirmDeleteId(file.id);
                                                        }}
                                                        disabled={deletingFileIds.has(file.id)}
                                                        aria-label={`Slett ${file.fileName}`}
                                                    />
                                                </Tooltip>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </DialogContent>

                        <DialogActions>
                            <Text className={classes.footerInfo}>
                                {files.length > 0 && 'Filer vert sletta automatisk når dei utløper.'}
                            </Text>
                            <Button appearance="secondary" onClick={onClose}>
                                Lukk
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>

            {/* Delete confirmation dialog */}
            <Dialog
                open={confirmDeleteId !== null}
                onOpenChange={(_, data) => {
                    if (!data.open) {
                        setConfirmDeleteId(null);
                    }
                }}
            >
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>Slett fil</DialogTitle>
                        <DialogContent>
                            <Text>
                                Er du sikker på at du vil slette{' '}
                                <strong>{files.find((f) => f.id === confirmDeleteId)?.fileName}</strong>? Dette kan
                                ikkje angrast.
                            </Text>
                        </DialogContent>
                        <DialogActions>
                            <Button
                                appearance="secondary"
                                onClick={() => {
                                    setConfirmDeleteId(null);
                                }}
                            >
                                Avbryt
                            </Button>
                            <Button
                                appearance="primary"
                                onClick={() => {
                                    if (confirmDeleteId) {
                                        void handleDeleteConfirm(confirmDeleteId);
                                    }
                                }}
                            >
                                Slett
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </>
    );
};
