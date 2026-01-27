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
    Menu,
    MenuItem,
    MenuList,
    MenuPopover,
    MenuTrigger,
    mergeClasses,
    shorthands,
    Spinner,
    Tab,
    TabList,
    tokens,
    Tooltip,
} from '@fluentui/react-components';
import { Code20Regular, Eye20Regular } from '@fluentui/react-icons';
import {
    Add20Regular,
    ArrowDownload20Regular,
    Checkmark20Regular,
    ChevronDown16Regular,
    Copy20Regular,
    Dismiss24Regular,
    Info20Regular,
    Open20Regular,
    Question20Regular,
    Subtract20Regular,
    ArrowReset20Regular,
} from '@fluentui/react-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    buildVestlandThemeVariables,
    diagramBaseStyles,
    diagramLightModeStyles,
    getXYChartConfig,
    LIGHT_BACKGROUND,
} from './MermaidStyles';

// Mobile breakpoint
const MOBILE_BREAKPOINT = '768px';

const useClasses = makeStyles({
    surface: {
        maxWidth: '95vw',
        width: '1600px',
        maxHeight: '92vh',
        // Mobile: 90% of screen with rounded corners
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            width: '90vw',
            maxWidth: '90vw',
            height: '90vh',
            maxHeight: '90vh',
            ...shorthands.borderRadius(tokens.borderRadiusLarge),
        },
    },
    contentWrapper: {
        display: 'flex',
        height: '75vh',
        minHeight: '500px',
        userSelect: 'none',
        // Mobile: stack vertically, fit within 90vh modal
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            flexDirection: 'column',
            height: 'calc(90vh - 160px)',
            minHeight: '250px',
        },
    },
    // Mobile tab bar
    mobileTabBar: {
        display: 'none',
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            display: 'flex',
            justifyContent: 'center',
            marginBottom: tokens.spacingVerticalS,
        },
    },
    editorPane: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalXS,
        minWidth: '200px',
        overflow: 'hidden',
        // Mobile: full size - use !important to override inline style
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            minWidth: 'unset',
            width: '100% !important',
            flex: 1,
            minHeight: 0,
        },
    },
    editorPaneHidden: {
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            display: 'none',
        },
    },
    previewPane: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalXS,
        minWidth: '200px',
        overflow: 'hidden',
        // Mobile: full size - use !important to override inline style
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            minWidth: 'unset',
            width: '100% !important',
            flex: 1,
            minHeight: 0,
        },
    },
    previewPaneHidden: {
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            display: 'none',
        },
    },
    resizeHandle: {
        width: '8px',
        cursor: 'col-resize',
        backgroundColor: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ':hover': {
            backgroundColor: tokens.colorNeutralBackground3,
        },
        // Mobile: hide resize handles
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            display: 'none',
        },
    },
    resizeHandleActive: {
        backgroundColor: tokens.colorBrandBackground,
    },
    resizeHandleLine: {
        width: '2px',
        height: '40px',
        backgroundColor: tokens.colorNeutralStroke2,
        ...shorthands.borderRadius('2px'),
    },
    paneHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: tokens.spacingHorizontalS,
        flexShrink: 0,
        // Mobile: hide pane headers (tabs replace them)
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            display: 'none',
        },
    },
    paneTitle: {
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForeground1,
    },
    sampleButtons: {
        display: 'flex',
        gap: tokens.spacingHorizontalXS,
        flexWrap: 'wrap',
    },
    editorWrapper: {
        flex: 1,
        display: 'flex',
        minHeight: 0,
        overflow: 'hidden',
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
        backgroundColor: tokens.colorNeutralBackground1,
    },
    lineNumbers: {
        width: '45px',
        flexShrink: 0,
        backgroundColor: tokens.colorNeutralBackground3,
        ...shorthands.borderRight('1px', 'solid', tokens.colorNeutralStroke1),
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalXS),
        fontFamily: '"Roboto Mono", Consolas, Monaco, monospace',
        fontSize: '13px',
        lineHeight: '1.5',
        color: tokens.colorNeutralForeground3,
        textAlign: 'right',
        userSelect: 'none',
        overflowY: 'hidden',
        overflowX: 'hidden',
        whiteSpace: 'pre',
    },
    textarea: {
        flex: 1,
        minWidth: 0,
        fontFamily: '"Roboto Mono", Consolas, Monaco, monospace',
        fontSize: '13px',
        lineHeight: '1.5',
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
        backgroundColor: 'transparent',
        color: tokens.colorNeutralForeground1,
        resize: 'none',
        outline: 'none',
        ...shorthands.border('none'),
        overflow: 'auto',
    },
    previewControls: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
    },
    zoomControls: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
    },
    zoomLabel: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
        minWidth: '45px',
        textAlign: 'center',
    },
    previewContainer: {
        flex: 1,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        // Same background as MermaidBlock - works with light-mode diagrams
        backgroundColor: '#f5f5f5',
        ...shorthands.padding(tokens.spacingVerticalM),
        overflow: 'hidden',
        position: 'relative',
    },
    previewInner: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        ':active': {
            cursor: 'grabbing',
        },
    },
    previewInnerDragging: {
        cursor: 'grabbing',
    },
    // Preview SVG styles - imported from shared MermaidStyles.ts
    previewSvg: {
        transformOrigin: 'center center',
        transition: 'none',
        userSelect: 'none',
        pointerEvents: 'none',
        '& svg': {
            maxWidth: 'none',
            height: 'auto',
        },
        // Import shared base styles for all diagram types
        ...diagramBaseStyles,
    },
    // Light mode preview - imported from shared MermaidStyles.ts
    previewSvgLight: {
        ...diagramLightModeStyles,
    },
    error: {
        color: tokens.colorPaletteRedForeground1,
        fontSize: tokens.fontSizeBase200,
        whiteSpace: 'pre-wrap',
        textAlign: 'center',
        ...shorthands.padding(tokens.spacingVerticalM),
    },
    loading: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tokens.spacingHorizontalS,
        color: tokens.colorNeutralForeground3,
    },
    actions: {
        display: 'flex',
        gap: tokens.spacingHorizontalS,
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        // Mobile: center actions, smaller gaps
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            justifyContent: 'center',
            gap: tokens.spacingHorizontalXS,
        },
    },
    actionsLeft: {
        display: 'flex',
        gap: tokens.spacingHorizontalS,
        // Mobile: keep buttons on same line, reduce gap
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            flexWrap: 'nowrap',
            justifyContent: 'center',
            gap: tokens.spacingHorizontalXS,
            width: '100%',
        },
    },
    actionsRight: {
        display: 'flex',
        gap: tokens.spacingHorizontalS,
        // Mobile: hide close button (use X in header)
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            display: 'none',
        },
    },
    // Hide help button on mobile
    helpButton: {
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            display: 'none',
        },
    },
    helpPanel: {
        display: 'flex',
        flexDirection: 'column',
        minWidth: '200px',
        backgroundColor: tokens.colorNeutralBackground3,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
        overflowY: 'auto',
        // Mobile: full size when visible
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            minWidth: 'unset',
            width: '100%',
            flex: 1,
            minHeight: 0,
            ...shorthands.borderRadius('0'),
        },
    },
    helpPanelHidden: {
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            display: 'none',
        },
    },
    helpPanelDesktopHidden: {
        // Hide on desktop when showHelp is false
        display: 'none',
        // But show on mobile when the help tab is active (overridden by helpPanelHidden if needed)
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            display: 'flex',
        },
    },
    helpHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: tokens.spacingVerticalM,
        flexShrink: 0,
    },
    helpHeaderControls: {
        display: 'flex',
        gap: tokens.spacingHorizontalXS,
        alignItems: 'center',
        // Hide close button on mobile (use tabs instead)
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            display: 'none',
        },
    },
    helpTypeSelector: {
        width: '100%',
        justifyContent: 'space-between',
        marginBottom: tokens.spacingVerticalM,
    },
    helpTitle: {
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightSemibold,
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
        color: tokens.colorNeutralForeground2,
    },
    helpContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
    },
    helpDescription: {
        fontSize: tokens.fontSizeBase300,
        lineHeight: '1.5',
        color: tokens.colorNeutralForeground1,
    },
    helpSteps: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
    },
    helpStep: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: tokens.spacingHorizontalS,
    },
    helpStepNumber: {
        minWidth: '24px',
        height: '24px',
        ...shorthands.borderRadius('50%'),
        backgroundColor: tokens.colorBrandBackground,
        color: tokens.colorNeutralForegroundOnBrand,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightSemibold,
        flexShrink: 0,
    },
    helpStepText: {
        fontSize: tokens.fontSizeBase300,
        paddingTop: '2px',
    },
    helpExample: {
        backgroundColor: tokens.colorNeutralBackground1,
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        fontFamily: '"Roboto Mono", Consolas, Monaco, monospace',
        fontSize: '13px',
        whiteSpace: 'pre-wrap',
        overflowX: 'auto',
    },
    helpTip: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: tokens.spacingHorizontalS,
        backgroundColor: tokens.colorPaletteYellowBackground1,
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        fontSize: tokens.fontSizeBase200,
    },
    helpTipIcon: {
        color: tokens.colorPaletteYellowForeground2,
        flexShrink: 0,
    },
    helpGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: tokens.spacingHorizontalM,
        fontSize: tokens.fontSizeBase200,
    },
    helpColumn: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalXXS,
    },
    helpLabel: {
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForeground2,
    },
    helpCode: {
        fontFamily: '"Roboto Mono", Consolas, Monaco, monospace',
        backgroundColor: tokens.colorNeutralBackground1,
        ...shorthands.padding('2px', '6px'),
        ...shorthands.borderRadius(tokens.borderRadiusSmall),
        fontSize: '12px',
    },
    copiedIcon: {
        color: tokens.colorPaletteGreenForeground1,
    },
    helpToggle: {
        marginLeft: 'auto',
    },
});

