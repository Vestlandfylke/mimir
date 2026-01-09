import {
    Button,
    Menu,
    MenuItem,
    MenuList,
    MenuPopover,
    MenuTrigger,
    Spinner,
    Tooltip,
    makeStyles,
    shorthands,
    tokens,
} from '@fluentui/react-components';
import { ArrowDownload20Regular, ChevronDown16Regular } from '@fluentui/react-icons';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';

type MermaidSecurityLevel = 'strict' | 'loose' | 'antiscript';
type MermaidTheme = 'default' | 'forest' | 'dark' | 'neutral' | 'base';
interface MermaidConfig {
    startOnLoad?: boolean;
    securityLevel?: MermaidSecurityLevel;
    theme?: MermaidTheme;
    themeVariables?: Record<string, string>;
    flowchart?: {
        nodeSpacing?: number;
        rankSpacing?: number;
        curve?: string;
        padding?: number;
        htmlLabels?: boolean;
    };
    state?: {
        nodeSpacing?: number;
        rankSpacing?: number;
    };
    sequence?: {
        boxMargin?: number;
        noteMargin?: number;
        messageMargin?: number;
    };
}
interface MermaidAPI {
    initialize: (config: MermaidConfig) => void;
    render: (id: string, text: string) => Promise<{ svg: string }>;
}

// Vestland fylkeskommune official brand colors (PMS) - ordered as per brand guidelines
const VESTLAND_COLORS = [
    '#9ADBE8', // 0: Light cyan - PMS 304 C
    '#CAA2DD', // 1: Light purple - PMS 529 C
    '#E06287', // 2: Pink/coral - PMS 7423 C
    '#E1D555', // 3: Yellow - PMS 610 C
    '#00C7B1', // 4: Teal - PMS 3265 C
    '#FDDA25', // 5: Bright yellow - PMS 115 C
    '#FF9E1B', // 6: Orange - PMS 1375 C
    '#FF5C39', // 7: Orange/red - PMS 171 C
    '#F8B5C4', // 8: Light pink - PMS 707 C
    '#B7DD79', // 9: Light green - PMS 366 C
    '#50A684', // 10: Sage green - PMS 7723 C
    '#3CDBC0', // 11: Mint/aqua - PMS 333 C
];

// Color classification for contrast:
// Light colors (use dark text): 0, 1, 3, 5, 8, 9, 11 (cyan, purple, yellow, bright yellow, light pink, light green, mint)
// Dark colors (use white text): 2, 4, 6, 7, 10 (pink, teal, orange, orange/red, sage)

// Text colors for contrast
const DARK_TEXT = '#333333';
const LIGHT_TEXT = '#ffffff';

