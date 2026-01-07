import {
    Button,
    makeStyles,
    mergeClasses,
    Popover,
    PopoverSurface,
    PopoverTrigger,
    shorthands,
    tokens,
    Tooltip,
} from '@fluentui/react-components';
import { DiagramRegular, DismissRegular } from '@fluentui/react-icons';
import React, { useState } from 'react';
import {
    TbChartTreemap,
    TbHierarchy2,
    TbArrowsExchange,
    TbDatabase,
    TbCircleDot,
    TbBrain,
    TbBuildingSkyscraper,
    TbLayoutGrid,
    TbBox,
    TbCalendarStats,
    TbGitBranch,
    TbLayoutKanban,
    TbChartPie,
    TbChartRadar,
    TbTimeline,
    TbBinaryTree2,
    TbWalk,
    TbChartLine,
    TbLayoutBoard,
} from 'react-icons/tb';

const useClasses = makeStyles({
    triggerButton: {
        minWidth: 'auto',
    },
    selectedButton: {
        backgroundColor: tokens.colorBrandBackground,
        color: tokens.colorNeutralForegroundOnBrand,
        ':hover': {
            backgroundColor: tokens.colorBrandBackgroundHover,
            color: tokens.colorNeutralForegroundOnBrand,
        },
    },
    surface: {
        maxWidth: '480px',
        maxHeight: '400px',
        overflowY: 'auto',
        ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: tokens.spacingVerticalS,
    },
    title: {
        fontSize: tokens.fontSizeBase400,
        fontWeight: tokens.fontWeightSemibold,
        margin: 0,
    },
    subtitle: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
        marginBottom: tokens.spacingVerticalM,
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        ...shorthands.gap(tokens.spacingHorizontalXS),
    },
    diagramOption: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalXS),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        cursor: 'pointer',
        backgroundColor: tokens.colorNeutralBackground1,
        ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
        transition: 'all 0.15s ease',
        ':hover': {
            backgroundColor: tokens.colorNeutralBackground1Hover,
            ...shorthands.borderColor(tokens.colorBrandStroke1),
        },
    },
    diagramOptionSelected: {
        backgroundColor: tokens.colorBrandBackground2,
        ...shorthands.borderColor(tokens.colorBrandStroke1),
        ':hover': {
            backgroundColor: tokens.colorBrandBackground2Hover,
        },
    },
    preview: {
        width: '50px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        color: tokens.colorNeutralForeground2,
        marginBottom: tokens.spacingVerticalXS,
    },
    label: {
        fontSize: tokens.fontSizeBase100,
        fontWeight: tokens.fontWeightMedium,
        textAlign: 'center',
    },
    selectedIndicator: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        ...shorthands.gap(tokens.spacingHorizontalS),
        ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalS),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        backgroundColor: tokens.colorBrandBackground,
        color: tokens.colorNeutralForegroundOnBrand,
        whiteSpace: 'nowrap',
    },
    selectedName: {
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForegroundOnBrand,
    },
    selectedDivider: {
        width: '1px',
        height: '16px',
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    selectedDescription: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForegroundOnBrand,
        opacity: 0.9,
    },
    clearButton: {
        minWidth: 'auto',
        ...shorthands.padding('2px'),
        flexShrink: 0,
        color: tokens.colorNeutralForegroundOnBrand,
        ':hover': {
            color: tokens.colorNeutralForegroundOnBrand,
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
        },
    },
});

export interface DiagramType {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    prompt: string;
}

