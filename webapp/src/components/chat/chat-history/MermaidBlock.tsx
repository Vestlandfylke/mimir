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
interface MermaidAPI {
    initialize: (config: { startOnLoad?: boolean; securityLevel?: MermaidSecurityLevel }) => void;
    render: (id: string, text: string) => Promise<{ svg: string }>;
}

// Cached mermaid instance - import once, reuse forever
let mermaidPromise: Promise<MermaidAPI> | null = null;
const getMermaid = async (): Promise<MermaidAPI> => {
    if (!mermaidPromise) {
        mermaidPromise = (async () => {
            const mermaidModule = (await import('mermaid')) as unknown as { default: MermaidAPI };
            const mermaid = mermaidModule.default;
            mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
            return mermaid;
        })();
    }
    return mermaidPromise;
};

// Global counter for unique diagram IDs
let diagramIdCounter = 0;

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
                        setSvg(result.svg);
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

            // Get dimensions from SVG
            let width = 0;
            let height = 0;

            const widthAttr = svgEl.getAttribute('width') ?? '';
            const heightAttr = svgEl.getAttribute('height') ?? '';
            const viewBox = svgEl.getAttribute('viewBox') ?? '';

            const parsePx = (v: string) => {
                const n = Number.parseFloat(v.replace('px', '').trim());
                return Number.isFinite(n) ? n : null;
            };

            width = parsePx(widthAttr) ?? 0;
            height = parsePx(heightAttr) ?? 0;

            if ((!width || !height) && viewBox) {
                const parts = viewBox.split(/\s+|,/).map((p) => Number.parseFloat(p));
                if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
                    width = parts[2];
                    height = parts[3];
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
