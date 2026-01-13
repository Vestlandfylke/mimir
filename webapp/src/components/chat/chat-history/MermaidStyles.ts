// Copyright (c) Microsoft. All rights reserved.
// Shared Mermaid diagram styles and Vestland brand colors
// Used by both MermaidBlock.tsx (chat view) and MermaidEditorModal.tsx (editor)

import { tokens } from '@fluentui/react-components';

// =============================================================================
// VESTLAND BRAND COLORS
// =============================================================================
// Official Vestland fylkeskommune color palette
// Colors that require WHITE text: Teal, Orange, Orange-red, Sage, Mint
// Colors that require BLACK text: Light cyan, Purple, Pink, Yellow, etc.

export const VESTLAND_COLORS = [
    '#9ADBE8', // 0 - Light cyan (black text)
    '#CAA2DD', // 1 - Light purple (black text)
    '#E06287', // 2 - Pink (black text)
    '#E1D555', // 3 - Yellow (black text)
    '#00C7B1', // 4 - Teal (white text)
    '#FDDA25', // 5 - Bright yellow (black text)
    '#FF9E1B', // 6 - Orange (white text)
    '#FF5C39', // 7 - Orange-red (white text)
    '#F8B5C4', // 8 - Light pink (black text)
    '#B7DD79', // 9 - Light green (black text)
    '#50A684', // 10 - Sage green (white text)
    '#3CDBC0', // 11 - Mint (white text)
];

// Text colors
export const LIGHT_TEXT = '#ffffff';
export const DARK_TEXT = '#333333';

// Background colors
export const LIGHT_BACKGROUND = '#ffffff';
export const DARK_BACKGROUND = '#1f1f1f';

// Border and line colors
export const BORDER_LIGHT = '#666666';
export const BORDER_DARK = '#888888';
export const GRID_LINE_LIGHT = '#cccccc';
export const GRID_LINE_DARK = '#444444';
export const CLUSTER_BG_DARK = '#2a2a2a';
export const CLUSTER_BG_LIGHT = '#f5f5f5';

// Colors that require white text (dark backgrounds)
export const WHITE_TEXT_COLORS = new Set([
    '#00C7B1', // Teal
    '#FF9E1B', // Orange
    '#FF5C39', // Orange-red
    '#50A684', // Sage
    '#3CDBC0', // Mint
]);

// =============================================================================
// XY CHART CONFIGURATION
// =============================================================================
// XY Chart colors must be set in config, not themeVariables

export const getXYChartConfig = (isDark = false) => ({
    titleColor: isDark ? LIGHT_TEXT : DARK_TEXT,
    xAxisLabelColor: isDark ? LIGHT_TEXT : DARK_TEXT,
    xAxisTitleColor: isDark ? LIGHT_TEXT : DARK_TEXT,
    xAxisTickColor: isDark ? LIGHT_TEXT : DARK_TEXT,
    xAxisLineColor: isDark ? GRID_LINE_DARK : GRID_LINE_LIGHT,
    yAxisLabelColor: isDark ? LIGHT_TEXT : DARK_TEXT,
    yAxisTitleColor: isDark ? LIGHT_TEXT : DARK_TEXT,
    yAxisTickColor: isDark ? LIGHT_TEXT : DARK_TEXT,
    yAxisLineColor: isDark ? GRID_LINE_DARK : GRID_LINE_LIGHT,
    plotColorPalette: VESTLAND_COLORS.join(','),
});

// =============================================================================
// THEME VARIABLES BUILDER
// =============================================================================
// Builds Mermaid theme variables for different modes

