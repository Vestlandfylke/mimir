// Copyright (c) Microsoft. All rights reserved.

import {
    Button,
    Label,
    Menu,
    MenuItem,
    MenuList,
    MenuPopover,
    MenuTrigger,
    ProgressBar,
    Radio,
    RadioGroup,
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
    DocumentArrowUp20Regular,
    DocumentPdfRegular,
    DocumentTextRegular,
    FluentIconsProps,
    GlobeAdd20Regular,
} from '@fluentui/react-icons';
import * as React from 'react';
import { useRef } from 'react';
import { Constants } from '../../../Constants';
import { useChat, useFile } from '../../../libs/hooks';
import { ChatMemorySource } from '../../../libs/models/ChatMemorySource';
import { useAppSelector } from '../../../redux/app/hooks';
import { RootState } from '../../../redux/app/store';
import { Add20 } from '../../shared/BundledIcons';
import { timestampToDateString } from '../../utils/TextUtils';
import { TabView } from './TabView';

const EmptyGuid = '00000000-0000-0000-0000-000000000000';

const useClasses = makeStyles({
    functional: {
        display: 'flex',
        flexDirection: 'row',
        ...shorthands.margin('0', '0', tokens.spacingVerticalS, '0'),
    },
    uploadButton: {
        ...shorthands.margin('0', tokens.spacingHorizontalS, '0', '0'),
    },
    vectorDatabase: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'baseline',
        marginLeft: 'auto',
        ...shorthands.gap(tokens.spacingHorizontalSNudge),
    },
    table: {
        backgroundColor: tokens.colorNeutralBackground1,
    },
    tableHeader: {
        fontWeight: tokens.fontSizeBase600,
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
}

export const DocumentsTab: React.FC = () => {
    const classes = useClasses();
    const chat = useChat();
    const fileHandler = useFile();

    const { serviceInfo } = useAppSelector((state: RootState) => state.app);
    const { conversations, selectedId } = useAppSelector((state: RootState) => state.conversations);
    const { importingDocuments } = conversations[selectedId];

    const [resources, setResources] = React.useState<ChatMemorySource[]>([]);
    const localDocumentFileRef = useRef<HTMLInputElement | null>(null);
    const globalDocumentFileRef = useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
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
        // We don't want to have chat as one of the dependencies as it will cause infinite loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [importingDocuments, selectedId]);

    const { columns, rows } = useTable(resources);
    return (
        <TabView
            title="Dokument"
            learnMoreDescription="dokument innvevingar"
            learnMoreLink="https://aka.ms/sk-docs-vectordb"
        >
            <div className={classes.functional}>
                {/* Skjult input for filopplasting. Godtar bare .txt og .pdf filer for nå. */}
                <input
                    type="file"
                    ref={localDocumentFileRef}
                    style={{ display: 'none' }}
                    accept={Constants.app.importTypes}
                    multiple={true}
                    onChange={() => {
                        void fileHandler.handleImport(selectedId, localDocumentFileRef, false);
                    }}
                />
                <input
                    type="file"
                    ref={globalDocumentFileRef}
                    style={{ display: 'none' }}
                    accept={Constants.app.importTypes}
                    multiple={true}
                    onChange={() => {
                        void fileHandler.handleImport(selectedId, globalDocumentFileRef, true);
                    }}
                />
                <Menu>
                    <MenuTrigger disableButtonEnhancement>
                        <Tooltip content="Bygg inn fil i chatøkta" relationship="label">
                            <Button
                                className={classes.uploadButton}
                                icon={<DocumentArrowUp20Regular />}
                                disabled={
                                    conversations[selectedId].disabled ||
                                    (importingDocuments && importingDocuments.length > 0)
                                }
                            >
                                Last opp
                            </Button>
                        </Tooltip>
                    </MenuTrigger>
                    <MenuPopover>
                        <MenuList>
                            <MenuItem
                                data-testid="addNewLocalDoc"
                                onClick={() => localDocumentFileRef.current?.click()}
                                icon={<Add20 />}
                                disabled={
                                    conversations[selectedId].disabled ||
                                    (importingDocuments && importingDocuments.length > 0)
                                }
                            >
                                Nytt lokalt chatdokument
                            </MenuItem>
{                         <MenuItem
                            data-testid="addNewLocalDoc"
                            onClick={() => globalDocumentFileRef.current?.click()}
                            icon={<GlobeAdd20Regular />}
                            disabled={
                                conversations[selectedId].disabled ||
                                (importingDocuments && importingDocuments.length > 0)
                            }
                        >
                            Nytt globalt dokument
                        </MenuItem>}
                        </MenuList>
                    </MenuPopover>
                </Menu>
                {importingDocuments && importingDocuments.length > 0 && <Spinner size="tiny" />}
                {/* Hardkoda vektor database siden vi ikke støtter å bytte vektorlager dynamisk nå. */}
                <div className={classes.vectorDatabase}>
                    <Label size="large">Vektor Database:</Label>
                    <RadioGroup
                        defaultValue={serviceInfo.memoryStore.selectedType}
                        layout="horizontal"
                        disabled={conversations[selectedId].disabled}
                    >
                        {serviceInfo.memoryStore.types.map((storeType) => {
    
                            return (
                                <Radio
                                    key={storeType}
                                    value={storeType}
                                    label={storeType}
                                    disabled={storeType !== serviceInfo.memoryStore.selectedType}
                                />
                            );
                        })}
                    </RadioGroup>
                </div>
            </div>
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
        </TabView>
    );
};

function useTable(resources: ChatMemorySource[]) {
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
                <TableCell key={item.createdOn.timestamp} title={new Date(item.createdOn.timestamp).toLocaleString()}>
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
    return chatId === EmptyGuid ? 'Global' : 'This chat';
}

export function getFileIconByFileExtension(fileName: string, props: FluentIconsProps = {}) {
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.') + 1);
    if (extension === 'pdf') {
        return <DocumentPdfRegular {...props} />;
    }
    return <DocumentTextRegular {...props} />;
}