export const DIAGRAM_TYPES: DiagramType[] = [
    // Row 1 - Basic diagrams
    {
        id: 'flowchart',
        label: 'Flytskjema',
        description: 'Vis prosessar, avgjersler og arbeidsflyt steg for steg',
        icon: <TbChartTreemap />,
        prompt: `Lag eit Mermaid flytskjema. Start med "flowchart TD" eller "flowchart LR". Døme:
\`\`\`mermaid
flowchart TD
    A[Start] --> B{Val}
    B -->|Ja| C[Handling]
    B -->|Nei| D[Anna handling]
\`\`\`
Bruk tydelege norske (nynorsk) tekstar.`,
    },
    {
        id: 'classDiagram',
        label: 'Klasse',
        description: 'Vis klassar, eigenskapar og relasjonar i objektorientert kode',
        icon: <TbHierarchy2 />,
        prompt: `Lag eit Mermaid klassediagram. Start med "classDiagram". Døme:
\`\`\`mermaid
classDiagram
    class Bil {
        +String merke
        +start()
    }
    Køyretøy <|-- Bil
\`\`\`
Bruk norske tekstar der det passar.`,
    },
    {
        id: 'sequence',
        label: 'Sekvens',
        description: 'Vis kommunikasjon og interaksjonar mellom system over tid',
        icon: <TbArrowsExchange />,
        prompt: `Lag eit Mermaid sekvensdiagram. Start med "sequenceDiagram". Døme:
\`\`\`mermaid
sequenceDiagram
    participant A as Brukar
    participant B as System
    A->>B: Førespurnad
    B-->>A: Svar
\`\`\`
Bruk norske (nynorsk) tekstar.`,
    },
    {
        id: 'erDiagram',
        label: 'ER-diagram',
        description: 'Vis databasetabellar og relasjonane mellom dei',
        icon: <TbDatabase />,
        prompt: `Lag eit Mermaid ER-diagram. Start med "erDiagram". Døme:
\`\`\`mermaid
erDiagram
    KUNDE ||--o{ ORDRE : "har"
    ORDRE ||--|{ PRODUKT : "inneheld"
    KUNDE {
        int id
        string namn
    }
\`\`\`
Bruk norske (nynorsk) tekstar.`,
    },
    {
        id: 'stateDiagram',
        label: 'Tilstand',
        description: 'Vis ulike tilstandar og overgangar i eit system',
        icon: <TbCircleDot />,
        prompt: `Lag eit Mermaid tilstandsdiagram. Start med "stateDiagram-v2". Døme:
\`\`\`mermaid
stateDiagram-v2
    [*] --> Ventande
    Ventande --> Aktiv : start
    Aktiv --> [*] : ferdig
\`\`\`
Bruk norske (nynorsk) tekstar.`,
    },
    // Row 2 - Project & planning
    {
        id: 'mindmap',
        label: 'Tankekart',
        description: 'Organiser idear og konsept hierarkisk rundt eit sentralt tema',
        icon: <TbBrain />,
        prompt: `Lag eit Mermaid tankekart. Start med "mindmap" og bruk innrykk for hierarki. Døme:
\`\`\`mermaid
mindmap
    root((Hovudtema))
        Emne 1
            Detalj A
            Detalj B
        Emne 2
\`\`\`
Bruk norske (nynorsk) tekstar.`,
    },
    {
        id: 'architecture',
        label: 'Arkitektur',
        description: 'Vis systemkomponentar, tenester og infrastruktur',
        icon: <TbBuildingSkyscraper />,
        prompt: `Lag eit Mermaid arkitektur-diagram. Bruk "architecture-beta" med grupper og tenester. Døme:
\`\`\`mermaid
architecture-beta
    group api(cloud)[API]
    service db(database)[Database] in api
    service server(server)[Server] in api
    db:L -- R:server
\`\`\`
Bruk tydelege norske (nynorsk) tekstar.`,
    },
    {
        id: 'block',
        label: 'Blokk',
        description: 'Vis enkle blokkar og koplingane mellom dei',
        icon: <TbLayoutBoard />,
        prompt: `Lag eit Mermaid blokkdiagram. Start med "block-beta". Døme:
\`\`\`mermaid
block-beta
    columns 3
    a["Blokk A"]:3
    b["B"] c["C"] d["D"]
    b --> d
\`\`\`
Bruk norske (nynorsk) tekstar.`,
    },
    {
        id: 'c4',
        label: 'C4',
        description: 'Vis programvarearkitektur med C4-modellen (Context, Container, Component)',
        icon: <TbBox />,
        prompt: `Lag eit Mermaid C4Context-diagram. VIKTIG: Bruk KORREKT Mermaid C4-syntax (IKKJE PlantUML):
\`\`\`mermaid
C4Context
    title Systemnamn
    Person(alias, "Namn", "Beskriving")
    System(alias, "Namn", "Beskriving")
    System_Ext(alias, "Namn", "Beskriving")
    Rel(frå, til, "label")
\`\`\`
Bruk tydelege norske (nynorsk) tekstar.`,
    },
    {
        id: 'gantt',
        label: 'Gantt',
        description: 'Vis prosjektplan med oppgåver, tidslinje og avhengigheiter',
        icon: <TbCalendarStats />,
        prompt: `Lag eit Mermaid Gantt-diagram. Start med "gantt". Døme:
\`\`\`mermaid
gantt
    title Prosjektplan
    dateFormat YYYY-MM-DD
    section Fase 1
        Oppgåve 1 :a1, 2024-01-01, 7d
        Oppgåve 2 :after a1, 5d
\`\`\`
Bruk norske (nynorsk) tekstar.`,
    },
    // Row 3 - Git & Dev
    {
        id: 'git',
        label: 'Git',
        description: 'Vis Git-greiner, commits og merge-historikk',
        icon: <TbGitBranch />,
        prompt: `Lag eit Mermaid gitGraph-diagram. Start med "gitGraph". Døme:
\`\`\`mermaid
gitGraph
    commit id: "Init"
    branch feature
    commit id: "Ny funksjon"
    checkout main
    merge feature
\`\`\`
Bruk norske tekstar for commit-meldingar.`,
    },
    {
        id: 'kanban',
        label: 'Kanban',
        description: 'Vis oppgåvetavle med kolonnar og status',
        icon: <TbLayoutKanban />,
        prompt: `Lag eit Mermaid kanban-diagram. Start med "kanban". Døme:
\`\`\`mermaid
kanban
    column1["Å gjere"]
        task1["Oppgåve 1"]
    column2["I arbeid"]
        task2["Oppgåve 2"]
    column3["Ferdig"]
        task3["Oppgåve 3"]
\`\`\`
Bruk norske (nynorsk) tekstar.`,
    },
    {
        id: 'pie',
        label: 'Sektor',
        description: 'Vis fordeling og prosentdel av ein heilskap',
        icon: <TbChartPie />,
        prompt: `Lag eit Mermaid sektordiagram. Start med "pie". Døme:
\`\`\`mermaid
pie title Fordeling
    "Kategori A" : 40
    "Kategori B" : 35
    "Kategori C" : 25
\`\`\`
Bruk norske (nynorsk) tekstar.`,
    },
    {
        id: 'quadrant',
        label: 'Kvadrant',
        description: 'Plasser element i fire kategoriar for analyse og prioritering',
        icon: <TbLayoutGrid />,
        prompt: `Lag eit Mermaid kvadrantdiagram. Start med "quadrantChart". Døme:
\`\`\`mermaid
quadrantChart
    title Prioritering
    x-axis Låg innsats --> Høg innsats
    y-axis Låg verdi --> Høg verdi
    quadrant-1 Gjer først
    quadrant-2 Planlegg
    quadrant-3 Deleger
    quadrant-4 Unngå
    Oppgåve A: [0.8, 0.9]
\`\`\`
Bruk norske (nynorsk) tekstar.`,
    },
    // Row 4 - Advanced
    {
        id: 'radar',
        label: 'Radar',
        description: 'Vis fleire dimensjonar på ein radargraf (edderkoppnett)',
        icon: <TbChartRadar />,
        prompt: `Mermaid støttar ikkje radar/spider-diagram direkte. Bruk i staden eit quadrantChart eller pie-diagram for å visualisere fleire dimensjonar. Alternativt, bruk flowchart til å lage ein visuell representasjon. Bruk norske (nynorsk) tekstar.`,
    },
    {
        id: 'timeline',
        label: 'Tidslinje',
        description: 'Vis hendingar kronologisk langs ein tidslinje',
        icon: <TbTimeline />,
        prompt: `Lag eit Mermaid tidslinjediagram. Start med "timeline". Døme:
\`\`\`mermaid
timeline
    title Prosjekthistorikk
    2023 : Oppstart
         : Planlegging
    2024 : Utvikling
         : Lansering
\`\`\`
Bruk norske (nynorsk) tekstar.`,
    },
    {
        id: 'treemap',
        label: 'Trekart',
        description: 'Vis hierarkisk data som nestla rektangel',
        icon: <TbBinaryTree2 />,
        prompt: `Lag eit Mermaid treemap-diagram. Start med "treemap-beta". Bruk innrykk for hierarki. Døme:
\`\`\`mermaid
treemap-beta
"Hovudkategori"
    "Underkategori A"
        "Element 1": 30
        "Element 2": 20
    "Underkategori B"
        "Element 3": 25
        "Element 4": 15
\`\`\`
Bruk norske (nynorsk) tekstar og verdiar som reflekterer proporsjonane.`,
    },
    // Row 5 - User & data
    {
        id: 'journey',
        label: 'Brukarreise',
        description: 'Vis brukaroppleving gjennom ulike fasar med tilfredsheitsscore',
        icon: <TbWalk />,
        prompt: `Lag eit Mermaid brukarreise-diagram. Start med "journey". Døme:
\`\`\`mermaid
journey
    title Brukarreise
    section Registrering
        Finn skjema: 5: Brukar
        Fyll ut: 3: Brukar
    section Godkjenning
        Vent på svar: 2: Brukar
\`\`\`
Bruk norske (nynorsk) tekstar.`,
    },
    {
        id: 'xy',
        label: 'XY-graf',
        description: 'Vis data i eit koordinatsystem med X- og Y-akse',
        icon: <TbChartLine />,
        prompt: `Lag eit Mermaid xychart-diagram. Start med "xychart-beta". Døme:
\`\`\`mermaid
xychart-beta
    title "Salstal"
    x-axis [jan, feb, mar, apr]
    y-axis "Tal" 0 --> 100
    bar [30, 45, 60, 80]
    line [25, 40, 55, 75]
\`\`\`
Bruk norske (nynorsk) tekstar.`,
    },
];