export const buildVestlandThemeVariables = (isDark = false) => {
    const containerTextColor = isDark ? LIGHT_TEXT : DARK_TEXT;
    const containerBgColor = isDark ? '#1f1f1f' : '#ffffff';

    const themeVariables: Record<string, string> = {
        // Primary colors - Light cyan with dark text
        primaryColor: VESTLAND_COLORS[0],
        primaryTextColor: DARK_TEXT,
        primaryBorderColor: '#7ac5d4',
        // Secondary colors - Light purple with dark text
        secondaryColor: VESTLAND_COLORS[1],
        secondaryTextColor: DARK_TEXT,
        secondaryBorderColor: '#b88fc8',
        // Tertiary colors - Light pink with dark text
        tertiaryColor: VESTLAND_COLORS[8],
        tertiaryTextColor: DARK_TEXT,
        tertiaryBorderColor: '#e89aaf',

        // Background colors
        background: containerBgColor,
        mainBkg: containerBgColor,
        lineColor: isDark ? '#888888' : '#444444',
        textColor: containerTextColor,
        titleColor: containerTextColor,

        // === PIE CHART ===
        pieTitleTextColor: containerTextColor,
        pieLegendTextColor: containerTextColor,
        pieSectionTextColor: DARK_TEXT,
        pieStrokeColor: isDark ? '#333333' : '#ffffff',
        pieStrokeWidth: '2px',
        pieOuterStrokeWidth: '2px',

        // === FLOWCHART ===
        nodeBorder: isDark ? '#888888' : '#666666',
        nodeTextColor: DARK_TEXT,
        clusterBkg: isDark ? '#2a2a2a' : '#f5f5f5',
        clusterBorder: isDark ? '#666666' : '#999999',
        defaultLinkColor: isDark ? '#888888' : '#666666',
        edgeLabelBackground: containerBgColor,

        // === SEQUENCE DIAGRAM ===
        actorTextColor: LIGHT_TEXT,
        actorBorder: isDark ? '#888888' : '#666666',
        actorBkg: VESTLAND_COLORS[4],
        signalTextColor: containerTextColor,
        signalColor: isDark ? '#888888' : '#666666',
        activationBkgColor: VESTLAND_COLORS[0],
        activationBorderColor: '#7ac5d4',

        // === GANTT ===
        sectionBkgColor: VESTLAND_COLORS[0],
        sectionBkgColor2: VESTLAND_COLORS[1],
        taskTextColor: LIGHT_TEXT,
        taskTextOutsideColor: containerTextColor,
        taskTextDarkColor: LIGHT_TEXT,
        taskTextLightColor: DARK_TEXT,
        taskBkgColor: VESTLAND_COLORS[4],
        activeTaskBkgColor: VESTLAND_COLORS[7],
        doneTaskBkgColor: VESTLAND_COLORS[10],
        critBkgColor: VESTLAND_COLORS[11],
        gridColor: isDark ? '#444444' : '#cccccc',
        todayLineColor: isDark ? '#ff6666' : '#cc0000',

        // === QUADRANT CHART ===
        quadrant1Fill: VESTLAND_COLORS[4],
        quadrant2Fill: VESTLAND_COLORS[10],
        quadrant3Fill: VESTLAND_COLORS[0],
        quadrant4Fill: VESTLAND_COLORS[1],
        quadrant1TextFill: LIGHT_TEXT,
        quadrant2TextFill: LIGHT_TEXT,
        quadrant3TextFill: DARK_TEXT,
        quadrant4TextFill: DARK_TEXT,
        quadrantPointFill: VESTLAND_COLORS[7],
        quadrantPointTextFill: LIGHT_TEXT,
        quadrantTitleFill: containerTextColor,
        quadrantXAxisTextFill: containerTextColor,
        quadrantYAxisTextFill: containerTextColor,

        // === TIMELINE ===
        cScale0: VESTLAND_COLORS[4],
        cScale1: VESTLAND_COLORS[7],
        cScale2: VESTLAND_COLORS[10],
        cScale3: VESTLAND_COLORS[6],
        cScale4: VESTLAND_COLORS[11],
        cScaleLabel0: DARK_TEXT,
        cScaleLabel1: DARK_TEXT,
        cScaleLabel2: DARK_TEXT,
        cScaleLabel3: DARK_TEXT,
        cScaleLabel4: DARK_TEXT,

        // === MINDMAP ===
        mindmapRootColor: VESTLAND_COLORS[0],
        mindmapRootTextColor: DARK_TEXT,
        mindmapRootBorderColor: '#7ac5d4',
        mindmapNode1Color: VESTLAND_COLORS[4],
        mindmapNode1TextColor: LIGHT_TEXT,
        mindmapNode1BgColor: VESTLAND_COLORS[4],
        mindmapNode2Color: VESTLAND_COLORS[10],
        mindmapNode2TextColor: LIGHT_TEXT,
        mindmapNode2BgColor: VESTLAND_COLORS[10],
        mindmapNode3Color: VESTLAND_COLORS[6],
        mindmapNode3TextColor: LIGHT_TEXT,
        mindmapNode3BgColor: VESTLAND_COLORS[6],

        // === CLASS DIAGRAM ===
        classText: DARK_TEXT,
        // nodeBkg is set via primaryColor above

        // === STATE DIAGRAM ===
        stateBkg: VESTLAND_COLORS[0],
        stateLabelColor: DARK_TEXT,
        compositeBackground: isDark ? '#2a2a2a' : '#f5f5f5',
        compositeBorder: isDark ? '#888888' : '#666666',
        compositeTitleBackground: VESTLAND_COLORS[0],
        stateBorder: isDark ? '#888888' : '#666666',
        innerEndBackground: VESTLAND_COLORS[4],
        specialStateColor: containerTextColor,
        labelColor: containerTextColor,
        altBackground: isDark ? '#2a2a2a' : '#f5f5f5',
        transitionColor: isDark ? '#888888' : '#666666',
        transitionLabelColor: containerTextColor,

        // === ER DIAGRAM ===
        attributeBackgroundColorOdd: isDark ? '#2a2a2a' : '#f5f5f5',
        attributeBackgroundColorEven: isDark ? '#1f1f1f' : '#ffffff',

        // === JOURNEY ===
        fillType0: VESTLAND_COLORS[4],
        fillType1: VESTLAND_COLORS[7],
        fillType2: VESTLAND_COLORS[10],
        fillType3: VESTLAND_COLORS[6],
        fillType4: VESTLAND_COLORS[11],

        // General labels
        labelTextColor: containerTextColor,
        loopTextColor: containerTextColor,
        noteBkgColor: VESTLAND_COLORS[3],
        noteTextColor: DARK_TEXT,
        noteBorderColor: '#c8c040',
    };

    // Add pie chart colors
    VESTLAND_COLORS.forEach((color, i) => {
        themeVariables[`pie${i + 1}`] = color;
    });

    return themeVariables;
};