// Sample diagram templates - all available diagram types
const SAMPLE_DIAGRAMS: Array<{ label: string; code: string }> = [
    {
        label: 'Flytskjema',
        code: `flowchart TD
    A[Start] --> B{Val}
    B -->|Ja| C[Handling 1]
    B -->|Nei| D[Handling 2]
    C --> E[Slutt]
    D --> E`,
    },
    {
        label: 'Sekvens',
        code: `sequenceDiagram
    participant Brukar
    participant System
    participant Database
    Brukar->>System: Førespurnad
    System->>Database: Hent data
    Database-->>System: Resultat
    System-->>Brukar: Svar`,
    },
    {
        label: 'Klasse',
        code: `classDiagram
    class Koyretoy {
        +int hjul
        +start()
    }
    class Bil {
        +String merke
        +String modell
        +stopp()
    }
    Koyretoy <|-- Bil`,
    },
    {
        label: 'Tilstand',
        code: `stateDiagram-v2
    [*] --> Ventande
    Ventande --> Aktiv : start
    Aktiv --> Pausa : pause
    Pausa --> Aktiv : hald fram
    Aktiv --> Ferdig : fullfør
    Ferdig --> [*]`,
    },
    {
        label: 'Tankekart',
        code: `mindmap
    root((Hovudtema))
        Emne 1
            Detalj A
            Detalj B
        Emne 2
            Detalj C
            Detalj D
        Emne 3`,
    },
    {
        label: 'Brukarreise',
        code: `journey
    title Søknadsprosessen
    section Førebuing
        Finn informasjon: 5: Brukar
        Last ned skjema: 4: Brukar
    section Utfylling
        Fyll ut skjema: 3: Brukar
        Last opp vedlegg: 2: Brukar
    section Innsending
        Send inn: 4: Brukar
        Få kvittering: 5: Brukar, System`,
    },
    {
        label: 'Tidslinje',
        code: `timeline
    title Prosjekthistorikk
    section Fase 1
        2024 : Oppstart
             : Planlegging
    section Fase 2
        2025 : Utvikling
             : Testing
             : Lansering`,
    },
    {
        label: 'Sektor',
        code: `pie showData
    title Budsjettfordeling
    "Lønn" : 45
    "Drift" : 25
    "Utvikling" : 20
    "Anna" : 10`,
    },
    {
        label: 'Kanban',
        code: `kanban
  todo[Å gjere]
    oppg1[Planlegg møte]
    oppg2[Skriv rapport]
  prog[I arbeid]
    oppg3[Utvikle funksjon]
  done[Ferdig]
    oppg4[Dokumentasjon]`,
    },
    {
        label: 'Kvadrant',
        code: `quadrantChart
    title Prioriteringsmatrise
    x-axis Liten innsats --> Stor innsats
    y-axis Liten verdi --> Stor verdi
    quadrant-1 Gjer fyrst
    quadrant-2 Planlegg
    quadrant-3 Deleger
    quadrant-4 Unnga
    ProsjektA: [0.3, 0.8]
    ProsjektB: [0.7, 0.9]
    ProsjektC: [0.2, 0.3]`,
    },
    {
        label: 'XY-graf',
        code: `xychart-beta
    title "Salsutvikling 2024"
    x-axis [Jan, Feb, Mar, Apr, Mai, Jun]
    y-axis "Sal (tusen kr)" 0 --> 100
    bar [30, 45, 55, 60, 70, 80]
    line [25, 40, 50, 55, 65, 75]`,
    },
    {
        label: 'Arkitektur',
        code: `architecture-beta
    group api(cloud)[API]
    service db(database)[Database] in api
    service disk1(disk)[Storage] in api
    service server(server)[Server] in api
    db:L -- R:server
    disk1:T -- B:server`,
    },
    {
        label: 'Blokk',
        code: `block-beta
    columns 3
    a["Hovudblokk"]:3
    b["Venstre"] c["Midten"] d["Høgre"]
    space:3
    e["Botn"]:3
    b --> e
    d --> e`,
    },
    {
        label: 'Trekart',
        code: `treemap-beta
"Organisasjon"
    "Avdeling A"
        "Team 1": 30
        "Team 2": 20
    "Avdeling B"
        "Team 3": 25
        "Team 4": 15`,
    },
    {
        label: 'Radar',
        code: `radar-beta
    title Kompetanseoversikt
    axis k["Kommunikasjon"], t["Teknisk"], l["Leiing"], s["Samarbeid"], p["Problemløysing"]
    curve a["Team A"]{80,90,70,85,75}
    curve b["Team B"]{70,85,80,90,80}
    max 100
    min 0`,
    },
];

