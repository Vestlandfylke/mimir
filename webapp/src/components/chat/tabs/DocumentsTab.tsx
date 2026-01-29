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
    ProgressBar,
    Spinner,
    Table,
    TableBody,
    TableCell,
    TableCellLayout,
    TableColumnDefinition,
    TableColumnId,
    TableHeader,
    TableHeaderCell,
    TableHeaderCellProps,
    TableRow,
    Tooltip,
    createTableColumn,
    makeStyles,
    shorthands,
    tokens,
    useTableFeatures,
    useTableSort,
} from '@fluentui/react-components';
import {
    Clock16Regular,
    DeleteRegular,
    DocumentArrowUp20Regular,
    DocumentPdfRegular,
    DocumentTextRegular,
    FluentIconsProps,
    Pin20Filled,
    Pin20Regular,
    Storage16Regular,
} from '@fluentui/react-icons';
import * as React from 'react';
import { useRef, useState } from 'react';
import { Constants } from '../../../Constants';
import { AuthHelper } from '../../../libs/auth/AuthHelper';
import { useChat, useFile } from '../../../libs/hooks';
import { AlertType } from '../../../libs/models/AlertType';
import { ChatMemorySource } from '../../../libs/models/ChatMemorySource';
import { DocumentImportService } from '../../../libs/services/DocumentImportService';
import { useAppDispatch, useAppSelector } from '../../../redux/app/hooks';
import { RootState } from '../../../redux/app/store';
import { addAlert } from '../../../redux/features/app/appSlice';
import { timestampToDateString } from '../../utils/TextUtils';
import { TabView } from './TabView';

const EmptyGuid = '00000000-0000-0000-0000-000000000000';

const useClasses = makeStyles({
    functional: {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        ...shorthands.margin('0', '0', tokens.spacingVerticalM, '0'),
        ...shorthands.gap(tokens.spacingVerticalS),
        '@media (max-width: 744px)': {
            flexDirection: 'column',
            alignItems: 'flex-start',
        },
    },
    uploadButton: {
        ...shorthands.margin('0', tokens.spacingHorizontalS, '0', '0'),
        '@media (max-width: 744px)': {
            ...shorthands.margin('0'),
        },
    },
    hiddenFileInput: {
        display: 'none',
    },
    // Desktop table view
    tableContainer: {
        '@media (max-width: 744px)': {
            display: 'none',
        },
    },
    table: {
        backgroundColor: tokens.colorNeutralBackground3,
    },
    tableHeader: {
        fontWeight: tokens.fontSizeBase600,
    },
    // Mobile card view
    mobileCardList: {
        display: 'none',
        '@media (max-width: 744px)': {
            display: 'flex',
            flexDirection: 'column',
            ...shorthands.gap(tokens.spacingVerticalM),
        },
    },
    documentCard: {
        backgroundColor: tokens.colorNeutralBackground3,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        ...shorthands.padding(tokens.spacingVerticalM),
        boxShadow: tokens.shadow4,
        display: 'flex',
        flexDirection: 'column',
        ...shorthands.gap(tokens.spacingVerticalS),
    },
    cardHeader: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        ...shorthands.gap(tokens.spacingHorizontalS),
    },
    cardName: {
        fontWeight: tokens.fontWeightSemibold,
        fontSize: tokens.fontSizeBase300,
        flexGrow: 1,
        ...shorthands.overflow('hidden'),
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    cardDetails: {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        ...shorthands.gap(tokens.spacingHorizontalM),
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
    },
    cardActions: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'flex-end',
        ...shorthands.gap(tokens.spacingHorizontalS),
        marginTop: tokens.spacingVerticalS,
        paddingTop: tokens.spacingVerticalS,
        ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke2),
    },
    progressBar: {
        width: '100%',
    },
});

interface TableItem {
    id: string;
    chatId: string;
    name: {
        label: string;
        icon: JSX.Element;
        url?: string;
    };
    createdOn: {
        label: string;
        timestamp: number;
    };
    size: number;
    isPinned: boolean;
}

