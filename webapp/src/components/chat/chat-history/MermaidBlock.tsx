import {
    Button,
    makeStyles,
    Menu,
    MenuItem,
    MenuList,
    MenuPopover,
    MenuTrigger,
    shorthands,
    Spinner,
    tokens,
    Tooltip,
} from '@fluentui/react-components';
import { ArrowDownload20Regular, ChevronDown16Regular } from '@fluentui/react-icons';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { MermaidEditorModal } from './MermaidEditorModal';
import { buildVestlandThemeVariables, diagramBaseStyles, getXYChartConfig, LIGHT_BACKGROUND } from './MermaidStyles';

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
    xyChart?: {
        titleColor?: string;
        xAxisLabelColor?: string;
        xAxisTitleColor?: string;
        xAxisTickColor?: string;
        xAxisLineColor?: string;
        yAxisLabelColor?: string;
        yAxisTitleColor?: string;
        yAxisTickColor?: string;
        yAxisLineColor?: string;
        plotColorPalette?: string;
    };
}
interface MermaidAPI {
    initialize: (config: MermaidConfig) => void;
    render: (id: string, text: string) => Promise<{ svg: string }>;
}

// Colors and theme variables are imported from MermaidStyles.ts

// Cached mermaid instance - ALWAYS uses light mode for consistent rendering
let mermaidPromise: Promise<MermaidAPI> | null = null;

const getMermaid = async (): Promise<MermaidAPI> => {
    if (!mermaidPromise) {
        mermaidPromise = (async () => {
            const mermaidModule = (await import('mermaid')) as unknown as { default: MermaidAPI };
            const mermaid = mermaidModule.default;

            // ALWAYS use light mode (false) - diagrams look the same in dark and light mode
            mermaid.initialize({
                startOnLoad: false,
                securityLevel: 'strict',
                theme: 'base',
                themeVariables: buildVestlandThemeVariables(false), // Always light mode
                flowchart: {
                    nodeSpacing: 50,
                    rankSpacing: 60,
                    curve: 'basis',
                    padding: 15,
                    htmlLabels: false,
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
                xyChart: getXYChartConfig(false), // Always light mode
            });
            return mermaid;
        })();
    }
    return mermaidPromise;
};

// Global counter for unique diagram IDs
let diagramIdCounter = 0;

/**
 * Render a Mermaid diagram in light mode for export/download.
 * This creates a fresh Mermaid instance to avoid affecting the displayed diagram.
 * @param code The Mermaid diagram code
 * @returns SVG string in light mode colors
 */
const renderForExport = async (code: string): Promise<string> => {
    const mermaidModule = (await import('mermaid')) as unknown as { default: MermaidAPI };
    const mermaid = mermaidModule.default;

    // Initialize with LIGHT mode settings for export (documents/emails have white backgrounds)
    mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: buildVestlandThemeVariables(false), // Always light mode
        flowchart: {
            nodeSpacing: 50,
            rankSpacing: 60,
            curve: 'basis',
            padding: 15,
            htmlLabels: false,
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
        // XY Chart colors from shared MermaidStyles.ts (always light mode for export)
        xyChart: getXYChartConfig(false),
    });

    const renderId = `mermaid-export-${Date.now()}`;
    const result = await mermaid.render(renderId, code);
    return result.svg;
};

/**
 * Adjust SVG for responsive display and auto-fit titles.
 * Mermaid generates SVGs with fixed dimensions that don't scale on mobile.
 * This function makes them responsive while preserving aspect ratio,
 * and scales down titles that would overflow.
 * @param svgString The SVG string to adjust
 */