// Help content for each diagram type - simple non-technical explanations
const DIAGRAM_HELP: Record<
    string,
    {
        title: string;
        description: string;
        steps: string[];
        example: string;
        tip?: string;
    }
> = {
    flytskjema: {
        title: 'Flytskjema',
        description: 'Vis ein prosess steg for steg, med val og retningar. Perfekt for å vise korleis noko fungerer.',
        steps: [
            'Start med "flowchart TD" (ovanfrå og ned) eller "flowchart LR" (venstre til høgre)',
            'Lag boksar med tekst: A[Min tekst]',
            'Kople saman med pilar: A --> B',
            'Lag val med krøllparentesar: A{Ja eller nei?}',
        ],
        example: `flowchart TD
    Start[Motta søknad] --> Sjekk{Komplett?}
    Sjekk -->|Ja| Handsam[Handsam søknad]
    Sjekk -->|Nei| Etterspør[Be om meir info]
    Etterspør --> Start
    Handsam --> Ferdig[Send svar]`,
        tip: 'Bruk TD for lodrett flyt, LR for vassrett. Tekst med spesialteikn må ha hermeteikn: A["Tekst (med parentes)"]',
    },
    sekvens: {
        title: 'Sekvensdiagram',
        description:
            'Vis kommunikasjon mellom personar eller system over tid. Bra for å vise kven som snakkar med kven.',
        steps: [
            'Start med "sequenceDiagram"',
            'Definer deltakarar: participant A as Brukar',
            'Vis meldingar med pilar: A->>B: Melding',
            'Vis svar med stipla pil: B-->>A: Svar',
        ],
        example: `sequenceDiagram
    participant B as Brukar
    participant S as System
    participant D as Database
    B->>S: Logg inn
    S->>D: Sjekk brukar
    D-->>S: Brukar funne
    S-->>B: Velkomen!`,
        tip: 'Bruk ->> for vanleg melding og -->> for svar. Teksten etter kolon blir vist på pila.',
    },
    brukarreise: {
        title: 'Brukarreise',
        description: 'Vis opplevinga til ein brukar gjennom ulike steg, med score for kor bra kvart steg er.',
        steps: [
            'Start med "journey"',
            'Legg til tittel: title Min brukarreise',
            'Del inn i fasar: section Fasnamn',
            'Legg til oppgåver med score: Oppgåve: 5: Aktør',
        ],
        example: `journey
    title Bestille billett
    section Finne info
        Søke på nett: 4: Brukar
        Lese prisar: 3: Brukar
    section Bestille
        Velje billett: 5: Brukar
        Betale: 4: Brukar
    section Reise
        Få billett: 5: Brukar, System`,
        tip: 'Score går frå 1 (dårleg) til 5 (bra). Fleire aktørar skrivast med komma: Brukar, System',
    },
    tidslinje: {
        title: 'Tidslinje',
        description: 'Vis hendingar over tid, organisert i fasar. Perfekt for prosjektplanar og historikk.',
        steps: [
            'Start med "timeline"',
            'Legg til tittel: title Min tidslinje',
            'Lag fasar: section Fasnamn',
            'Legg til hendingar: 2024 : Hending',
        ],
        example: `timeline
    title Prosjektplan
    section Oppstart
        2024-01 : Idé og planlegging
        2024-03 : Godkjenning
    section Utvikling
        2024-06 : Første versjon
        2024-09 : Testing
    section Lansering
        2025-01 : Lansering`,
        tip: 'Fleire hendingar på same tidspunkt? Bruk ekstra linjer med berre kolon: : Hending to',
    },
    tankekart: {
        title: 'Tankekart',
        description: 'Organiser idear rundt eit hovudtema. Bra for brainstorming og å vise samanheng.',
        steps: [
            'Start med "mindmap"',
            'Lag hovudtema: root((Hovudtema))',
            'Bruk innrykk for undertema (4 mellomrom)',
            'Fleire nivå = meir innrykk',
        ],
        example: `mindmap
    root((Vestland))
        Bergen
            Bryggen
            Fløibanen
        Sognefjorden
            Flåm
            Aurland
        Hardanger
            Vøringsfossen`,
        tip: 'Innrykk er viktig! Bruk 4 mellomrom for kvart nivå. Rot-noden har doble parentesar.',
    },
    sektor: {
        title: 'Sektordiagram (kake)',
        description: 'Vis fordeling av ein heilskap. Bra for budsjett, statistikk og prosentdeler.',
        steps: [
            'Start med "pie showData"',
            'Legg til tittel: title Min fordeling',
            'Legg til kategoriar: "Namn" : tal',
        ],
        example: `pie showData
    title Budsjettfordeling
    "Personal" : 45
    "Drift" : 25
    "Utvikling" : 20
    "Anna" : 10`,
        tip: 'Tala treng ikkje summere til 100 - dei blir rekna om automatisk. Bruk hermeteikn rundt namn.',
    },
    tilstand: {
        title: 'Tilstandsdiagram',
        description: 'Vis korleis noko endrar seg mellom ulike tilstandar. Bra for status og arbeidsflyt.',
        steps: [
            'Start med "stateDiagram-v2"',
            'Bruk [*] for start og slutt',
            'Definer overgangar: Tilstand1 --> Tilstand2',
            'Legg til tekst på overgang: : hendingsnamn',
        ],
        example: `stateDiagram-v2
    [*] --> Ny
    Ny --> UnderArbeid : Start
    UnderArbeid --> TilGodkjenning : Ferdig
    TilGodkjenning --> Godkjent : OK
    TilGodkjenning --> UnderArbeid : Avvist
    Godkjent --> [*]`,
        tip: 'Tilstandsnamn skal ikkje ha mellomrom eller hermeteikn. Bruk BindeStreker eller SammenslåtteOrd.',
    },
    klasse: {
        title: 'Klassediagram',
        description: 'Vis strukturen i eit system med boksar og relasjonar. Bra for organisasjonskart.',
        steps: [
            'Start med "classDiagram"',
            'Lag boksar med innhald inne i klammeparentesar',
            'Vis relasjonar med pilar',
        ],
        example: `classDiagram
    class Avdeling {
        Namn
        Leiar
        Tal tilsette
    }
    class Team {
        Namn
        Prosjekt
    }
    Avdeling --> Team : har`,
        tip: 'Bruk <|-- for "er ein type av", *-- for "inneheld", --> for "kopla til".',
    },
    kanban: {
        title: 'Kanban-tavle',
        description: 'Vis oppgåver i kolonnar etter status. Perfekt for oppgåvelister og prosjektstyring.',
        steps: [
            'Start med "kanban"',
            'Lag kolonnar: kolonneId[Kolonnenamn]',
            'Legg til oppgåver under kvar kolonne med innrykk',
        ],
        example: `kanban
    todo[Å gjere]
        oppg1[Lage presentasjon]
        oppg2[Skrive rapport]
    doing[I arbeid]
        oppg3[Planlegge møte]
    done[Ferdig]
        oppg4[Send e-post]`,
        tip: 'Kolonne-ID og oppgåve-ID (før klammeparentesen) må vere utan mellomrom.',
    },
    kvadrant: {
        title: 'Kvadrantdiagram',
        description: 'Plasser element i fire felt basert på to eigenskapar. Bra for prioritering og analyse.',
        steps: [
            'Start med "quadrantChart"',
            'Definer aksar med label og retning',
            'Gje namn til dei fire felta',
            'Plasser punkt med koordinatar [x, y] mellom 0 og 1',
        ],
        example: `quadrantChart
    title Prioritering
    x-axis Lite arbeid --> Mykje arbeid
    y-axis Liten verdi --> Stor verdi
    quadrant-1 Gjer no
    quadrant-2 Planlegg
    quadrant-3 Seinare
    quadrant-4 Dropp
    ProsjektA: [0.2, 0.8]
    ProsjektB: [0.7, 0.6]`,
        tip: 'Punkt-namn må vere eitt ord utan mellomrom. Koordinatar går frå 0 til 1.',
    },
    xygraf: {
        title: 'XY-graf',
        description: 'Vis data som søyler eller linjer. Bra for statistikk og utvikling over tid.',
        steps: [
            'Start med "xychart-beta"',
            'Definer x-akse med verdiar i klammer',
            'Definer y-akse med namn og område',
            'Legg til data som søyler (bar) eller linjer (line)',
        ],
        example: `xychart-beta
    title "Besøk per månad"
    x-axis [Jan, Feb, Mar, Apr, Mai, Jun]
    y-axis "Tal besøk" 0 --> 1000
    bar [200, 350, 400, 550, 700, 900]
    line [180, 320, 380, 500, 650, 850]`,
        tip: 'Du kan ha både søyler og linjer i same diagram. Tal på y-aksen må matche dataverdiane.',
    },
    arkitektur: {
        title: 'Arkitekturdiagram',
        description: 'Vis system og komponentar med ikon. Bra for teknisk oversikt.',
        steps: [
            'Start med "architecture-beta"',
            'Lag grupper: group id(ikon)[Namn]',
            'Legg til tenester: service id(ikon)[Namn] in gruppe',
            'Kople saman: id:RETNING -- RETNING:id',
        ],
        example: `architecture-beta
    group system(cloud)[Systemet]
    service web(server)[Nettside] in system
    service db(database)[Database] in system
    service lagring(disk)[Fillagring] in system
    web:R -- L:db
    db:B -- T:lagring`,
        tip: 'Ikon: cloud, server, database, disk, internet. Retningar: L (venstre), R (høgre), T (topp), B (botn).',
    },
    blokk: {
        title: 'Blokkdiagram',
        description: 'Vis enkle boksar i eit rutenett. Bra for oversikt og enkle strukturar.',
        steps: [
            'Start med "block-beta"',
            'Definer kolonnar: columns 3',
            'Lag boksar: id["Tekst"]',
            'Spenn over fleire kolonnar: id["Tekst"]:2',
        ],
        example: `block-beta
    columns 3
    header["Overskrift"]:3
    a["Boks A"] b["Boks B"] c["Boks C"]
    space:3
    footer["Botn"]:3`,
        tip: 'Bruk space for tomme felt. Talet etter kolon viser kor mange kolonnar boksen spenner over.',
    },
    radar: {
        title: 'Radardiagram',
        description: 'Vis fleire eigenskapar på ein gong. Bra for samanlikning og vurdering.',
        steps: [
            'Start med "radar-beta"',
            'Definer aksar: axis id["Namn"], id["Namn"]',
            'Legg til dataserier: curve id["Namn"]{verdi,verdi,verdi}',
            'Sett min og maks verdi',
        ],
        example: `radar-beta
    title Vurdering
    axis a["Service"], b["Pris"], c["Kvalitet"], d["Levering"]
    curve team1["Team A"]{80,60,90,70}
    curve team2["Team B"]{70,80,75,85}
    max 100
    min 0`,
        tip: 'Antal verdiar i kvar curve må matche antal aksar. Ikkje bruk mellomrom mellom tala.',
    },
    trekart: {
        title: 'Trekart',
        description: 'Vis hierarkisk data som nestla boksar. Storleiken viser mengde eller verdi.',
        steps: [
            'Start med "treemap-beta"',
            'Lag hovudkategori: "Namn"',
            'Bruk innrykk for underkategoriar',
            'Legg til verdi på bladnoder: "Namn": tal',
        ],
        example: `treemap-beta
"Organisasjon"
    "Avdeling A"
        "Team 1": 30
        "Team 2": 20
    "Avdeling B"
        "Team 3": 25`,
        tip: 'Alle namn må ha hermeteikn. Innrykk viser hierarkiet. Verdiar avgjer storleiken på boksane.',
    },
};