// Build theme variables for pie charts, flowcharts, etc.
const buildVestlandThemeVariables = () => {
    const themeVariables: Record<string, string> = {
        // Primary colors - Light cyan with dark text (for state diagrams, flowcharts)
        primaryColor: VESTLAND_COLORS[0], // Light cyan
        primaryTextColor: DARK_TEXT, // Dark text for readability
        primaryBorderColor: '#7ac5d4',
        // Secondary colors - Light purple with dark text
        secondaryColor: VESTLAND_COLORS[1], // Light purple
        secondaryTextColor: DARK_TEXT,
        secondaryBorderColor: '#a889c0',
        // Tertiary colors - Light pink with dark text
        tertiaryColor: VESTLAND_COLORS[8], // Light pink
        tertiaryTextColor: DARK_TEXT,
        tertiaryBorderColor: '#d89aab',
        // Background
        background: '#ffffff',
        mainBkg: '#ffffff',
        // Line colors
        lineColor: '#444444',
        // Text colors - for general text elements
        textColor: DARK_TEXT,
        titleColor: DARK_TEXT,

        // === PIE CHART ===
        // Note: Mermaid doesn't support per-slice text colors, so we use dark text
        // which works better with most of our light colors
        pieTitleTextColor: DARK_TEXT,
        pieLegendTextColor: DARK_TEXT,
        pieSectionTextColor: DARK_TEXT, // Dark text works on most Vestland colors
        pieStrokeColor: '#ffffff',
        pieStrokeWidth: '2px',
        pieOuterStrokeWidth: '2px',

        // === FLOWCHART ===
        nodeBorder: '#666666',
        nodeTextColor: DARK_TEXT, // Dark text for readability on light node backgrounds
        clusterBkg: '#f5f5f5',
        clusterBorder: '#999999',
        defaultLinkColor: '#666666',
        edgeLabelBackground: '#ffffff',

        // === SEQUENCE DIAGRAM ===
        actorTextColor: LIGHT_TEXT, // Teal background (dark)
        actorBorder: '#666666',
        actorBkg: VESTLAND_COLORS[4], // Teal (dark)
        signalTextColor: DARK_TEXT,
        signalColor: '#666666',
        activationBkgColor: VESTLAND_COLORS[0], // Light cyan
        activationBorderColor: '#7ac5d4',

        // === GANTT ===
        sectionBkgColor: VESTLAND_COLORS[0], // Light cyan
        sectionBkgColor2: VESTLAND_COLORS[1], // Light purple
        taskTextColor: LIGHT_TEXT, // Teal background (dark)
        taskTextOutsideColor: DARK_TEXT,
        taskTextDarkColor: LIGHT_TEXT,
        taskTextLightColor: DARK_TEXT,
        taskBkgColor: VESTLAND_COLORS[4], // Teal (dark)
        activeTaskBkgColor: VESTLAND_COLORS[7], // Orange/red (dark)
        doneTaskBkgColor: VESTLAND_COLORS[10], // Sage (dark)
        critBkgColor: VESTLAND_COLORS[2], // Pink (dark)

        // === QUADRANT CHART ===
        quadrant1Fill: VESTLAND_COLORS[4], // Teal (dark) - top right
        quadrant2Fill: VESTLAND_COLORS[10], // Sage (dark) - top left
        quadrant3Fill: VESTLAND_COLORS[0], // Light cyan - bottom left
        quadrant4Fill: VESTLAND_COLORS[1], // Light purple - bottom right
        quadrant1TextFill: LIGHT_TEXT, // White on teal
        quadrant2TextFill: LIGHT_TEXT, // White on sage
        quadrant3TextFill: DARK_TEXT, // Dark on light cyan
        quadrant4TextFill: DARK_TEXT, // Dark on light purple
        quadrantPointFill: VESTLAND_COLORS[7], // Orange/red for points
        quadrantPointTextFill: LIGHT_TEXT,
        quadrantTitleFill: DARK_TEXT,
        quadrantXAxisTextFill: DARK_TEXT,
        quadrantYAxisTextFill: DARK_TEXT,

        // === TIMELINE ===
        // Use darker colors for better text contrast
        cScale0: VESTLAND_COLORS[4], // Teal (dark)
        cScale1: VESTLAND_COLORS[2], // Pink (dark)
        cScale2: VESTLAND_COLORS[7], // Orange/red (dark)
        cScale3: VESTLAND_COLORS[10], // Sage (dark)
        cScale4: VESTLAND_COLORS[6], // Orange (dark)
        cScaleLabel0: LIGHT_TEXT,
        cScaleLabel1: LIGHT_TEXT,
        cScaleLabel2: LIGHT_TEXT,
        cScaleLabel3: LIGHT_TEXT,
        cScaleLabel4: LIGHT_TEXT,

        // === MINDMAP ===
        // Root node (center) - use light color with dark text
        mindmapRootColor: VESTLAND_COLORS[0], // Light cyan for root
        mindmapRootTextColor: DARK_TEXT,
        mindmapRootBorderColor: '#7ac5d4',
        // Level 1 nodes
        mindmapNode1Color: VESTLAND_COLORS[4], // Teal (dark)
        mindmapNode1TextColor: LIGHT_TEXT,
        mindmapNode1BgColor: VESTLAND_COLORS[4],
        // Level 2 nodes
        mindmapNode2Color: VESTLAND_COLORS[2], // Pink (dark)
        mindmapNode2TextColor: LIGHT_TEXT,
        mindmapNode2BgColor: VESTLAND_COLORS[2],
        // Level 3 nodes
        mindmapNode3Color: VESTLAND_COLORS[6], // Orange (dark)
        mindmapNode3TextColor: LIGHT_TEXT,
        mindmapNode3BgColor: VESTLAND_COLORS[6],

        // === STATE DIAGRAM ===
        // State diagrams use primary colors, so we override specifically for states
        stateBkg: VESTLAND_COLORS[0], // Light cyan background
        stateLabelColor: DARK_TEXT, // Dark text for labels
        compositeBackground: '#f5f5f5',
        compositeBorder: '#666666',
        compositeTitleBackground: VESTLAND_COLORS[0],
        stateBorder: '#666666',
        innerEndBackground: VESTLAND_COLORS[4],
        specialStateColor: DARK_TEXT,
        labelColor: DARK_TEXT,
        altBackground: '#f5f5f5',
        transitionColor: '#666666',
        transitionLabelColor: DARK_TEXT,

        // === ER DIAGRAM ===
        attributeBackgroundColorOdd: '#f5f5f5',
        attributeBackgroundColorEven: '#ffffff',

        // === JOURNEY ===
        // Use darker colors
        fillType0: VESTLAND_COLORS[4], // Teal
        fillType1: VESTLAND_COLORS[2], // Pink
        fillType2: VESTLAND_COLORS[7], // Orange/red
        fillType3: VESTLAND_COLORS[10], // Sage
        fillType4: VESTLAND_COLORS[6], // Orange

        // General labels
        labelTextColor: DARK_TEXT,
        loopTextColor: DARK_TEXT,
        noteBkgColor: VESTLAND_COLORS[3], // Yellow
        noteTextColor: DARK_TEXT, // Dark text on yellow
        noteBorderColor: '#c8c040',
    };

    // Add pie chart colors (pie1 through pie12)
    VESTLAND_COLORS.forEach((color, index) => {
        themeVariables[`pie${index + 1}`] = color;
    });

    return themeVariables;
};

