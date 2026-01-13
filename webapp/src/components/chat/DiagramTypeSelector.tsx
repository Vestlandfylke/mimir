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
    TbArrowsExchange,
    TbBinaryTree2,
    TbBrain,
    TbBuildingSkyscraper,
    TbChartLine,
    TbChartPie,
    TbChartRadar,
    TbChartTreemap,
    TbCircleDot,
    TbHierarchy2,
    TbLayoutBoard,
    TbLayoutGrid,
    TbLayoutKanban,
    TbTimeline,
    TbWalk,
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
        maxWidth: 'min(480px, calc(100vw - 32px))', // Responsive max width
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
        '@media (max-width: 400px)': {
            gridTemplateColumns: 'repeat(3, 1fr)', // 3 columns on small mobile
        },
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
        maxWidth: '100%',
        minWidth: 0, // Allow flex item to shrink below content size
        overflow: 'hidden',
    },
    selectedName: {
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForegroundOnBrand,
        flexShrink: 0, // Don't shrink the name
        whiteSpace: 'nowrap',
    },
    selectedDivider: {
        width: '1px',
        height: '16px',
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        flexShrink: 0,
        '@media (max-width: 480px)': {
            display: 'none', // Hide divider on mobile
        },
    },
    selectedDescription: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForegroundOnBrand,
        opacity: 0.9,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        minWidth: 0,
        '@media (max-width: 480px)': {
            display: 'none', // Hide description on mobile to save space
        },
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
        prompt: `Lag eit Mermaid flytskjema. VIKTIG: Skriv alltid på Nynorsk og start med "flowchart TD" (topp-til-botn) eller "flowchart LR" (venstre-til-høgre). Syntaks-døme:

flowchart TD
    A[Start] --> B{Val}
    B -->|Ja| C[Handling]
    B -->|Nei| D[Anna handling]
    C --> E[Slutt]
    D --> E

VIKTIG: Bruk hermeteikn rundt tekst med spesialteikn: A["Tekst med (parentesar)"]. Ikkje bruk ordet "end" med små bokstavar - bruk "End" eller "END". Bruk norske (nynorsk) tekstar.`,
    },
    {
        id: 'classDiagram',
        label: 'Klasse',
        description: 'Vis klassar, eigenskapar og relasjonar i objektorientert kode',
        icon: <TbHierarchy2 />,
        prompt: `Lag eit Mermaid klassediagram. VIKTIG: Skriv alltid på Nynorsk og start med "classDiagram".

KRITISK SYNTAKS - Klassenamn UTAN hermeteikn:

classDiagram
    class Person {
        +String namn
        +int alder
        +String epost
        +loggInn()
    }
    class Student {
        +String studentnummer
        +String studieprogram
    }
    class Laerar {
        +String ansattnummer
        +setKarakter()
    }
    Person <|-- Student
    Person <|-- Laerar
    Student "1" --> "*" Kurs : melder seg på

VIKTIGE REGLAR:
- Klassenamn UTAN hermeteikn: class Person { (IKKJE class "Person" {)
- Unngå spesialteikn som æ, ø, å i klassenamn (bruk Laerar ikkje Lærar)
- Hermeteikn KUN i kardinalitet ("1", "*") og relasjonstekst
- Relasjonar: <|-- (arv), *-- (komposisjon), o-- (aggregering), --> (assosiasjon)
- Synlegheit: + public, - private, # protected`,
    },
    {
        id: 'sequence',
        label: 'Sekvens',
        description: 'Vis kommunikasjon og interaksjonar mellom system over tid',
        icon: <TbArrowsExchange />,
        prompt: `Lag eit Mermaid sekvensdiagram. VIKTIG: Skriv alltid på Nynorsk og start med "sequenceDiagram". Syntaks-døme:

sequenceDiagram
    participant A as Brukar
    participant B as System
    participant C as Database
    A->>B: Førespurnad
    B->>C: Hent data
    C-->>B: Resultat
    B-->>A: Svar

Piler: ->> (synkron), -->> (svar), -) (asynkron). Bruk norske (nynorsk) tekstar.`,
    },
    {
        id: 'stateDiagram',
        label: 'Tilstand',
        description: 'Vis ulike tilstandar og overgangar i eit system',
        icon: <TbCircleDot />,
        prompt: `Lag eit Mermaid tilstandsdiagram. VIKTIG: Skriv alltid på Nynorsk og start med "stateDiagram-v2" på første linje.

Korrekt syntaks:

stateDiagram-v2
    [*] --> Ventande
    Ventande --> Aktiv : start
    Aktiv --> Pausa : pause
    Pausa --> Aktiv : hald fram
    Aktiv --> Ferdig : fullfør
    Ferdig --> [*]

VIKTIG:
- [*] er start/slutt-tilstand
- Tilstandsnamn UTAN hermeteikn (skriv Ventande, ikkje "Ventande")
- Bruk : for å legge til tekst på pilar
- Kvar overgang på si eiga linje`,
    },
    // Row 2 - Project & planning
    {
        id: 'mindmap',
        label: 'Tankekart',
        description: 'Organiser idear og konsept hierarkisk rundt eit sentralt tema',
        icon: <TbBrain />,
        prompt: `Lag eit Mermaid tankekart. VIKTIG: Skriv alltid på Nynorsk og start med "mindmap". Bruk innrykk (4 mellomrom) for hierarki. Syntaks-døme:

mindmap
    root((Hovudtema))
        Emne 1
            Detalj A
            Detalj B
        Emne 2
            Detalj C
        Emne 3

Former: ((sirkel)), (avrunda), [firkant], ))sky((. Bruk norske (nynorsk) tekstar.`,
    },
    {
        id: 'architecture',
        label: 'Arkitektur',
        description: 'Vis systemkomponentar, tenester og infrastruktur',
        icon: <TbBuildingSkyscraper />,
        prompt: `Lag eit Mermaid arkitektur-diagram. Følg NØYAKTIG dette formatet:

architecture-beta
    group api(cloud)[API]
    service db(database)[Database] in api
    service disk1(disk)[Storage] in api
    service server(server)[Server] in api
    db:L -- R:server
    disk1:T -- B:server

KRITISK:
- 4 mellomrom innrykk på ALLE linjer etter architecture-beta
- Etiketter i [klammer] UTAN hermeteikn og UTAN bindestrekar
- Bruk enkle norske ord: [Lagring] ikkje [Fil-lagring]
- ID-ar: berre små bokstavar og tal (db, server1)
- Ikon: cloud, database, disk, internet, server
- Sider: L, R, T, B`,
    },
    {
        id: 'block',
        label: 'Blokk',
        description: 'Vis enkle blokkar og koplingane mellom dei',
        icon: <TbLayoutBoard />,
        prompt: `Lag eit Mermaid blokkdiagram. VIKTIG: Skriv alltid på Nynorsk og start med "block" (IKKJE "block-beta").

KORREKT SYNTAKS:

block
    columns 3
    a["Hovudblokk"]:3
    b["Venstre"] c["Midten"] d["Hogre"]
    space:3
    e["Botn"]:3
    b --> e
    d --> e

FORMER:
- id["Tekst"] - vanleg blokk
- id(("Tekst")) - sirkel
- id{{"Tekst"}} - heksagon (val)
- id[("Database")] - sylinder (database)

SYNTAKS:
- columns N - antal kolonnar
- id:N - blokk som spenner N kolonnar
- space eller space:N - tomrom
- id --> id - pil mellom blokkar
- style id fill:#696,stroke:#333 - styling`,
    },
    {
        id: 'kanban',
        label: 'Kanban',
        description: 'Vis oppgåvetavle med kolonnar og status',
        icon: <TbLayoutKanban />,
        prompt: `Lag eit Mermaid kanban-diagram. VIKTIG: Skriv alltid på Nynorsk og start med "kanban". KRITISK SYNTAKS:
- Kolonnar MÅ ha id og firkantparentes: col1[Kolonnetittel]
- Oppgåver MÅ ha ekstra innrykk under kolonnen: oppg1[Oppgåvetekst]

Korrekt syntaks-døme:

kanban
  todo[Å gjere]
    oppg1[Planlegg møte]
    oppg2[Skriv rapport]
  prog[I arbeid]
    oppg3[Utvikle funksjon]
  review[Til godkjenning]
    oppg4[Teste løysing]
  done[Ferdig]
    oppg5[Dokumentasjon]

FEIL: Kolonnenamn utan firkantparentes vil gi syntaksfeil!`,
    },
    {
        id: 'pie',
        label: 'Sektor',
        description: 'Vis fordeling og prosentdel av ein heilskap',
        icon: <TbChartPie />,
        prompt: `Lag eit Mermaid sektordiagram. VIKTIG: Skriv alltid på Nynorsk og start med "pie". Syntaks-døme:

pie showData
    title Budsjettfordeling
    "Lønn" : 45
    "Drift" : 25
    "Utvikling" : 20
    "Anna" : 10

showData viser prosent. Verdiane treng ikkje summere til 100 - dei blir rekna om. Bruk norske (nynorsk) tekstar.`,
    },
    {
        id: 'quadrant',
        label: 'Kvadrant',
        description: 'Plasser element i fire kategoriar for analyse og prioritering',
        icon: <TbLayoutGrid />,
        prompt: `Lag eit Mermaid kvadrantdiagram. VIKTIG: Skriv alltid på Nynorsk og start med "quadrantChart" på første linje. Syntaks-døme:

quadrantChart
    title Prioriteringsmatrise
    x-axis Liten innsats --> Stor innsats
    y-axis Liten verdi --> Stor verdi
    quadrant-1 Gjer fyrst
    quadrant-2 Planlegg
    quadrant-3 Deleger
    quadrant-4 Unnga
    ProsjektA: [0.3, 0.8]
    ProsjektB: [0.7, 0.9]
    ProsjektC: [0.2, 0.3]
    ProsjektD: [0.8, 0.2]

KRITISK SYNTAKS:
- Start med "quadrantChart" (med stor C)
- IKKJE bruk spesialteikn som ø, å, æ i akseetiketter og kvadrantnamn (bruk o for ø, a for å, ae for æ)
- Datapunkt-namn MÅ vere eitt ord UTAN mellomrom og kolon direkte etter (t.d. "ProsjektA:" ikkje "Prosjekt A:")
- Koordinatar [x, y] mellom 0 og 1
- quadrant-1 er oppe til høgre, quadrant-3 er nede til venstre
- Forklarande tekst med norske teikn kan brukast i beskrivinga utanfor diagrammet`,
    },
    // Row 4 - Advanced
    {
        id: 'radar',
        label: 'Radar',
        description: 'Vis fleire dimensjonar på ein radargraf (edderkoppnett)',
        icon: <TbChartRadar />,
        prompt: `Lag eit Mermaid radar-diagram. VIKTIG: Skriv alltid på Nynorsk og Start ALLTID med "radar-beta" på første linje. Syntaks-døme:

radar-beta
  title Kompetanseoversikt
  axis k["Kommunikasjon"], t["Teknisk"], l["Leiing"], s["Samarbeid"], p["Problemløysing"]
  curve tilsette["Tilsette"]{80,90,70,85,75}
  curve leiarar["Leiarar"]{70,85,80,90,80}
  max 100
  min 0
  showLegend true

VIKTIG: Ikkje bruk mellomrom i talverdiane i curve (skriv {80,90,70} ikkje {80, 90, 70}). Bruk norske (nynorsk) tekstar.`,
    },
    {
        id: 'timeline',
        label: 'Tidslinje',
        description: 'Vis hendingar kronologisk langs ein tidslinje',
        icon: <TbTimeline />,
        prompt: `Lag eit Mermaid tidslinjediagram. VIKTIG: Skriv alltid på Nynorsk og start med "timeline". Syntaks-døme:

timeline
    title Prosjekthistorikk
    section Fase 1
        2023 : Oppstart
             : Planlegging
    section Fase 2
        2024 : Utvikling
             : Testing
             : Lansering

Bruk section for grupperingar, kolon for hendingar. Bruk norske (nynorsk) tekstar.`,
    },
    {
        id: 'treemap',
        label: 'Trekart',
        description: 'Vis hierarkisk data som nestla rektangel',
        icon: <TbBinaryTree2 />,
        prompt: `Lag eit Mermaid treemap-diagram. VIKTIG: Skriv alltid på Nynorsk og start med "treemap-beta". Syntaks-døme:

treemap-beta
"Organisasjon"
    "Avdeling A"
        "Team 1": 30
        "Team 2": 20
    "Avdeling B"
        "Team 3": 25
        "Team 4": 15

KRITISK SYNTAKS:
- Start med "treemap-beta"
- ALLE node-namn MÅ ha hermeteikn: "Namn"
- Blad-nodar med verdi: "Namn": tal
- Bruk innrykk (mellomrom) for hierarki
- Ikkje bruk norske teikn (ø, å, æ) i namn`,
    },
    // Row 5 - User & data
    {
        id: 'journey',
        label: 'Brukarreise',
        description: 'Vis brukaroppleving gjennom ulike fasar med tilfredsheitsscore',
        icon: <TbWalk />,
        prompt: `Lag eit Mermaid brukarreise-diagram. VIKTIG: Skriv alltid på Nynorsk og start med "journey". Syntaks-døme:

journey
    title Søknadsprosessen
    section Førebuing
        Finn informasjon: 5: Brukar
        Last ned skjema: 4: Brukar
    section Utfylling
        Fyll ut skjema: 3: Brukar
        Last opp vedlegg: 2: Brukar
    section Innsending
        Send inn: 4: Brukar
        Få kvittering: 5: Brukar, System

Score 1-5 (1=dårleg, 5=bra). Fleire aktørar med komma.`,
    },
    {
        id: 'xy',
        label: 'XY-graf',
        description: 'Vis data i eit koordinatsystem med X- og Y-akse',
        icon: <TbChartLine />,
        prompt: `Lag eit Mermaid xychart-diagram. VIKTIG: Skriv alltid på Nynorsk og start med "xychart-beta". Syntaks-døme:

xychart-beta
    title "Salsutvikling 2024"
    x-axis [Jan, Feb, Mar, Apr, Mai, Jun]
    y-axis "Sal (tusen kr)" 0 --> 100
    bar [30, 45, 55, 60, 70, 80]
    line [25, 40, 50, 55, 65, 75]

bar = søylediagram, line = linjediagram. Kan ha begge. Bruk norske (nynorsk) tekstar.`,
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
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacingHorizontalXS,
                minWidth: 0,
                maxWidth: '100%',
                overflow: 'hidden',
            }}
        >
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
