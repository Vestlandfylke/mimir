import { Button, Tooltip, makeStyles, shorthands, tokens } from '@fluentui/react-components';
import { ArrowDownload20Regular } from '@fluentui/react-icons';
import React, { useEffect, useMemo, useState } from 'react';

type MermaidSecurityLevel = 'strict' | 'loose' | 'antiscript';
interface MermaidAPI {
    initialize: (config: { startOnLoad?: boolean; securityLevel?: MermaidSecurityLevel }) => void;
    render: (id: string, text: string) => Promise<{ svg: string }>;
}

const useClasses = makeStyles({
    root: {
        position: 'relative',
        maxWidth: '100%',
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
    error: {
        color: tokens.colorPaletteRedForeground1,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
    },
});

export interface MermaidBlockProps {
    code: string;
}

export const MermaidBlock: React.FC<MermaidBlockProps> = ({ code }) => {
    const classes = useClasses();
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [downloading, setDownloading] = useState(false);

    const normalized = useMemo(() => code.trim(), [code]);
    const diagramId = useMemo(() => `mermaid-${Math.random().toString(36).slice(2)}`, []);

    useEffect(() => {
        let cancelled = false;

        const render = async () => {
            setError('');
            setSvg('');

            if (!normalized) return;

            try {
                // NOTE: react-scripts build uses type-aware ESLint; depending on TS moduleResolution,
                // Mermaid can be seen as an "error type". We avoid that by casting the dynamic import
                // to a local MermaidAPI type.
                const mermaidModule = (await import('mermaid')) as unknown as { default: MermaidAPI };
                const mermaid = mermaidModule.default;

                mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });

                const result = await mermaid.render(diagramId, normalized);
                if (!cancelled) setSvg(result.svg);
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                if (!cancelled) setError(message);
            }
        };

        void render();

        return () => {
            cancelled = true;
        };
    }, [diagramId, normalized]);

    const downloadJpg = async () => {
        if (!svg) return;
        setDownloading(true);

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svg, 'image/svg+xml');
            const svgEl = doc.documentElement;

            // Determine size
            const widthAttr = svgEl.getAttribute('width') ?? '';
            const heightAttr = svgEl.getAttribute('height') ?? '';
            const viewBox = svgEl.getAttribute('viewBox') ?? '';

            const parsePx = (v: string) => {
                const n = Number.parseFloat(v.replace('px', '').trim());
                return Number.isFinite(n) ? n : null;
            };

            let width = parsePx(widthAttr);
            let height = parsePx(heightAttr);

            if ((!width || !height) && viewBox) {
                const parts = viewBox.split(/\s+|,/).map((p) => Number.parseFloat(p));
                if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
                    width = parts[2];
                    height = parts[3];
                }
            }

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

            const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => {
                    resolve();
                };
                img.onerror = () => {
                    reject(new Error('Klarte ikkje å laste SVG som bilete.'));
                };
                img.src = url;
            });

            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);

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

    return (
        <div className={classes.root}>
            {!error && (
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
            ) : (
                <div className={classes.scroll} dangerouslySetInnerHTML={{ __html: svg || '' }} />
            )}
        </div>
    );
};