// Cached mermaid instance - import once, reuse forever
let mermaidPromise: Promise<MermaidAPI> | null = null;
const getMermaid = async (): Promise<MermaidAPI> => {
    if (!mermaidPromise) {
        mermaidPromise = (async () => {
            const mermaidModule = (await import('mermaid')) as unknown as { default: MermaidAPI };
            const mermaid = mermaidModule.default;
            mermaid.initialize({
                startOnLoad: false,
                securityLevel: 'strict',
                theme: 'base',
                themeVariables: buildVestlandThemeVariables(),
                // Layout configuration to reduce text overlap
                flowchart: {
                    nodeSpacing: 50, // More horizontal space between nodes
                    rankSpacing: 60, // More vertical space between levels
                    curve: 'basis', // Smoother curves
                    padding: 15, // Padding inside nodes
                    htmlLabels: false, // Use SVG text (more robust with special characters)
                },
                state: {
                    nodeSpacing: 50,
                    rankSpacing: 60,
                },
                sequence: {
                    boxMargin: 10,
                    noteMargin: 10,
                    messageMargin: 35,
                },
            });
            return mermaid;
        })();
    }
    return mermaidPromise;
};

// Global counter for unique diagram IDs
let diagramIdCounter = 0;

/**
 * Adjust SVG for responsive display and auto-fit titles.
 * Mermaid generates SVGs with fixed dimensions that don't scale on mobile.
 * This function makes them responsive while preserving aspect ratio,
 * and scales down titles that would overflow.
 */