// Adjust SVG for responsive display - no dark mode handling needed
// All diagrams use light mode colors for consistency
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

    const width = parseNum(widthAttr);
    const height = parseNum(heightAttr);

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

    // Store the ADJUSTED dimensions for export (must match the viewBox)
    // These are used by downloadPng to create the correct canvas size
    svgEl.setAttribute('data-original-width', String(adjustedWidth));
    svgEl.setAttribute('data-original-height', String(vbHeight));

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
        // Medium light gray - works well with light-mode diagrams
        backgroundColor: '#e8e8e8',
    },
    actions: {
        position: 'absolute',
        bottom: tokens.spacingVerticalXS,
        right: tokens.spacingHorizontalS,
        zIndex: 10,
        display: 'flex',
        gap: tokens.spacingHorizontalXS,
        backgroundColor: '#e8e8e8',
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        ...shorthands.padding('2px'),
        boxShadow: tokens.shadow4,
    },
    // Scroll container styles - uses shared styles from MermaidStyles.ts
    scroll: {
        maxWidth: '100%',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        // Add padding at bottom for the download button
        paddingBottom: tokens.spacingVerticalXXL,
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
        // Import shared base styles for all diagram types
        ...diagramBaseStyles,
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
    isDark?: boolean;
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

export const MermaidBlock: React.FC<MermaidBlockProps> = memo(({ code, isDark = false }) => {
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
    // Always exports in LIGHT mode for compatibility with documents/emails
    const downloadSvg = async () => {
        if (!svg || !normalized) return;
        setDownloading(true);

        try {
            // Re-render in light mode for export
            const lightModeSvg = await renderForExport(normalized);
            const adjustedSvg = adjustSvgForResponsive(lightModeSvg);

            const svgBlob = new Blob([adjustedSvg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'diagram.svg';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to export SVG in light mode:', err);
            // Fallback to current SVG if light mode render fails
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
    // Always exports in LIGHT mode for compatibility with documents/emails
    const downloadPng = async (scale = 2) => {
        if (!svg || !normalized) return;
        setDownloading(true);

        try {
            // Re-render in light mode for export
            const lightModeSvg = await renderForExport(normalized);
            const adjustedSvg = adjustSvgForResponsive(lightModeSvg);

            // Parse SVG to get dimensions from viewBox (most reliable source)
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(adjustedSvg, 'image/svg+xml');
            const svgEl = svgDoc.documentElement;

            // Get dimensions from viewBox - this is the actual coordinate system
            let width = 0;
            let height = 0;

            const viewBox = svgEl.getAttribute('viewBox') ?? '';
            if (viewBox) {
                const parts = viewBox.split(/\s+|,/).map((p) => Number.parseFloat(p));
                if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
                    // viewBox format: minX minY width height
                    width = parts[2];
                    height = parts[3];
                }
            }

            // Fallback to data attributes if viewBox doesn't give us dimensions
            if (!width || !height) {
                const parsePx = (v: string | null): number => {
                    if (!v) return 0;
                    const n = Number.parseFloat(v.replace('px', '').trim());
                    return Number.isFinite(n) && n > 0 ? n : 0;
                };
                if (!width) {
                    width = parsePx(svgEl.getAttribute('data-original-width')) || 800;
                }
                if (!height) {
                    height = parsePx(svgEl.getAttribute('data-original-height')) || 600;
                }
            }

            // Ensure minimum dimensions and proper aspect ratio
            width = Math.max(width, 100);
            height = Math.max(height, 100);

            // Calculate scaled dimensions
            const scaledWidth = Math.round(width * scale);
            const scaledHeight = Math.round(height * scale);

            // Clone the SVG and set explicit dimensions for rendering
            const svgClone = svgEl.cloneNode(true) as SVGSVGElement;
            svgClone.setAttribute('width', String(scaledWidth));
            svgClone.setAttribute('height', String(scaledHeight));
            // Ensure the viewBox is preserved so content scales correctly
            if (!svgClone.getAttribute('viewBox') && width && height) {
                svgClone.setAttribute('viewBox', `0 0 ${width} ${height}`);
            }

            // Serialize to string
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgClone);

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

            // Create canvas with the same dimensions as the scaled image
            const canvas = document.createElement('canvas');
            canvas.width = scaledWidth;
            canvas.height = scaledHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Klarte ikkje å lage canvas.');

            // White background (always light mode for export)
            ctx.fillStyle = LIGHT_BACKGROUND;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw image at full size
            ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

            // Export as PNG
            const pngBlob: Blob | null = await new Promise((resolve) => {
                canvas.toBlob((b) => {
                    resolve(b);
                }, 'image/png');
            });

            if (!pngBlob) {
                // Canvas was tainted - fall back to SVG download
                void downloadSvg();
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
            void downloadSvg();
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
                    <MermaidEditorModal code={normalized} isDark={isDark} />
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
                                        void downloadSvg();
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