interface MermaidEditorModalProps {
    code: string;
    isDark?: boolean;
    trigger?: React.ReactElement;
    onClose?: () => void;
    // External state control - allows opening modal without trigger
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
}

// Mermaid types
interface MermaidConfig {
    startOnLoad?: boolean;
    securityLevel?: 'strict' | 'loose' | 'antiscript';
    theme?: 'default' | 'forest' | 'dark' | 'neutral' | 'base';
    themeVariables?: Record<string, string>;
    // Suppress error rendering in DOM - we handle errors ourselves
    suppressErrorRendering?: boolean;
    xyChart?: Record<string, string>;
}
interface MermaidAPI {
    initialize: (config: MermaidConfig) => void;
    render: (id: string, text: string) => Promise<{ svg: string }>;
}

// Theme variables imported from MermaidStyles.ts

// Single mermaid instance - ALWAYS uses light mode for consistent rendering
let previewMermaid: MermaidAPI | null = null;
let previewIdCounter = 0;

const getPreviewMermaid = async (): Promise<MermaidAPI> => {
    if (!previewMermaid) {
        const mermaidModule = (await import('mermaid')) as unknown as { default: MermaidAPI };
        previewMermaid = mermaidModule.default;
        // ALWAYS use light mode - diagrams look the same regardless of app theme
        previewMermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            // Prevent Mermaid from injecting error SVGs directly into DOM
            // We handle errors ourselves via the catch block
            suppressErrorRendering: true,
            theme: 'base',
            themeVariables: buildVestlandThemeVariables(false), // Always light mode
            xyChart: getXYChartConfig(false), // Always light mode
        });
    }
    return previewMermaid;
};