const adjustSvgForResponsive = (svgString: string): string => {
    // Parse the SVG
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgEl = doc.documentElement;

    // Get current viewBox or create one from width/height
    let viewBox = svgEl.getAttribute('viewBox');
    const widthAttr = svgEl.getAttribute('width');
    const heightAttr = svgEl.getAttribute('height');

    // Parse dimensions
    const parseNum = (v: string | null) => {
        if (!v) return null;
        const n = Number.parseFloat(v.replace('px', '').trim());
        return Number.isFinite(n) && n > 0 ? n : null;
    };

    let width = parseNum(widthAttr);
    let height = parseNum(heightAttr);

    // If no viewBox, create one from width/height
    if (!viewBox && width && height) {
        viewBox = `0 0 ${width} ${height}`;
        svgEl.setAttribute('viewBox', viewBox);
    }

    // Parse viewBox dimensions
    let vbMinX = 0;
    let vbMinY = 0;
    let vbWidth = width ?? 800;
    let vbHeight = height ?? 600;

    if (viewBox) {
        const parts = viewBox.split(/\s+|,/).map(Number);
        if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
            [vbMinX, vbMinY, vbWidth, vbHeight] = parts;
        }
    }

    // Find and adjust title text elements that might overflow
    // Mermaid uses various classes for titles: titleText, pieTitleText, etc.
    const titleSelectors = [
        'text.titleText',
        'text.pieTitleText',
        'text[class*="title"]',
        'g.pieTitleText text',
        'text[dominant-baseline="middle"]', // Common for centered titles
    ];

    for (const selector of titleSelectors) {
        try {
            const titleElements = svgEl.querySelectorAll(selector);
            titleElements.forEach((titleEl) => {
                const textEl = titleEl as SVGTextElement;
                const textContent = textEl.textContent ?? '';

                // Skip short titles
                if (textContent.length < 20) return;

                // Get current font size
                const currentStyle = textEl.getAttribute('style') ?? '';
                const fontSizeMatch = currentStyle.match(/font-size:\s*([\d.]+)(px|em|rem)?/);
                const fontSize = fontSizeMatch ? parseFloat(fontSizeMatch[1]) : 24;
                const fontUnit = fontSizeMatch ? fontSizeMatch[2] || 'px' : 'px';

                // Estimate text width (rough approximation: ~0.6 * fontSize * character count)
                const estimatedWidth = textContent.length * fontSize * 0.55;
                const maxWidth = vbWidth * 0.9; // Allow 90% of viewBox width

                // If text is too wide, scale down the font
                if (estimatedWidth > maxWidth && maxWidth > 0) {
                    const scaleFactor = maxWidth / estimatedWidth;
                    const newFontSize = Math.max(fontSize * scaleFactor, 10); // Minimum 10px

                    // Update font-size in style
                    const newStyle = currentStyle.replace(
                        /font-size:\s*[\d.]+(px|em|rem)?/,
                        `font-size: ${newFontSize}${fontUnit}`,
                    );

                    if (newStyle !== currentStyle) {
                        textEl.setAttribute('style', newStyle);
                    } else {
                        // Add font-size if not present
                        textEl.setAttribute('style', `${currentStyle}; font-size: ${newFontSize}${fontUnit}`);
                    }
                }
            });
        } catch {
            // Selector might not be valid for all SVGs, ignore
        }
    }

    // Add padding to viewBox for any remaining overflow
    const leftPadding = 30;
    const rightPadding = 30;
    const adjustedMinX = vbMinX - leftPadding;
    const adjustedWidth = vbWidth + leftPadding + rightPadding;

    svgEl.setAttribute('viewBox', `${adjustedMinX} ${vbMinY} ${adjustedWidth} ${vbHeight}`);

    // Store dimensions for export
    if (!width) width = adjustedWidth;
    if (!height) height = vbHeight;

    // Make SVG responsive:
    // - Remove fixed width/height attributes (let CSS control size)
    // - Add preserveAspectRatio for proper scaling
    // - Store original dimensions as data attributes for aspect ratio
    if (width && height) {
        svgEl.setAttribute('data-original-width', String(width));
        svgEl.setAttribute('data-original-height', String(height));
    }

    // Remove fixed dimensions - CSS will handle responsive sizing
    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');

    // Ensure aspect ratio is preserved when scaling
    if (!svgEl.getAttribute('preserveAspectRatio')) {
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }

    // Remove any inline max-width style that would prevent scaling
    const style = svgEl.getAttribute('style') ?? '';
    const newStyle = style
        .replace(/max-width:\s*[^;]+;?/g, '')
        .replace(/width:\s*[^;]+;?/g, '')
        .replace(/height:\s*[^;]+;?/g, '')
        .trim();
    if (newStyle) {
        svgEl.setAttribute('style', newStyle);
    } else {
        svgEl.removeAttribute('style');
    }

    // Serialize back
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgEl);
};

const useClasses = makeStyles({
    root: {
        position: 'relative',
        maxWidth: '100%',
        // Minimum height prevents layout shifts during loading
        minHeight: '60px',
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        backgroundColor: tokens.colorNeutralBackground2,
    },
    actions: {
        position: 'absolute',
        top: tokens.spacingVerticalXS,
        right: tokens.spacingHorizontalS,
        zIndex: 10,
        backgroundColor: tokens.colorNeutralBackground2,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        boxShadow: tokens.shadow4,
    },
    scroll: {
        maxWidth: '100%',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        // Add padding at top for the download button
        paddingTop: tokens.spacingVerticalXXL,
        // Add padding on left/right for titles that overflow the SVG viewBox
        paddingLeft: tokens.spacingHorizontalXXL,
        paddingRight: tokens.spacingHorizontalXXL,
        '& svg': {
            // Make SVG responsive - scale to fit container
            width: '100%',
            height: 'auto',
            maxWidth: '100%',
            // Ensure SVG doesn't clip content - overflow visible allows title to extend beyond viewBox
            overflow: 'visible',
            display: 'block',
        },
    },
    loading: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60px',
        color: tokens.colorNeutralForeground3,
        gap: tokens.spacingHorizontalS,
    },
    error: {
        color: tokens.colorPaletteRedForeground1,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
    },
});