// =============================================================================
// CSS STYLE OBJECTS
// =============================================================================
// Reusable CSS-in-JS styles for Mermaid diagrams

// Base diagram colors - applies to all modes (forces light backgrounds with dark text)
export const diagramBaseStyles = {
    // === FLOWCHART - Vestland colors ===
    '& svg .node rect': {
        fill: '#9ADBE8 !important', // Light cyan
    },
    '& svg .node polygon': {
        fill: '#CAA2DD !important', // Light purple for decision nodes
    },
    '& svg .node circle': {
        fill: '#9ADBE8 !important',
    },
    '& svg .node .label-container': {
        fill: '#9ADBE8 !important',
    },
    '& svg .label-container': {
        fill: '#9ADBE8 !important',
    },
    // Flowchart node text - always dark on light backgrounds
    '& svg .node text': {
        fill: '#333333 !important',
    },
    '& svg .node .label text': {
        fill: '#333333 !important',
    },
    '& svg .nodeLabel': {
        fill: '#333333 !important',
        color: '#333333 !important',
    },
    '& svg .node foreignObject div': {
        color: '#333333 !important',
    },
    '& svg .flowchart-label text': {
        fill: '#333333 !important',
    },
    '& svg .label-container text': {
        fill: '#333333 !important',
    },

    // === CLASS DIAGRAM - Vestland colors ===
    // Class boxes use PATH elements (not rect!) - light cyan background
    '& svg g[id^="classId"] path': {
        fill: '#9ADBE8 !important',
        stroke: '#666666 !important',
    },
    '& svg g[id^="classId-"] path': {
        fill: '#9ADBE8 !important',
        stroke: '#666666 !important',
    },
    '& svg .node.default path': {
        fill: '#9ADBE8 !important',
        stroke: '#666666 !important',
    },
    // Also keep rect rules for older Mermaid versions
    '& svg .classGroup rect': {
        fill: '#9ADBE8 !important',
        stroke: '#666666 !important',
    },
    '& svg g.classGroup rect': {
        fill: '#9ADBE8 !important',
        stroke: '#666666 !important',
    },
    '& svg .classGroup rect.classTitle': {
        fill: '#CAA2DD !important', // Light purple for title
    },
    '& svg [id*="classId"] rect': {
        fill: '#9ADBE8 !important',
        stroke: '#666666 !important',
    },
    '& svg g[class*="classGroup"] rect': {
        fill: '#9ADBE8 !important',
        stroke: '#666666 !important',
    },
    '& svg .classDiagram rect': {
        fill: '#9ADBE8 !important',
    },
    '& svg rect.classBox': {
        fill: '#9ADBE8 !important',
    },
    // Target rect elements by id pattern (Mermaid uses classId-X)
    '& svg [id^="classId"] rect': {
        fill: '#9ADBE8 !important',
        stroke: '#666666 !important',
    },
    '& svg g[id^="classId"] rect': {
        fill: '#9ADBE8 !important',
        stroke: '#666666 !important',
    },
    // Target all rect inside nodes that look like class boxes
    '& svg g[class*="node"] rect': {
        fill: '#9ADBE8 !important',
    },
    // Class box divider lines
    '& svg .classGroup line': {
        stroke: '#666666 !important',
    },
    '& svg .classGroup .divider': {
        stroke: '#666666 !important',
    },
    '& svg line.divider': {
        stroke: '#666666 !important',
    },
    '& svg g[id^="classId"] line': {
        stroke: '#666666 !important',
    },
    // Class box text - MUST be dark on light backgrounds
    // The most important selectors for modern Mermaid class diagrams
    '& svg g[id^="classId-"] text': {
        fill: '#333333 !important',
    },
    '& svg g[id^="classId-"] tspan': {
        fill: '#333333 !important',
    },
    '& svg .node.default text': {
        fill: '#333333 !important',
    },
    '& svg .node.default tspan': {
        fill: '#333333 !important',
    },
    // Label groups inside class nodes
    '& svg .label-group text': {
        fill: '#333333 !important',
    },
    '& svg .members-group text': {
        fill: '#333333 !important',
    },
    '& svg .methods-group text': {
        fill: '#333333 !important',
    },
    // Using very specific selectors to ensure they're not overridden
    '& svg .classGroup text': {
        fill: '#333333 !important',
    },
    '& svg .classLabel text': {
        fill: '#333333 !important',
    },
    '& svg .classLabel .box': {
        fill: '#9ADBE8 !important',
    },
    '& svg .classTitleText': {
        fill: '#333333 !important',
    },
    '& svg .classText': {
        fill: '#333333 !important',
    },
    '& svg g.classGroup text': {
        fill: '#333333 !important',
    },
    '& svg tspan.classTitle': {
        fill: '#333333 !important',
    },
    '& svg g[class*="classGroup"] text': {
        fill: '#333333 !important',
    },
    '& svg .classLabel tspan': {
        fill: '#333333 !important',
    },
    // Target text by id pattern
    '& svg g[id^="classId"] text': {
        fill: '#333333 !important',
    },
    '& svg g[id^="classId"] tspan': {
        fill: '#333333 !important',
    },
    // Additional class diagram text selectors for node content
    '& svg g.classGroup .classText': {
        fill: '#333333 !important',
    },
    '& svg g.classGroup tspan': {
        fill: '#333333 !important',
    },
    '& svg .classGroup foreignObject': {
        color: '#333333 !important',
    },
    '& svg .classGroup foreignObject div': {
        color: '#333333 !important',
    },
    // Force all text in nodes with class-like IDs to be dark
    '& svg [id*="class"] text': {
        fill: '#333333 !important',
    },
    '& svg [id*="class"] tspan': {
        fill: '#333333 !important',
    },

    // === SEQUENCE DIAGRAM - Vestland colors ===
    // Actor boxes - teal background with white text
    '& svg .actor': {
        fill: '#00C7B1 !important', // Teal
        stroke: '#666666 !important',
    },
    '& svg .actor-line': {
        stroke: '#666666 !important',
    },
    '& svg .actor text': {
        fill: '#ffffff !important', // White on teal
    },
    '& svg .actor-man circle': {
        fill: '#00C7B1 !important',
        stroke: '#666666 !important',
    },
    '& svg .actor-man line': {
        stroke: '#666666 !important',
    },
    // Activation boxes - light cyan with dark text
    '& svg .activation0, & svg .activation1, & svg .activation2': {
        fill: '#9ADBE8 !important',
        stroke: '#666666 !important',
    },
    // Notes - yellow with dark text
    '& svg .note': {
        fill: '#E1D555 !important',
        stroke: '#c8c040 !important',
    },
    '& svg .note text, & svg .note tspan': {
        fill: '#333333 !important',
    },
    // Loop boxes
    '& svg .loopLine': {
        stroke: '#666666 !important',
    },
    '& svg .loopText, & svg .loopText tspan': {
        fill: '#333333 !important',
    },
    '& svg .labelBox': {
        fill: '#9ADBE8 !important',
        stroke: '#666666 !important',
    },
    '& svg .labelText, & svg .labelText tspan': {
        fill: '#333333 !important',
    },

    // === STATE DIAGRAM - Vestland colors ===
    '& svg .stateGroup rect': {
        fill: '#9ADBE8 !important',
    },
    '& svg .stateGroup text': {
        fill: '#333333 !important',
    },
    '& svg .stateLabel text': {
        fill: '#333333 !important',
    },
    '& svg .state-note rect': {
        fill: '#E1D555 !important', // Yellow for notes
    },
    '& svg .state-note text': {
        fill: '#333333 !important',
    },
    '& svg .statediagram-state rect': {
        fill: '#9ADBE8 !important',
    },
    '& svg .statediagram-state text': {
        fill: '#333333 !important',
    },

    // === ER DIAGRAM - Vestland colors ===
    '& svg .er.entityBox': {
        fill: '#9ADBE8 !important',
        stroke: '#666666 !important',
    },
    '& svg .er.entityLabel': {
        fill: '#333333 !important',
    },
    '& svg .er.attributeBoxOdd': {
        fill: '#f5f5f5 !important',
    },
    '& svg .er.attributeBoxEven': {
        fill: '#ffffff !important',
    },
};

