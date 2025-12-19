import {
    Button,
    makeStyles,
    Popover,
    PopoverSurface,
    PopoverTrigger,
    shorthands,
    tokens,
    Tooltip,
} from '@fluentui/react-components';
import { DiagramRegular, DismissRegular } from '@fluentui/react-icons';
import React, { useState } from 'react';

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
        height: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '9px',
        fontFamily: 'monospace',
        color: tokens.colorNeutralForeground2,
        marginBottom: tokens.spacingVerticalXS,
        whiteSpace: 'pre',
        lineHeight: 1.1,
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
    preview: string;
    prompt: string;
}

export const DIAGRAM_TYPES: DiagramType[] = [
    // Row 1 - Basic diagrams
    {
        id: 'flowchart',
        label: 'Flytskjema',
        description: 'Vis prosessar, avgjersler og arbeidsflyt steg for steg',
        preview: '┌─┐→┌─┐\n└─┘→└─┘',
        prompt: 'Lag eit Mermaid flytskjema. Bruk tydelege norske (nynorsk) tekstar. Gjer det visuelt klart med riktig flytretning.',
    },
    {
        id: 'classDiagram',
        label: 'Klasse',
        description: 'Vis klassar, eigenskapar og relasjonar i objektorientert kode',
        preview: '┌───┐\n│ A │\n└───┘',
        prompt: 'Lag eit Mermaid klassediagram som viser klassar, eigenskapar, metodar og relasjonar.',
    },
    {
        id: 'sequence',
        label: 'Sekvens',
        description: 'Vis kommunikasjon og interaksjonar mellom system over tid',
        preview: '│ │\n│→│\n│←│',
        prompt: 'Lag eit Mermaid sekvensdiagram som viser interaksjonar mellom deltakarar. Bruk norske (nynorsk) tekstar.',
    },
    {
        id: 'erDiagram',
        label: 'ER-diagram',
        description: 'Vis databasetabellar og relasjonane mellom dei',
        preview: '┌─┐─┌─┐\n└─┘ └─┘',
        prompt: 'Lag eit Mermaid ER-diagram som viser databaseentitetar og relasjonane deira. Bruk norske (nynorsk) tekstar der det passar.',
    },
    {
        id: 'stateDiagram',
        label: 'Tilstand',
        description: 'Vis ulike tilstandar og overgangar i eit system',
        preview: '●→○\n  ↓\n  ◉',
        prompt: 'Lag eit Mermaid tilstandsdiagram som viser tilstandar og overgangar. Bruk norske (nynorsk) tekstar.',
    },
    // Row 2 - Project & planning
    {
        id: 'mindmap',
        label: 'Tankekart',
        description: 'Organiser idear og konsept hierarkisk rundt eit sentralt tema',
        preview: ' ┌─┐\n─┼─┼─\n └─┘',
        prompt: 'Lag eit Mermaid tankekart. Organiser ideane hierarkisk med eit sentralt konsept. Bruk norske (nynorsk) tekstar.',
    },
    {
        id: 'architecture',
        label: 'Arkitektur',
        description: 'Vis systemkomponentar, tenester og infrastruktur',
        preview: '┌─┐┌─┐\n│□││□│\n└─┘└─┘',
        prompt: 'Lag eit Mermaid arkitektur-/utrullingsdiagram som viser systemkomponentar og koplingane mellom dei. Bruk tydelege tekstar.',
    },
    {
        id: 'block',
        label: 'Blokk',
        description: 'Vis enkle blokkar og koplingane mellom dei',
        preview: '▢─▢\n│ │\n▢─▢',
        prompt: 'Lag eit Mermaid blokkdiagram som viser komponentar og koplingane mellom dei. Bruk norske (nynorsk) tekstar.',
    },
    {
        id: 'c4',
        label: 'C4',
        description: 'Vis programvarearkitektur med C4-modellen (Context, Container, Component)',
        preview: '┌───┐\n│C4 │\n└───┘',
        prompt: 'Lag eit Mermaid C4-diagram som viser programvarearkitektur. Bruk C4-modellen med tydelege norske (nynorsk) tekstar.',
    },
    {
        id: 'gantt',
        label: 'Gantt',
        description: 'Vis prosjektplan med oppgåver, tidslinje og avhengigheiter',
        preview: '▓▓░░░\n░▓▓░░\n░░▓▓▓',
        prompt: 'Lag eit Mermaid Gantt-diagram med oppgåver og tidslinje. Bruk norske (nynorsk) tekstar og realistiske tidsestimat.',
    },
    // Row 3 - Git & Dev
    {
        id: 'git',
        label: 'Git',
        description: 'Vis Git-greiner, commits og merge-historikk',
        preview: '●─●─●\n  ╲╱\n  ●',
        prompt: 'Lag eit Mermaid gitGraph-diagram som viser greiner, commits og merges. Bruk norske (nynorsk) tekstar for commit-meldingar.',
    },
    {
        id: 'kanban',
        label: 'Kanban',
        description: 'Vis oppgåvetavle med kolonnar og status',
        preview: '│T│D│F│\n│□│□│□│',
        prompt: 'Lag eit Mermaid kanban-diagram som viser oppgåver i ulike kolonnar (t.d. Å gjere, I arbeid, Ferdig). Bruk norske (nynorsk) tekstar.',
    },
    {
        id: 'packet',
        label: 'Pakke',
        description: 'Vis nettverkspakkar og protokollstruktur',
        preview: '┌┬┬┬┐\n│││││\n└┴┴┴┘',
        prompt: 'Lag eit Mermaid packet-diagram som viser pakkestruktur eller protokollformat. Bruk norske (nynorsk) tekstar.',
    },
    {
        id: 'pie',
        label: 'Sektor',
        description: 'Vis fordeling og prosentdel av ein heilskap',
        preview: ' ◔◔\n◕ ◕',
        prompt: 'Lag eit Mermaid sektordiagram som viser fordeling/statistikk. Bruk norske (nynorsk) tekstar og inkluder prosenttal.',
    },
    {
        id: 'quadrant',
        label: 'Kvadrant',
        description: 'Plasser element i fire kategoriar for analyse og prioritering',
        preview: '┌─┬─┐\n├─┼─┤\n└─┴─┘',
        prompt: 'Lag eit Mermaid kvadrantdiagram for analyse/prioritering. Bruk norske (nynorsk) tekstar for aksar og element.',
    },
    // Row 4 - Advanced
    {
        id: 'radar',
        label: 'Radar',
        description: 'Vis fleire dimensjonar på ein radargraf (edderkoppnett)',
        preview: ' /╲\n╱  ╲\n╲  ╱\n ╲╱',
        prompt: 'Lag eit Mermaid radar/spider-diagram som samanliknar fleire dimensjonar. Bruk norske (nynorsk) tekstar.',
    },
    {
        id: 'requirement',
        label: 'Krav',
        description: 'Vis systemkrav og avhengigheiter mellom dei',
        preview: '┌R┐→┌R┐\n└─┘ └─┘',
        prompt: 'Lag eit Mermaid requirement-diagram som viser krav og relasjonane mellom dei. Bruk norske (nynorsk) tekstar.',
    },
    {
        id: 'sankey',
        label: 'Sankey',
        description: 'Vis flyt og mengde mellom kategoriar',
        preview: '═══╗\n   ║\n═══╝',
        prompt: 'Lag eit Mermaid sankey-diagram som viser flyt/mengde mellom kategoriar. Bruk norske (nynorsk) tekstar.',
    },
    {
        id: 'timeline',
        label: 'Tidslinje',
        description: 'Vis hendingar kronologisk langs ein tidslinje',
        preview: '●──●──●',
        prompt: 'Lag eit Mermaid tidslinjediagram som viser hendingar kronologisk. Bruk norske (nynorsk) tekstar.',
    },
    {
        id: 'treemap',
        label: 'Trekart',
        description: 'Vis hierarkisk data som nestla rektangel',
        preview: '┌─┬──┐\n├─┼─┬┤\n└─┴─┴┘',
        prompt: 'Lag eit Mermaid treemap-diagram som viser hierarkisk data. Bruk norske (nynorsk) tekstar.',
    },
    // Row 5 - User & data
    {
        id: 'journey',
        label: 'Brukarreise',
        description: 'Vis brukaroppleving gjennom ulike fasar med tilfredsheitsscore',
        preview: '😐→😊→😃',
        prompt: 'Lag eit Mermaid brukarreise-diagram som viser brukaropplevinga gjennom ulike fasar. Bruk norske (nynorsk) tekstar og inkluder tilfredsheitsscore.',
    },
    {
        id: 'xy',
        label: 'XY-graf',
        description: 'Vis data i eit koordinatsystem med X- og Y-akse',
        preview: '│ ╱\n│╱\n└──',
        prompt: 'Lag eit Mermaid xychart-diagram som viser data i eit koordinatsystem. Bruk norske (nynorsk) tekstar.',
    },
    {
        id: 'zenuml',
        label: 'ZenUML',
        description: 'Vis sekvensdiagram med ZenUML-syntaks',
        preview: 'A→B\nB→C',
        prompt: 'Lag eit Mermaid zenuml-diagram (sekvensdiagram med ZenUML-syntaks). Bruk norske (nynorsk) tekstar.',
    },
];