export interface MermaidBlockProps {
    code: string;
}

// Debounce delay in ms - wait for streaming to settle before rendering
const RENDER_DEBOUNCE_MS = 300;

// Resolution options for JPG download
interface ResolutionOption {
    label: string;
    description: string;
    scale: number;
}

const JPG_RESOLUTION_OPTIONS: ResolutionOption[] = [
    { label: 'Liten (1x)', description: 'For nett og rask deling', scale: 1 },
    { label: 'Medium (2x)', description: 'Standard kvalitet', scale: 2 },
    { label: 'Stor (4x)', description: 'For presentasjonar', scale: 4 },
    { label: 'Ekstra stor (6x)', description: 'For trykk', scale: 6 },
    { label: 'Maksimal (8x)', description: 'Høgaste kvalitet', scale: 8 },
];

export const MermaidBlock: React.FC<MermaidBlockProps> = memo(({ code }) => {
    const classes = useClasses();
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isRendering, setIsRendering] = useState(false);
    const [downloading, setDownloading] = useState(false);

    // Track the last successfully rendered code to avoid re-rendering same content
    const lastRenderedCodeRef = useRef<string>('');
    // Stable diagram ID per component instance
    const diagramIdRef = useRef<string>(`mermaid-${++diagramIdCounter}`);
    // Debounce timer ref
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Cancellation flag ref - can be set from cleanup to cancel in-flight renders
    const cancelledRef = useRef(false);

    const normalized = useMemo(() => code.trim(), [code]);

    useEffect(() => {
        // Clear any pending debounce and mark previous render as cancelled
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        cancelledRef.current = false;

        // Skip if code hasn't changed from last successful render
        if (normalized === lastRenderedCodeRef.current) {
            return;
        }

        // Skip empty code
        if (!normalized) {
            setSvg('');
            setError('');
            setIsRendering(false);
            lastRenderedCodeRef.current = '';
            return;
        }

        // Mark as rendering - the loading spinner will show if there's no SVG yet
        setIsRendering(true);

        // Debounce the render to avoid flickering during streaming
        debounceTimerRef.current = setTimeout(() => {
            const render = async () => {
                // Don't clear existing SVG - keep showing previous diagram until new one is ready
                setError('');

                try {
                    const mermaid = await getMermaid();
                    // Use a unique ID for each render attempt to avoid Mermaid's ID collision warnings
                    const renderId = `${diagramIdRef.current}-${Date.now()}`;
                    const result = await mermaid.render(renderId, normalized);

                    if (!cancelledRef.current) {
                        // Make SVG responsive and adjust viewBox for title overflow
                        const adjustedSvg = adjustSvgForResponsive(result.svg);
                        setSvg(adjustedSvg);
                        setError('');
                        lastRenderedCodeRef.current = normalized;
                    }
                } catch (e) {
                    const message = e instanceof Error ? e.message : String(e);
                    if (!cancelledRef.current) {
                        setError(message);
                        // Keep previous SVG on error if we have one
                    }
                } finally {
                    if (!cancelledRef.current) {
                        setIsRendering(false);
                    }
                }
            };

            void render();
        }, RENDER_DEBOUNCE_MS);

        // Cleanup: clear debounce timer and cancel in-flight render on unmount or code change
        return () => {
            cancelledRef.current = true;
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [normalized]);

    // Download as SVG (vector format - infinitely scalable)
    const downloadSvg = () => {
        if (!svg) return;
        setDownloading(true);

        try {
            const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'diagram.svg';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } finally {
            setDownloading(false);
        }
    };

    // Download as PNG (supports transparency, works with all SVG types)
    const downloadPng = async (scale = 2) => {
        if (!svg) return;
        setDownloading(true);

        try {
            // Parse SVG to get dimensions
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
            const svgEl = svgDoc.documentElement;

            // Get dimensions from SVG (check data attributes first, then viewBox)
            let width = 0;
            let height = 0;

            const parsePx = (v: string | null) => {
                if (!v) return null;
                const n = Number.parseFloat(v.replace('px', '').trim());
                return Number.isFinite(n) && n > 0 ? n : null;
            };

            // Try data attributes first (set by adjustSvgForResponsive)
            width = parsePx(svgEl.getAttribute('data-original-width')) ?? 0;
            height = parsePx(svgEl.getAttribute('data-original-height')) ?? 0;

            // Fall back to viewBox
            if (!width || !height) {
                const viewBox = svgEl.getAttribute('viewBox') ?? '';
                if (viewBox) {
                    const parts = viewBox.split(/\s+|,/).map((p) => Number.parseFloat(p));
                    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
                        width = width || parts[2];
                        height = height || parts[3];
                    }
                }
            }

            // Fallback dimensions
            width = width && width > 0 ? width : 800;
            height = height && height > 0 ? height : 600;

            // Set explicit dimensions on SVG for consistent rendering
            svgEl.setAttribute('width', String(width * scale));
            svgEl.setAttribute('height', String(height * scale));

            // Serialize to string
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgEl);

            // Create data URL
            const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
            const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;

            // Load image
            const img = new Image();
            img.crossOrigin = 'anonymous';

            await new Promise<void>((resolve, reject) => {
                img.onload = () => {
                    resolve();
                };
                img.onerror = () => {
                    reject(new Error('Klarte ikkje å laste SVG.'));
                };
                img.src = dataUrl;
            });

            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(width * scale);
            canvas.height = Math.round(height * scale);

            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Klarte ikkje å lage canvas.');

            // White background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw image
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Export as PNG
            const pngBlob: Blob | null = await new Promise((resolve) => {
                canvas.toBlob((b) => {
                    resolve(b);
                }, 'image/png');
            });

            if (!pngBlob) {
                // Canvas was tainted - fall back to SVG download
                downloadSvg();
                return;
            }

            const filename = `diagram-${scale}x.png`;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(pngBlob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(a.href);
        } catch {
            // If PNG export fails, fall back to SVG
            downloadSvg();
        } finally {
            setDownloading(false);
        }
    };

    // Show loading state only when we have no SVG yet
    const showLoading = isRendering && !svg;

    return (
        <div className={classes.root}>
            {!error && svg && (
                <div className={classes.actions}>
                    <Menu>
                        <MenuTrigger disableButtonEnhancement>
                            <Tooltip content="Last ned JPG" relationship="label">
                                <Button
                                    size="small"
                                    appearance="subtle"
                                    icon={<ArrowDownload20Regular />}
                                    iconPosition="before"
                                    disabled={!svg || downloading}
                                    aria-label="Last ned JPG"
                                >
                                    <ChevronDown16Regular />
                                </Button>
                            </Tooltip>
                        </MenuTrigger>
                        <MenuPopover>
                            <MenuList>
                                <MenuItem
                                    onClick={() => {
                                        downloadSvg();
                                    }}
                                    disabled={downloading}
                                >
                                    <div>
                                        <div style={{ fontWeight: 500 }}>SVG (vektor)</div>
                                        <div style={{ fontSize: '12px', opacity: 0.7 }}>
                                            Beste kvalitet, skalerbar til alle storleikar
                                        </div>
                                    </div>
                                </MenuItem>
                                {JPG_RESOLUTION_OPTIONS.map((option) => (
                                    <MenuItem
                                        key={option.scale}
                                        onClick={() => {
                                            void downloadPng(option.scale);
                                        }}
                                        disabled={downloading}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 500 }}>PNG {option.label}</div>
                                            <div style={{ fontSize: '12px', opacity: 0.7 }}>{option.description}</div>
                                        </div>
                                    </MenuItem>
                                ))}
                            </MenuList>
                        </MenuPopover>
                    </Menu>
                </div>
            )}
            {error ? (
                <div className={classes.error}>{`Kunne ikkje rendere Mermaid-diagram:\n${error}`}</div>
            ) : showLoading ? (
                <div className={classes.loading}>
                    <Spinner size="tiny" />
                    <span>Teiknar diagram...</span>
                </div>
            ) : (
                <div className={classes.scroll} dangerouslySetInnerHTML={{ __html: svg }} />
            )}
        </div>
    );
});

MermaidBlock.displayName = 'MermaidBlock';