export interface DiagramTypeSelectorProps {
    selectedType: DiagramType | null;
    onSelectType: (type: DiagramType | null) => void;
    disabled?: boolean;
}

export const DiagramTypeSelector: React.FC<DiagramTypeSelectorProps> = ({ selectedType, onSelectType, disabled }) => {
    const classes = useClasses();
    const [isOpen, setIsOpen] = useState(false);

    const handleSelect = (type: DiagramType) => {
        onSelectType(type);
        setIsOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelectType(null);
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}>
            <Popover
                open={isOpen}
                onOpenChange={(_, data) => {
                    setIsOpen(data.open);
                }}
                positioning="above-start"
            >
                <PopoverTrigger disableButtonEnhancement>
                    <Tooltip content="Vel diagramtype" relationship="label">
                        <Button
                            appearance={selectedType ? 'primary' : 'transparent'}
                            size="large"
                            icon={<DiagramRegular />}
                            disabled={disabled}
                            className={
                                selectedType
                                    ? mergeClasses(classes.selectedButton, classes.triggerButton)
                                    : classes.triggerButton
                            }
                            aria-label="Vel diagramtype"
                        />
                    </Tooltip>
                </PopoverTrigger>
                <PopoverSurface className={classes.surface}>
                    <div className={classes.header}>
                        <h3 className={classes.title}>📊 Vel diagramtype</h3>
                    </div>
                    <p className={classes.subtitle}>Vel ein type for å få betre resultat når du ber om diagram</p>
                    <div className={classes.grid}>
                        {DIAGRAM_TYPES.map((type) => (
                            <Tooltip
                                key={type.id}
                                content={type.description}
                                relationship="description"
                                positioning="above"
                            >
                                <div
                                    className={`${classes.diagramOption} ${
                                        selectedType?.id === type.id ? classes.diagramOptionSelected : ''
                                    }`}
                                    onClick={() => {
                                        handleSelect(type);
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            handleSelect(type);
                                        }
                                    }}
                                >
                                    <div className={classes.preview}>{type.icon}</div>
                                    <span className={classes.label}>{type.label}</span>
                                </div>
                            </Tooltip>
                        ))}
                    </div>
                </PopoverSurface>
            </Popover>

            {selectedType && (
                <div className={classes.selectedIndicator}>
                    <span className={classes.selectedName}>📊 {selectedType.label}</span>
                    <div className={classes.selectedDivider} />
                    <span className={classes.selectedDescription}>{selectedType.description}</span>
                    <Button
                        appearance="transparent"
                        icon={<DismissRegular />}
                        size="small"
                        className={classes.clearButton}
                        onClick={handleClear}
                        aria-label="Fjern valt diagramtype"
                    />
                </div>
            )}
        </div>
    );
};