export interface DiagramTypeSelectorProps {
    selectedType: DiagramType | null;
    onSelectType: (type: DiagramType | null) => void;
    disabled?: boolean;
}

export const DiagramTypeSelector: React.FC<DiagramTypeSelectorProps> = ({
    selectedType,
    onSelectType,
    disabled,
}) => {
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
            <Popover open={isOpen} onOpenChange={(_, data) => { setIsOpen(data.open); }} positioning="above-start">
                <PopoverTrigger disableButtonEnhancement>
                    <Tooltip content="Vel diagramtype" relationship="label">
                        <Button
                            appearance={selectedType ? 'primary' : 'transparent'}
                            icon={<DiagramRegular />}
                            disabled={disabled}
                            className={selectedType ? classes.selectedButton : classes.triggerButton}
                            aria-label="Vel diagramtype"
                        />
                    </Tooltip>
                </PopoverTrigger>
                <PopoverSurface className={classes.surface}>
                    <div className={classes.header}>
                        <h3 className={classes.title}>📊 Vel diagramtype</h3>
                    </div>
                    <p className={classes.subtitle}>
                        Vel ein type for å få betre resultat når du ber om diagram
                    </p>
                    <div className={classes.grid}>
                        {DIAGRAM_TYPES.map((type) => (
                            <Tooltip key={type.id} content={type.description} relationship="description" positioning="above">
                                <div
                                    className={`${classes.diagramOption} ${
                                        selectedType?.id === type.id ? classes.diagramOptionSelected : ''
                                    }`}
                                    onClick={() => { handleSelect(type); }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            handleSelect(type);
                                        }
                                    }}
                                >
                                    <div className={classes.preview}>{type.preview}</div>
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