// Dark mode specific styles - for elements on dark container backgrounds
export const diagramDarkModeStyles = {
    // Edge labels on dark container (flowchart arrows)
    '& svg .edgeLabel text': {
        fill: '#ffffff !important',
    },
    '& svg .edgeLabel span': {
        color: '#ffffff !important',
    },
    '& svg .edgeLabel foreignObject div': {
        color: '#ffffff !important',
    },
    // Cluster labels
    '& svg .cluster rect': {
        fill: '#2a2a2a !important',
        stroke: '#666666 !important',
    },
    '& svg .cluster-label text': {
        fill: '#ffffff !important',
    },

    // === CLASS DIAGRAM - Dark mode relationship labels ===
    // Relationship/association lines
    '& svg .relation': {
        stroke: '#888888 !important',
    },
    '& svg path.relation': {
        stroke: '#888888 !important',
    },
    // Cardinality text (1, *, etc.)
    '& svg .cardinality': {
        fill: '#ffffff !important',
    },
    '& svg .cardinality text': {
        fill: '#ffffff !important',
    },
    '& svg text.cardinality': {
        fill: '#ffffff !important',
    },
    // Relationship labels ("melder seg på", "underviser", etc.)
    '& svg .relationshipLabel': {
        fill: '#ffffff !important',
    },
    '& svg .relationshipLabel text': {
        fill: '#ffffff !important',
    },
    '& svg .relationshipLabel tspan': {
        fill: '#ffffff !important',
    },
    '& svg .relationshipLabelBox': {
        fill: 'transparent !important',
    },
    '& svg text.relationshipLabel': {
        fill: '#ffffff !important',
    },
    // Labels that are NOT inside classGroup (relationship labels on dark bg)
    '& svg g:not(.classGroup) > .label text': {
        fill: '#ffffff !important',
    },
    '& svg g:not(.classGroup) > text.label': {
        fill: '#ffffff !important',
    },
    // Text directly in SVG that's for relationship labels
    '& svg > g:not(.classGroup) > text': {
        fill: '#ffffff !important',
    },

    // === SEQUENCE DIAGRAM - Dark mode ===
    // Message text on dark background
    '& svg .messageText': {
        fill: '#ffffff !important',
    },
    '& svg text.messageText': {
        fill: '#ffffff !important',
    },
    '& svg .sequenceNumber': {
        fill: '#ffffff !important',
    },
    // Signal lines
    '& svg .messageLine0, & svg .messageLine1': {
        stroke: '#888888 !important',
    },

    // === MINDMAP - Dark backgrounds need white text ===
    '& svg .mindmap-node text': {
        fill: '#ffffff !important',
    },
    '& svg .mindmap-node .nodeLabel': {
        fill: '#ffffff !important',
        color: '#ffffff !important',
    },
    // Root node has light background
    '& svg .mindmap-node.section-0 text': {
        fill: '#333333 !important',
    },

    // === PIE CHART ===
    '& svg .pieCircle + text': {
        fill: '#333333 !important',
    },
    '& svg .slice text': {
        fill: '#333333 !important',
    },

    // === GANTT ===
    '& svg .task text': {
        fill: '#ffffff !important',
    },
    '& svg .taskText': {
        fill: '#ffffff !important',
    },
    '& svg .sectionTitle': {
        fill: '#333333 !important',
    },

    // === TIMELINE ===
    '& svg .section text': {
        fill: '#333333 !important',
    },
    '& svg .time-period text': {
        fill: '#333333 !important',
    },
};