export const DocumentsTab: React.FC = () => {
    const classes = useClasses();
    const chat = useChat();
    const fileHandler = useFile();
    const dispatch = useAppDispatch();
    const { instance, inProgress } = useMsal();

    const { conversations, selectedId } = useAppSelector((state: RootState) => state.conversations);
    const { importingDocuments } = conversations[selectedId];

    const [resources, setResources] = React.useState<ChatMemorySource[]>([]);
    const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
    const localDocumentFileRef = useRef<HTMLInputElement | null>(null);
    const globalDocumentFileRef = useRef<HTMLInputElement | null>(null);

    const documentImportService = React.useMemo(() => new DocumentImportService(), []);

    const refreshDocuments = React.useCallback(() => {
        if (!conversations[selectedId].disabled) {
            const importingResources = importingDocuments
                ? importingDocuments.map((document, index) => {
                      return {
                          id: `in-progress-${index}`,
                          chatId: selectedId,
                          sourceType: 'N/A',
                          name: document,
                          sharedBy: 'N/A',
                          createdOn: 0,
                          size: 0,
                      } as ChatMemorySource;
                  })
                : [];
            setResources(importingResources);

            void chat.getChatMemorySources(selectedId).then((sources) => {
                setResources([...importingResources, ...sources]);
            });
        }
    }, [chat, conversations, importingDocuments, selectedId]);

    React.useEffect(() => {
        refreshDocuments();
        // We don't want to have chat as one of the dependencies as it will cause infinite loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [importingDocuments, selectedId]);

    const handleDeleteDocument = async (documentId: string, documentName: string) => {
        setDeletingDocumentId(documentId);
        try {
            const accessToken = await AuthHelper.getSKaaSAccessToken(instance, inProgress);
            await documentImportService.deleteDocumentAsync(selectedId, documentId, accessToken);
            dispatch(addAlert({ message: `Dokumentet "${documentName}" er sletta.`, type: AlertType.Success }));
            refreshDocuments();
        } catch (error) {
            dispatch(
                addAlert({
                    message: `Kunne ikkje slette dokumentet: ${error instanceof Error ? error.message : 'Ukjent feil'}`,
                    type: AlertType.Error,
                }),
            );
        } finally {
            setDeletingDocumentId(null);
        }
    };

    const handlePinDocument = async (documentId: string, documentName: string, isPinned: boolean) => {
        try {
            const accessToken = await AuthHelper.getSKaaSAccessToken(instance, inProgress);
            if (isPinned) {
                await documentImportService.unpinDocumentAsync(selectedId, documentId, accessToken);
                dispatch(
                    addAlert({ message: `"${documentName}" er no løyst frå konteksten`, type: AlertType.Success }),
                );
            } else {
                await documentImportService.pinDocumentAsync(selectedId, documentId, accessToken);
                dispatch(
                    addAlert({ message: `"${documentName}" er no festa til konteksten`, type: AlertType.Success }),
                );
            }
            refreshDocuments();
        } catch (err) {
            const error = err as Error;
            dispatch(
                addAlert({
                    message: `Kunne ikkje ${isPinned ? 'løyse' : 'feste'} dokument: ${error.message || 'Ukjent feil'}`,
                    type: AlertType.Error,
                }),
            );
        }
    };

    const { columns, rows } = useTable(resources, handleDeleteDocument, handlePinDocument, deletingDocumentId);
    return (
        <TabView title="Dokument">
            <div className={classes.functional}>
                {/* Skjult input for filopplasting. Godtar bare .txt og .pdf filer for nå. */}
                <input
                    type="file"
                    ref={localDocumentFileRef}
                    className={classes.hiddenFileInput}
                    aria-label="Lokal dokument opplasting input"
                    accept={Constants.app.importTypes}
                    multiple={true}
                    onChange={() => {
                        void fileHandler.handleImport(selectedId, localDocumentFileRef, false);
                    }}
                />
                <input
                    type="file"
                    ref={globalDocumentFileRef}
                    className={classes.hiddenFileInput}
                    aria-label="Global dokument opplasting input"
                    accept={Constants.app.importTypes}
                    multiple={true}
                    onChange={() => {
                        void fileHandler.handleImport(selectedId, globalDocumentFileRef, true);
                    }}
                />
                <Tooltip content="Last opp fil til chatøkta" relationship="label">
                    <Button
                        data-tour="documents-upload"
                        data-testid="addNewLocalDoc"
                        className={classes.uploadButton}
                        icon={<DocumentArrowUp20Regular />}
                        disabled={
                            conversations[selectedId].disabled || (importingDocuments && importingDocuments.length > 0)
                        }
                        onClick={() => localDocumentFileRef.current?.click()}
                    >
                        Last opp
                    </Button>
                </Tooltip>
                {importingDocuments && importingDocuments.length > 0 && <Spinner size="tiny" />}
            </div>
            {/* Desktop: Table view */}
            <div className={classes.tableContainer} data-tour="documents-table">
                <Table aria-label="Ekstern ressurs tabell" className={classes.table}>
                    <TableHeader>
                        <TableRow>{columns.map((column) => column.renderHeaderCell())}</TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((item) => (
                            <TableRow key={item.id}>{columns.map((column) => column.renderCell(item))}</TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile: Card view */}
            <div className={classes.mobileCardList}>
                {rows.map((item) => (
                    <div key={item.id} className={classes.documentCard}>
                        <div className={classes.cardHeader}>
                            {item.name.icon}
                            <span className={classes.cardName} title={item.name.label}>
                                {item.name.url ? <a href={item.name.url}>{item.name.label}</a> : item.name.label}
                            </span>
                        </div>
                        <div className={classes.cardDetails}>
                            <span>
                                <Clock16Regular style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                {item.id.startsWith('in-progress') ? 'Lastar...' : item.createdOn.label}
                            </span>
                            <span>
                                <Storage16Regular style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                {item.id.startsWith('in-progress') ? '...' : `${item.size.toLocaleString()} bytes`}
                            </span>
                        </div>
                        <ProgressBar
                            className={classes.progressBar}
                            max={1}
                            value={item.id.startsWith('in-progress') ? undefined : 1}
                            shape="rounded"
                            thickness="large"
                            color={item.id.startsWith('in-progress') ? 'brand' : 'success'}
                        />
                        {!item.id.startsWith('in-progress') && item.chatId !== EmptyGuid && (
                            <div className={classes.cardActions}>
                                <Tooltip
                                    content={item.isPinned ? 'Løys frå kontekst' : 'Fest til kontekst'}
                                    relationship="label"
                                >
                                    <Button
                                        icon={item.isPinned ? <Pin20Filled /> : <Pin20Regular />}
                                        appearance="subtle"
                                        onClick={() => void handlePinDocument(item.id, item.name.label, item.isPinned)}
                                        size="small"
                                    >
                                        {item.isPinned ? 'Løys' : 'Fest'}
                                    </Button>
                                </Tooltip>
                                <Dialog>
                                    <DialogTrigger disableButtonEnhancement>
                                        <Button
                                            icon={
                                                deletingDocumentId === item.id ? (
                                                    <Spinner size="tiny" />
                                                ) : (
                                                    <DeleteRegular />
                                                )
                                            }
                                            appearance="subtle"
                                            disabled={deletingDocumentId !== null}
                                            size="small"
                                        >
                                            Slett
                                        </Button>
                                    </DialogTrigger>
                                    <DialogSurface>
                                        <DialogBody>
                                            <DialogTitle>Slett dokument</DialogTitle>
                                            <DialogContent>
                                                Er du sikker på at du vil slette &quot;{item.name.label}&quot;?
                                            </DialogContent>
                                            <DialogActions>
                                                <DialogTrigger disableButtonEnhancement>
                                                    <Button appearance="secondary">Avbryt</Button>
                                                </DialogTrigger>
                                                <DialogTrigger disableButtonEnhancement>
                                                    <Button
                                                        appearance="primary"
                                                        onClick={() =>
                                                            void handleDeleteDocument(item.id, item.name.label)
                                                        }
                                                    >
                                                        Slett
                                                    </Button>
                                                </DialogTrigger>
                                            </DialogActions>
                                        </DialogBody>
                                    </DialogSurface>
                                </Dialog>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </TabView>
    );
};

function useTable(
    resources: ChatMemorySource[],
    onDelete: (documentId: string, documentName: string) => Promise<void>,
    onPin: (documentId: string, documentName: string, isPinned: boolean) => Promise<void>,
    deletingDocumentId: string | null,
) {
    const headerSortProps = (columnId: TableColumnId): TableHeaderCellProps => ({
        onClick: (e: React.MouseEvent) => {
            toggleColumnSort(e, columnId);
        },
        sortDirection: getSortDirection(columnId),
    });

    const columns: Array<TableColumnDefinition<TableItem>> = [
        createTableColumn<TableItem>({
            columnId: 'name',
            renderHeaderCell: () => (
                <TableHeaderCell key="name" {...headerSortProps('name')}>
                    Namn
                </TableHeaderCell>
            ),
            renderCell: (item) => (
                <TableCell key={item.id}>
                    <TableCellLayout media={item.name.icon} truncate>
                        <a href={item.name.url} title={item.name.label}>
                            {item.name.label}
                        </a>
                    </TableCellLayout>
                </TableCell>
            ),
            compare: (a, b) => {
                const comparison = a.name.label.localeCompare(b.name.label);
                return getSortDirection('name') === 'ascending' ? comparison : comparison * -1;
            },
        }),
        createTableColumn<TableItem>({
            columnId: 'createdOn',
            renderHeaderCell: () => (
                <TableHeaderCell key="createdOn" {...headerSortProps('createdOn')}>
                    Oppretta på
                </TableHeaderCell>
            ),
            renderCell: (item) => (
                <TableCell
                    key={item.createdOn.timestamp}
                    title={new Date(item.createdOn.timestamp).toLocaleString('nb-NO', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                        hour12: false,
                    })}
                >
                    {item.id.startsWith('in-progress') ? 'N/A' : item.createdOn.label}
                </TableCell>
            ),
            compare: (a, b) => {
                const comparison = a.createdOn.timestamp > b.createdOn.timestamp ? 1 : -1;
                return getSortDirection('createdOn') === 'ascending' ? comparison : comparison * -1;
            },
        }),
        createTableColumn<TableItem>({
            columnId: 'fileSize',
            renderHeaderCell: () => (
                <TableHeaderCell key="fileSize" {...headerSortProps('fileSize')}>
                    Størrelse (bytes)
                </TableHeaderCell>
            ),
            renderCell: (item) => (
                <TableCell key={`${item.id}-tokens`}>
                    {item.id.startsWith('in-progress') ? 'N/A' : item.size.toLocaleString()}
                </TableCell>
            ),
            compare: (a, b) => {
                const aAccess = getAccessString(a.chatId);
                const bAccess = getAccessString(b.chatId);
                const comparison = aAccess.localeCompare(bAccess);
                return getSortDirection('fileSize') === 'ascending' ? comparison : comparison * -1;
            },
        }),
        createTableColumn<TableItem>({
            columnId: 'access',
            renderHeaderCell: () => (
                <TableHeaderCell key="access" {...headerSortProps('access')}>
                    Tilgang
                </TableHeaderCell>
            ),
            renderCell: (item) => (
                <TableCell key={`${item.id} ${item.name.label}`}>{getAccessString(item.chatId)}</TableCell>
            ),
            compare: (a, b) => {
                const aAccess = getAccessString(a.chatId);
                const bAccess = getAccessString(b.chatId);
                const comparison = aAccess.localeCompare(bAccess);
                return getSortDirection('access') === 'ascending' ? comparison : comparison * -1;
            },
        }),
        createTableColumn<TableItem>({
            columnId: 'progress',
            renderHeaderCell: () => (
                <TableHeaderCell key="progress" {...headerSortProps('progress')}>
                    Framgang
                </TableHeaderCell>
            ),
            renderCell: (item) => (
                <TableCell key={`${item.id}-progress`}>
                    <ProgressBar
                        max={1}
                        value={item.id.startsWith('in-progress') ? undefined : 1} // Hack: tokens stores the progress bar percentage.
                        shape="rounded"
                        thickness="large"
                        color={item.id.startsWith('in-progress') ? 'brand' : 'success'}
                    />
                </TableCell>
            ),
            compare: (a, b) => {
                const aAccess = getAccessString(a.chatId);
                const bAccess = getAccessString(b.chatId);
                const comparison = aAccess.localeCompare(bAccess);
                return getSortDirection('progress') === 'ascending' ? comparison : comparison * -1;
            },
        }),
        createTableColumn<TableItem>({
            columnId: 'actions',
            renderHeaderCell: () => <TableHeaderCell key="actions">Handlingar</TableHeaderCell>,
            renderCell: (item) => (
                <TableCell key={`${item.id}-actions`}>
                    {!item.id.startsWith('in-progress') && item.chatId !== EmptyGuid && (
                        <>
                            <Tooltip
                                content={
                                    item.isPinned
                                        ? 'Løys dokumentet frå konteksten'
                                        : 'Fest dokumentet til konteksten (alltid inkludert i svar)'
                                }
                                relationship="label"
                            >
                                <Button
                                    icon={item.isPinned ? <Pin20Filled /> : <Pin20Regular />}
                                    appearance="subtle"
                                    onClick={() => void onPin(item.id, item.name.label, item.isPinned)}
                                    aria-label={item.isPinned ? 'Løys dokument' : 'Fest dokument'}
                                />
                            </Tooltip>
                            <Dialog>
                                <DialogTrigger disableButtonEnhancement>
                                    <Tooltip content="Slett dokument" relationship="label">
                                        <Button
                                            icon={
                                                deletingDocumentId === item.id ? (
                                                    <Spinner size="tiny" />
                                                ) : (
                                                    <DeleteRegular />
                                                )
                                            }
                                            appearance="subtle"
                                            disabled={deletingDocumentId !== null}
                                            aria-label="Slett dokument"
                                        />
                                    </Tooltip>
                                </DialogTrigger>
                                <DialogSurface>
                                    <DialogBody>
                                        <DialogTitle>Slett dokument</DialogTitle>
                                        <DialogContent>
                                            Er du sikker på at du vil slette dokumentet &quot;{item.name.label}&quot;?
                                            Dette vil fjerne dokumentet frå minnet til samtalen permanent.
                                        </DialogContent>
                                        <DialogActions>
                                            <DialogTrigger disableButtonEnhancement>
                                                <Button appearance="secondary">Avbryt</Button>
                                            </DialogTrigger>
                                            <DialogTrigger disableButtonEnhancement>
                                                <Button
                                                    appearance="primary"
                                                    onClick={() => void onDelete(item.id, item.name.label)}
                                                >
                                                    Slett
                                                </Button>
                                            </DialogTrigger>
                                        </DialogActions>
                                    </DialogBody>
                                </DialogSurface>
                            </Dialog>
                        </>
                    )}
                </TableCell>
            ),
            compare: () => 0,
        }),
    ];

    const items = resources.map((item) => ({
        id: item.id,
        chatId: item.chatId,
        name: {
            label: item.name,
            icon: getFileIconByFileExtension(item.name),
            url: item.hyperlink,
        },
        createdOn: {
            label: timestampToDateString(item.createdOn),
            timestamp: item.createdOn,
        },
        size: item.size,
        isPinned: item.isPinned ?? false,
    }));

    const {
        sort: { getSortDirection, toggleColumnSort, sortColumn },
    } = useTableFeatures(
        {
            columns,
            items,
        },
        [
            useTableSort({
                defaultSortState: { sortColumn: 'createdOn', sortDirection: 'descending' },
            }),
        ],
    );

    if (sortColumn) {
        items.sort((a, b) => {
            const compare = columns.find((column) => column.columnId === sortColumn)?.compare;
            return compare?.(a, b) ?? 0;
        });
    }

    return { columns, rows: items };
}

function getAccessString(chatId: string) {
    return chatId === EmptyGuid ? 'Global' : 'Denne samtalen';
}

export function getFileIconByFileExtension(fileName: string, props: FluentIconsProps = {}) {
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.') + 1);
    if (extension === 'pdf') {
        return <DocumentPdfRegular {...props} />;
    }
    return <DocumentTextRegular {...props} />;
}
