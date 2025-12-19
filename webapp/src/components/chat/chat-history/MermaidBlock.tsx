import { Button, Spinner, Tooltip, makeStyles, shorthands, tokens } from '@fluentui/react-components';
import { ArrowDownload20Regular } from '@fluentui/react-icons';
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
        ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalS),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        backgroundColor: tokens.colorNeutralBackground2,
    },
    actions: {
        position: 'absolute',
        top: tokens.spacingVerticalXS,
        right: tokens.spacingHorizontalXS,
        zIndex: 1,
    },
    scroll: {
        maxWidth: '100%',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
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

    const downloadJpg = async () => {
        if (!svg) return;
        setDownloading(true);

        try {
            // Use data URL instead of blob URL to avoid tainting the canvas
            const svgBase64 = btoa(unescape(encodeURIComponent(svg)));
            const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;

            // Load the image first to get its natural dimensions
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => {
                    resolve();
                };
                img.onerror = () => {
                    reject(new Error('Klarte ikkje å laste SVG som bilete.'));
                };
                img.src = dataUrl;
            });

            // Use the image's natural dimensions (what the browser rendered)
            // This correctly handles all diagram types regardless of their aspect ratio
            let width = img.naturalWidth;
            let height = img.naturalHeight;

            // Fallback to parsing SVG attributes if natural dimensions are 0
            if (!width || !height) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(svg, 'image/svg+xml');
                const svgEl = doc.documentElement;

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
            }

            // Final fallback
            width = width && width > 0 ? width : 1200;
            height = height && height > 0 ? height : 800;

            const scale = 2;
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(width * scale);
            canvas.height = Math.round(height * scale);

            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Klarte ikkje å lage canvas-context.');

            // White background (JPEG has no alpha)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(scale, scale);

            // Draw image at its natural size
            ctx.drawImage(img, 0, 0, width, height);

            const jpgBlob: Blob | null = await new Promise((resolve) => {
                canvas.toBlob(
                    (b) => {
                        resolve(b);
                    },
                    'image/jpeg',
                    0.92,
                );
            });
            if (!jpgBlob) throw new Error('Klarte ikkje å generere JPG.');

            const a = document.createElement('a');
            a.href = URL.createObjectURL(jpgBlob);
            a.download = 'diagram.jpg';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(a.href);
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
                    <Tooltip content="Last ned JPG" relationship="label">
                        <Button
                            size="small"
                            appearance="subtle"
                            icon={<ArrowDownload20Regular />}
                            onClick={() => {
                                void downloadJpg();
                            }}
                            disabled={!svg || downloading}
                            aria-label="Last ned JPG"
                        />
                    </Tooltip>
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