// Light mode specific styles - for elements on light container backgrounds
export const diagramLightModeStyles = {
    // Edge labels on light container
    '& svg .edgeLabel text': {
        fill: '#333333 !important',
    },
    '& svg .edgeLabel span': {
        color: '#333333 !important',
    },
    '& svg .edgeLabel foreignObject div': {
        color: '#333333 !important',
    },
    // Cluster labels
    '& svg .cluster-label text': {
        fill: '#333333 !important',
    },
};

// =============================================================================
// MAKECLASS STYLE GENERATORS
// =============================================================================
// Functions to generate makeStyles-compatible style objects

export const getScrollStyles = () => ({
    maxWidth: '100%',
    overflowX: 'auto' as const,
    overflowY: 'hidden' as const,
    WebkitOverflowScrolling: 'touch' as const,
    paddingBottom: tokens.spacingVerticalXXL,
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
    '& svg': {
        width: '100%',
        height: 'auto',
        maxWidth: '100%',
        overflow: 'visible',
        display: 'block',
    },
    ...diagramBaseStyles,
});

export const getPreviewSvgStyles = () => ({
    transformOrigin: 'center center',
    transition: 'none',
    userSelect: 'none' as const,
    pointerEvents: 'none' as const,
    '& svg': {
        maxWidth: 'none',
        height: 'auto',
    },
    ...diagramBaseStyles,
});

export const getDarkModeOverrides = () => ({
    ...diagramDarkModeStyles,
    // Re-apply base styles to override dark mode defaults
    ...diagramBaseStyles,
});

export const getLightModeOverrides = () => ({
    ...diagramLightModeStyles,
});