export const MermaidEditorModal: React.FC<MermaidEditorModalProps> = ({
    code,
    isDark: _isDark = false, // Unused - diagrams always use light mode
    trigger,
    onClose,
    isOpen: externalIsOpen,
    onOpenChange: externalOnOpenChange,
}) => {
    const classes = useClasses();
    // Support both internal and external state control
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    // Use external state if provided, otherwise use internal state
    // Note: we check for undefined specifically because false is a valid value
    const isControlled = externalIsOpen !== undefined;
    const isOpen = isControlled ? externalIsOpen : internalIsOpen;
    const setIsOpen = (open: boolean) => {
        if (externalOnOpenChange) {
            externalOnOpenChange(open);
        } else {
            setInternalIsOpen(open);
        }
    };
    const [editedCode, setEditedCode] = useState(code);
    const [previewSvg, setPreviewSvg] = useState<string>('');
    const [previewError, setPreviewError] = useState<string>('');
    const [isRendering, setIsRendering] = useState(false);
    const [copied, setCopied] = useState(false);
    const [zoom, setZoom] = useState(100);
    const [showHelp, setShowHelp] = useState(false);
    const [selectedHelpTopic, setSelectedHelpTopic] = useState<string>('flytskjema');
    // Mobile tab state: 'code', 'preview', or 'help'
    const [mobileTab, setMobileTab] = useState<'code' | 'preview' | 'help'>('code');

    // Resizable pane state (percentages)
    const [editorWidth, setEditorWidth] = useState(35); // % of total width
    const [previewWidth, setPreviewWidth] = useState(45); // % of total width
    const [helpWidth, setHelpWidth] = useState(20); // % of total width
    const [isResizing, setIsResizing] = useState<'editor' | 'preview' | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);

    // Calculate line numbers
    const lineCount = editedCode.split('\n').length;
    const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');

    // Sync scroll between textarea and line numbers
    const handleScroll = useCallback(() => {
        if (textareaRef.current && lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
        }
    }, []);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setEditedCode(code);
            setCopied(false);
            setZoom(100);
            setPanOffset({ x: 0, y: 0 });
            setPreviewError('');
            // Reset mermaid instance to pick up theme
            previewMermaid = null;
        }
    }, [isOpen, code]);

    // Render preview with debounce - always uses light mode
    const renderPreview = useCallback(async (codeToRender: string) => {
        if (!codeToRender.trim()) {
            setPreviewSvg('');
            setPreviewError('');
            return;
        }

        setIsRendering(true);
        setPreviewError('');

        try {
            const mermaid = await getPreviewMermaid();
            const renderId = `mermaid-preview-${++previewIdCounter}`;
            const result = await mermaid.render(renderId, codeToRender.trim());
            setPreviewSvg(result.svg);
            setPreviewError('');
        } catch (err) {
            setPreviewSvg('');
            const errorMessage = err instanceof Error ? err.message : 'Ukjent feil';
            const cleanError = errorMessage
                .replace(/ParseError:?\s*/gi, '')
                .replace(/Syntax error in.*?(?=\n|$)/g, '')
                .trim();
            setPreviewError(cleanError || 'Syntaksfeil i diagramkoden');
        } finally {
            setIsRendering(false);
        }
    }, []);

    // Debounced preview update (re-render when isDark changes)
    useEffect(() => {
        if (!isOpen) return;

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            void renderPreview(editedCode);
        }, 400);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [editedCode, isOpen, renderPreview]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(editedCode);
            setCopied(true);
            setTimeout(() => {
                setCopied(false);
            }, 2000);
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = editedCode;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => {
                setCopied(false);
            }, 2000);
        }
    };

    // Pan state for dragging
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

    // Touch support ref for pinch-zoom
    const lastPinchDistanceRef = useRef<number | null>(null);

    const handleZoomIn = () => {
        setZoom((z) => Math.min(z + 50, 1000));
    };
    const handleZoomOut = () => {
        setZoom((z) => Math.max(z - 50, 10));
    };
    const handleZoomReset = () => {
        setZoom(100);
        setPanOffset({ x: 0, y: 0 });
    };

    // Handle mouse wheel zoom
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -25 : 25; // Scroll down = zoom out, scroll up = zoom in
        setZoom((z) => Math.max(10, Math.min(1000, z + delta)));
    }, []);

    // Pan/drag handlers
    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (e.button !== 0) return; // Only left click
            setIsPanning(true);
            setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
        },
        [panOffset],
    );

    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (!isPanning) return;
            setPanOffset({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y,
            });
        },
        [isPanning, panStart],
    );

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setIsPanning(false);
    }, []);

    // Touch handlers for mobile pinch-zoom and pan
    const handleTouchStart = useCallback(
        (e: React.TouchEvent) => {
            if (e.touches.length === 2) {
                // Pinch start - calculate initial distance between fingers
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
                lastPinchDistanceRef.current = distance;
            } else if (e.touches.length === 1) {
                // Single finger - start panning
                const touch = e.touches[0];
                setIsPanning(true);
                setPanStart({ x: touch.clientX - panOffset.x, y: touch.clientY - panOffset.y });
            }
        },
        [panOffset],
    );

    const handleTouchMove = useCallback(
        (e: React.TouchEvent) => {
            if (e.touches.length === 2 && lastPinchDistanceRef.current !== null) {
                // Pinch zoom
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
                const delta = distance - lastPinchDistanceRef.current;

                // Scale the delta for smoother zooming
                const zoomDelta = delta * 0.5;
                setZoom((z) => Math.max(10, Math.min(1000, z + zoomDelta)));
                lastPinchDistanceRef.current = distance;
            } else if (e.touches.length === 1 && isPanning) {
                // Single finger pan
                const touch = e.touches[0];
                setPanOffset({
                    x: touch.clientX - panStart.x,
                    y: touch.clientY - panStart.y,
                });
            }
        },
        [isPanning, panStart],
    );

    const handleTouchEnd = useCallback(() => {
        lastPinchDistanceRef.current = null;
        setIsPanning(false);
    }, []);

    // Resize pane handlers
    const handleResizeStart = useCallback((pane: 'editor' | 'preview') => {
        setIsResizing(pane);
    }, []);

    const handleResizeMove = useCallback(
        (e: React.MouseEvent) => {
            if (!isResizing || !containerRef.current) return;

            const containerRect = containerRef.current.getBoundingClientRect();
            const containerWidth = containerRect.width;
            const mouseX = e.clientX - containerRect.left;
            const mousePercent = (mouseX / containerWidth) * 100;

            if (isResizing === 'editor') {
                // Resizing between editor and preview
                const newEditorWidth = Math.max(15, Math.min(60, mousePercent));
                const remainingWidth = 100 - newEditorWidth;
                if (showHelp) {
                    const ratio = previewWidth / (previewWidth + helpWidth);
                    setEditorWidth(newEditorWidth);
                    setPreviewWidth(remainingWidth * ratio);
                    setHelpWidth(remainingWidth * (1 - ratio));
                } else {
                    setEditorWidth(newEditorWidth);
                    setPreviewWidth(remainingWidth);
                }
            } else {
                // Resizing between preview and help (isResizing === 'preview')
                const newPreviewEnd = Math.max(editorWidth + 15, Math.min(85, mousePercent));
                setPreviewWidth(newPreviewEnd - editorWidth);
                setHelpWidth(100 - newPreviewEnd);
            }
        },
        [isResizing, editorWidth, previewWidth, helpWidth, showHelp],
    );

    const handleResizeEnd = useCallback(() => {
        setIsResizing(null);
    }, []);

    // Handle Tab key for indentation
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const textarea = e.currentTarget;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const spaces = '    '; // 4 spaces for indent

                if (e.shiftKey) {
                    // Shift+Tab: remove indent from start of line
                    const beforeCursor = editedCode.substring(0, start);
                    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
                    const lineContent = editedCode.substring(lineStart, start);

                    // Check if line starts with spaces
                    const spacesToRemove = lineContent.match(/^( {1,4})/)?.[1]?.length ?? 0;
                    if (spacesToRemove > 0) {
                        const newCode =
                            editedCode.substring(0, lineStart) + editedCode.substring(lineStart + spacesToRemove);
                        setEditedCode(newCode);
                        // Move cursor back
                        setTimeout(() => {
                            textarea.selectionStart = textarea.selectionEnd = start - spacesToRemove;
                        }, 0);
                    }
                } else {
                    // Tab: insert spaces at cursor
                    const newCode = editedCode.substring(0, start) + spaces + editedCode.substring(end);
                    setEditedCode(newCode);
                    // Move cursor after inserted spaces
                    setTimeout(() => {
                        textarea.selectionStart = textarea.selectionEnd = start + spaces.length;
                    }, 0);
                }
            }
        },
        [editedCode],
    );

    const handleSampleInsert = (sampleCode: string) => {
        setEditedCode(sampleCode);
    };

    const handleClose = () => {
        setIsOpen(false);
        onClose?.();
    };

    // Render diagram for download (same as preview - always light mode)
    const renderForDownload = async (): Promise<string | null> => {
        try {
            const mermaid = await getPreviewMermaid();
            const renderId = `mermaid-download-${++previewIdCounter}`;
            const result = await mermaid.render(renderId, editedCode.trim());
            return result.svg;
        } catch {
            return null;
        }
    };

    // Download as SVG (always light mode)
    const downloadSvg = async () => {
        if (!editedCode.trim()) return;
        // Render fresh SVG in light mode for download
        const lightModeSvg = await renderForDownload();
        const svgToDownload = lightModeSvg ?? previewSvg;
        if (!svgToDownload) return;

        const svgBlob = new Blob([svgToDownload], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'diagram.svg';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    // Download as PNG (always light mode)
    const downloadPng = async (scale = 2) => {
        if (!editedCode.trim()) return;

        try {
            // Render fresh SVG in light mode for download
            const lightModeSvg = await renderForDownload();
            const svgToUse = lightModeSvg ?? previewSvg;
            if (!svgToUse) return;

            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgToUse, 'image/svg+xml');
            const svgEl = svgDoc.documentElement;

            // Get dimensions from viewBox
            let width = 800;
            let height = 600;
            const viewBox = svgEl.getAttribute('viewBox') ?? '';
            if (viewBox) {
                const parts = viewBox.split(/\s+|,/).map((p) => Number.parseFloat(p));
                if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
                    width = parts[2];
                    height = parts[3];
                }
            }

            const scaledWidth = Math.round(width * scale);
            const scaledHeight = Math.round(height * scale);

            // Clone and set dimensions
            const svgClone = svgEl.cloneNode(true) as SVGSVGElement;
            svgClone.setAttribute('width', String(scaledWidth));
            svgClone.setAttribute('height', String(scaledHeight));

            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgClone);
            const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
            const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;

            const img = new Image();
            img.crossOrigin = 'anonymous';

            await new Promise<void>((resolve, reject) => {
                img.onload = () => {
                    resolve();
                };
                img.onerror = () => {
                    reject(new Error('Failed to load'));
                };
                img.src = dataUrl;
            });

            const canvas = document.createElement('canvas');
            canvas.width = scaledWidth;
            canvas.height = scaledHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // White background (always light mode for export)
            ctx.fillStyle = LIGHT_BACKGROUND;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

            const pngBlob: Blob | null = await new Promise((resolve) => {
                canvas.toBlob((b) => {
                    resolve(b);
                }, 'image/png');
            });

            if (!pngBlob) {
                void downloadSvg();
                return;
            }

            const a = document.createElement('a');
            a.href = URL.createObjectURL(pngBlob);
            a.download = `diagram-${scale}x.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(a.href);
        } catch {
            void downloadSvg();
        }
    };

    const defaultTrigger = (
        <Tooltip content="Opne i diagrameditor" relationship="label">
            <Button size="small" appearance="subtle" icon={<Open20Regular />} aria-label="Opne i diagrameditor" />
        </Tooltip>
    );

    // Hidden trigger for controlled mode - must be a real element
    const hiddenTrigger = <span style={{ display: 'none' }} />;

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(_, data) => {
                setIsOpen(data.open);
                if (!data.open) {
                    onClose?.();
                }
            }}
        >
            <DialogTrigger disableButtonEnhancement>
                {isControlled ? hiddenTrigger : (trigger ?? defaultTrigger)}
            </DialogTrigger>
            <DialogSurface className={classes.surface}>
                <DialogBody>
                    <DialogTitle
                        action={
                            <DialogTrigger action="close">
                                <Button appearance="subtle" aria-label="Lukk" icon={<Dismiss24Regular />} />
                            </DialogTrigger>
                        }
                    >
                        Diagrameditor
                    </DialogTitle>
                    <DialogContent>
                        {/* Mobile tab bar */}
                        <div className={classes.mobileTabBar}>
                            <TabList
                                selectedValue={mobileTab}
                                onTabSelect={(_, data) => {
                                    setMobileTab(data.value as 'code' | 'preview' | 'help');
                                }}
                            >
                                <Tab value="code" icon={<Code20Regular />}>
                                    Kode
                                </Tab>
                                <Tab value="preview" icon={<Eye20Regular />}>
                                    Førehandsvisning
                                </Tab>
                                <Tab value="help" icon={<Question20Regular />}>
                                    Hjelp
                                </Tab>
                            </TabList>
                        </div>
                        <div
                            ref={containerRef}
                            className={classes.contentWrapper}
                            onMouseMove={isResizing ? handleResizeMove : undefined}
                            onMouseUp={isResizing ? handleResizeEnd : undefined}
                            onMouseLeave={isResizing ? handleResizeEnd : undefined}
                        >
                            {/* Editor pane */}
                            <div
                                className={mergeClasses(
                                    classes.editorPane,
                                    mobileTab !== 'code' && classes.editorPaneHidden,
                                )}
                                style={{
                                    width: showHelp
                                        ? `${editorWidth}%`
                                        : `${(editorWidth / (editorWidth + previewWidth)) * 100}%`,
                                }}
                            >
                                <div className={classes.paneHeader}>
                                    <div className={classes.paneTitle}>Mermaid-kode</div>
                                    <Menu>
                                        <MenuTrigger disableButtonEnhancement>
                                            <Button
                                                size="small"
                                                appearance="subtle"
                                                icon={<ChevronDown16Regular />}
                                                iconPosition="after"
                                            >
                                                Eksempel
                                            </Button>
                                        </MenuTrigger>
                                        <MenuPopover>
                                            <MenuList>
                                                {SAMPLE_DIAGRAMS.map((sample) => (
                                                    <MenuItem
                                                        key={sample.label}
                                                        onClick={() => {
                                                            handleSampleInsert(sample.code);
                                                        }}
                                                    >
                                                        {sample.label}
                                                    </MenuItem>
                                                ))}
                                            </MenuList>
                                        </MenuPopover>
                                    </Menu>
                                </div>
                                <div className={classes.editorWrapper}>
                                    <div ref={lineNumbersRef} className={classes.lineNumbers} aria-hidden="true">
                                        {lineNumbers}
                                    </div>
                                    <textarea
                                        ref={textareaRef}
                                        className={classes.textarea}
                                        value={editedCode}
                                        onChange={(e) => {
                                            setEditedCode(e.target.value);
                                        }}
                                        onScroll={handleScroll}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Skriv Mermaid-kode her..."
                                        spellCheck={false}
                                    />
                                </div>
                            </div>

                            {/* Resize handle between editor and preview */}
                            <div
                                className={`${classes.resizeHandle} ${isResizing === 'editor' ? classes.resizeHandleActive : ''}`}
                                onMouseDown={() => {
                                    handleResizeStart('editor');
                                }}
                            >
                                <div className={classes.resizeHandleLine} />
                            </div>

                            {/* Preview pane */}
                            <div
                                className={mergeClasses(
                                    classes.previewPane,
                                    mobileTab !== 'preview' && classes.previewPaneHidden,
                                )}
                                style={{
                                    width: showHelp
                                        ? `${previewWidth}%`
                                        : `${(previewWidth / (editorWidth + previewWidth)) * 100}%`,
                                }}
                            >
                                <div className={classes.paneHeader}>
                                    <div className={classes.paneTitle}>Førehandsvisning</div>
                                    <div className={classes.zoomControls}>
                                        <Tooltip content="Zoom ut" relationship="label">
                                            <Button
                                                size="small"
                                                appearance="subtle"
                                                icon={<Subtract20Regular />}
                                                onClick={handleZoomOut}
                                                disabled={zoom <= 10}
                                                aria-label="Zoom ut"
                                            />
                                        </Tooltip>
                                        <Tooltip content="Scrollehjul = zoom, dra = flytt" relationship="description">
                                            <span className={classes.zoomLabel}>{zoom}%</span>
                                        </Tooltip>
                                        <Tooltip content="Zoom inn" relationship="label">
                                            <Button
                                                size="small"
                                                appearance="subtle"
                                                icon={<Add20Regular />}
                                                onClick={handleZoomIn}
                                                disabled={zoom >= 1000}
                                                aria-label="Zoom inn"
                                            />
                                        </Tooltip>
                                        <Tooltip content="Nullstill visning" relationship="label">
                                            <Button
                                                size="small"
                                                appearance="subtle"
                                                icon={<ArrowReset20Regular />}
                                                onClick={handleZoomReset}
                                                aria-label="Nullstill visning"
                                            />
                                        </Tooltip>
                                    </div>
                                </div>
                                <div className={classes.previewContainer}>
                                    <div
                                        className={`${classes.previewInner} ${isPanning ? classes.previewInnerDragging : ''}`}
                                        onWheel={handleWheel}
                                        onMouseDown={handleMouseDown}
                                        onMouseMove={handleMouseMove}
                                        onMouseUp={handleMouseUp}
                                        onMouseLeave={handleMouseLeave}
                                        onTouchStart={handleTouchStart}
                                        onTouchMove={handleTouchMove}
                                        onTouchEnd={handleTouchEnd}
                                    >
                                        {isRendering ? (
                                            <div className={classes.loading}>
                                                <Spinner size="small" />
                                                <span>Rendrar...</span>
                                            </div>
                                        ) : previewError ? (
                                            <div className={classes.error}>⚠️ {previewError}</div>
                                        ) : previewSvg ? (
                                            <div
                                                className={mergeClasses(classes.previewSvg, classes.previewSvgLight)}
                                                style={{
                                                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom / 100})`,
                                                }}
                                                dangerouslySetInnerHTML={{ __html: previewSvg }}
                                            />
                                        ) : (
                                            <div className={classes.loading}>Skriv kode for å sjå førehandsvisning</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Resize handle between preview and help */}
                            {showHelp && (
                                <div
                                    className={`${classes.resizeHandle} ${isResizing === 'preview' ? classes.resizeHandleActive : ''}`}
                                    onMouseDown={() => {
                                        handleResizeStart('preview');
                                    }}
                                >
                                    <div className={classes.resizeHandleLine} />
                                </div>
                            )}

                            {/* Help panel (right side on desktop, tab on mobile) */}
                            <div
                                className={mergeClasses(
                                    classes.helpPanel,
                                    !showHelp && classes.helpPanelDesktopHidden,
                                    mobileTab !== 'help' && classes.helpPanelHidden,
                                )}
                                style={{ width: showHelp ? `${helpWidth}%` : undefined }}
                            >
                                <div className={classes.helpHeader}>
                                    <div className={classes.helpTitle}>
                                        <Question20Regular />
                                        Hjelp
                                    </div>
                                    <div className={classes.helpHeaderControls}>
                                        <Tooltip content="Lukk hjelp" relationship="label">
                                            <Button
                                                appearance="subtle"
                                                size="small"
                                                icon={<Dismiss24Regular />}
                                                onClick={() => {
                                                    setShowHelp(false);
                                                }}
                                                aria-label="Lukk hjelp"
                                            />
                                        </Tooltip>
                                    </div>
                                </div>

                                {/* Diagram type selector */}
                                <Menu>
                                    <MenuTrigger disableButtonEnhancement>
                                        <Button
                                            appearance="outline"
                                            size="small"
                                            iconPosition="after"
                                            icon={<ChevronDown16Regular />}
                                            className={classes.helpTypeSelector}
                                        >
                                            {DIAGRAM_HELP[selectedHelpTopic].title}
                                        </Button>
                                    </MenuTrigger>
                                    <MenuPopover>
                                        <MenuList>
                                            <MenuItem
                                                onClick={() => {
                                                    setSelectedHelpTopic('flytskjema');
                                                }}
                                            >
                                                Flytskjema
                                            </MenuItem>
                                            <MenuItem
                                                onClick={() => {
                                                    setSelectedHelpTopic('sekvens');
                                                }}
                                            >
                                                Sekvensdiagram
                                            </MenuItem>
                                            <MenuItem
                                                onClick={() => {
                                                    setSelectedHelpTopic('brukarreise');
                                                }}
                                            >
                                                Brukarreise
                                            </MenuItem>
                                            <MenuItem
                                                onClick={() => {
                                                    setSelectedHelpTopic('tidslinje');
                                                }}
                                            >
                                                Tidslinje
                                            </MenuItem>
                                            <MenuItem
                                                onClick={() => {
                                                    setSelectedHelpTopic('tankekart');
                                                }}
                                            >
                                                Tankekart
                                            </MenuItem>
                                            <MenuItem
                                                onClick={() => {
                                                    setSelectedHelpTopic('sektor');
                                                }}
                                            >
                                                Sektordiagram
                                            </MenuItem>
                                            <MenuItem
                                                onClick={() => {
                                                    setSelectedHelpTopic('tilstand');
                                                }}
                                            >
                                                Tilstandsdiagram
                                            </MenuItem>
                                            <MenuItem
                                                onClick={() => {
                                                    setSelectedHelpTopic('klasse');
                                                }}
                                            >
                                                Klassediagram
                                            </MenuItem>
                                            <MenuItem
                                                onClick={() => {
                                                    setSelectedHelpTopic('kanban');
                                                }}
                                            >
                                                Kanban-tavle
                                            </MenuItem>
                                            <MenuItem
                                                onClick={() => {
                                                    setSelectedHelpTopic('kvadrant');
                                                }}
                                            >
                                                Kvadrantdiagram
                                            </MenuItem>
                                            <MenuItem
                                                onClick={() => {
                                                    setSelectedHelpTopic('xygraf');
                                                }}
                                            >
                                                XY-graf
                                            </MenuItem>
                                            <MenuItem
                                                onClick={() => {
                                                    setSelectedHelpTopic('arkitektur');
                                                }}
                                            >
                                                Arkitektur
                                            </MenuItem>
                                            <MenuItem
                                                onClick={() => {
                                                    setSelectedHelpTopic('blokk');
                                                }}
                                            >
                                                Blokkdiagram
                                            </MenuItem>
                                            <MenuItem
                                                onClick={() => {
                                                    setSelectedHelpTopic('radar');
                                                }}
                                            >
                                                Radardiagram
                                            </MenuItem>
                                            <MenuItem
                                                onClick={() => {
                                                    setSelectedHelpTopic('trekart');
                                                }}
                                            >
                                                Trekart
                                            </MenuItem>
                                        </MenuList>
                                    </MenuPopover>
                                </Menu>

                                <div className={classes.helpContent}>
                                    <div className={classes.helpDescription}>
                                        {DIAGRAM_HELP[selectedHelpTopic].description}
                                    </div>

                                    <div className={classes.helpSteps}>
                                        <div className={classes.helpLabel}>Slik gjer du:</div>
                                        {DIAGRAM_HELP[selectedHelpTopic].steps.map((step, index) => (
                                            <div key={index} className={classes.helpStep}>
                                                <div className={classes.helpStepNumber}>{index + 1}</div>
                                                <div className={classes.helpStepText}>{step}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div>
                                        <div className={classes.helpLabel} style={{ marginBottom: '8px' }}>
                                            Eksempel:
                                        </div>
                                        <pre className={classes.helpExample}>
                                            {DIAGRAM_HELP[selectedHelpTopic].example}
                                        </pre>
                                    </div>

                                    {DIAGRAM_HELP[selectedHelpTopic].tip && (
                                        <div className={classes.helpTip}>
                                            <Info20Regular className={classes.helpTipIcon} />
                                            <span>
                                                <strong>Tips:</strong> {DIAGRAM_HELP[selectedHelpTopic].tip}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                    <DialogActions className={classes.actions}>
                        <div className={classes.actionsLeft}>
                            <Menu>
                                <MenuTrigger disableButtonEnhancement>
                                    <Button
                                        appearance="primary"
                                        icon={<ArrowDownload20Regular />}
                                        iconPosition="before"
                                        disabled={!previewSvg || !!previewError}
                                    >
                                        Last ned
                                        <ChevronDown16Regular style={{ marginLeft: '4px' }} />
                                    </Button>
                                </MenuTrigger>
                                <MenuPopover>
                                    <MenuList>
                                        <MenuItem
                                            onClick={() => {
                                                void downloadSvg();
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 500 }}>SVG (vektor)</div>
                                                <div style={{ fontSize: '12px', opacity: 0.7 }}>
                                                    Beste kvalitet, skalerbar til alle storleikar
                                                </div>
                                            </div>
                                        </MenuItem>
                                        <MenuItem
                                            onClick={() => {
                                                void downloadPng(1);
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 500 }}>PNG Liten (1x)</div>
                                                <div style={{ fontSize: '12px', opacity: 0.7 }}>
                                                    For nett og rask deling
                                                </div>
                                            </div>
                                        </MenuItem>
                                        <MenuItem
                                            onClick={() => {
                                                void downloadPng(2);
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 500 }}>PNG Medium (2x)</div>
                                                <div style={{ fontSize: '12px', opacity: 0.7 }}>Standard kvalitet</div>
                                            </div>
                                        </MenuItem>
                                        <MenuItem
                                            onClick={() => {
                                                void downloadPng(4);
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 500 }}>PNG Stor (4x)</div>
                                                <div style={{ fontSize: '12px', opacity: 0.7 }}>For presentasjonar</div>
                                            </div>
                                        </MenuItem>
                                        <MenuItem
                                            onClick={() => {
                                                void downloadPng(6);
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 500 }}>PNG Ekstra stor (6x)</div>
                                                <div style={{ fontSize: '12px', opacity: 0.7 }}>For trykk</div>
                                            </div>
                                        </MenuItem>
                                        <MenuItem
                                            onClick={() => {
                                                void downloadPng(8);
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 500 }}>PNG Maksimal (8x)</div>
                                                <div style={{ fontSize: '12px', opacity: 0.7 }}>Høgaste kvalitet</div>
                                            </div>
                                        </MenuItem>
                                    </MenuList>
                                </MenuPopover>
                            </Menu>
                            <Button
                                appearance="secondary"
                                icon={
                                    copied ? <Checkmark20Regular className={classes.copiedIcon} /> : <Copy20Regular />
                                }
                                onClick={() => void handleCopy()}
                            >
                                {copied ? 'Kopiert!' : 'Kopier kode'}
                            </Button>
                            <Button
                                appearance="subtle"
                                icon={<Question20Regular />}
                                onClick={() => {
                                    setShowHelp(!showHelp);
                                }}
                                className={classes.helpButton}
                            >
                                {showHelp ? 'Skjul hjelp' : 'Vis hjelp'}
                            </Button>
                        </div>
                        <div className={classes.actionsRight}>
                            <Button appearance="secondary" onClick={handleClose}>
                                Lukk
                            </Button>
                        </div>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};

export default MermaidEditorModal;
