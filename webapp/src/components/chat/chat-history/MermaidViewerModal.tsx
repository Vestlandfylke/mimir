// Copyright (c) Microsoft. All rights reserved.

import {
    Button,
    Dialog,
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
    tokens,
    Tooltip,
} from '@fluentui/react-components';
import {
    Add20Regular,
    ArrowDownload20Regular,
    ArrowReset20Regular,
    ChevronDown16Regular,
    Dismiss24Regular,
    Open20Regular,
    Subtract20Regular,
} from '@fluentui/react-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { diagramBaseStyles, diagramLightModeStyles, LIGHT_BACKGROUND } from './MermaidStyles';

// Resolution options for PNG download
interface ResolutionOption {
    label: string;
    description: string;
    scale: number;
}

const PNG_RESOLUTION_OPTIONS: ResolutionOption[] = [
    { label: 'Liten (1x)', description: 'For nett og rask deling', scale: 1 },
    { label: 'Medium (2x)', description: 'Standard kvalitet', scale: 2 },
    { label: 'Stor (4x)', description: 'For presentasjonar', scale: 4 },
    { label: 'Ekstra stor (6x)', description: 'For trykk', scale: 6 },
    { label: 'Maksimal (8x)', description: 'Høgaste kvalitet', scale: 8 },
];

// Mobile breakpoint
const MOBILE_BREAKPOINT = '768px';

const useClasses = makeStyles({
    surface: {
        maxWidth: '95vw',
        width: '1400px',
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
    titleBar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    zoomControls: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
    },
    zoomLabel: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
        minWidth: '50px',
        textAlign: 'center',
        // Mobile: hide zoom percentage
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            display: 'none',
        },
    },
    contentWrapper: {
        display: 'flex',
        flexDirection: 'column',
        height: '80vh',
        minHeight: '400px',
        userSelect: 'none',
        // Mobile: fit within 90vh modal
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            height: 'calc(90vh - 140px)',
            minHeight: '250px',
        },
    },
    viewerContainer: {
        flex: 1,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        // Same background as MermaidBlock
        backgroundColor: '#f5f5f5',
        ...shorthands.padding(tokens.spacingVerticalM),
        overflow: 'hidden',
        position: 'relative',
        // Mobile: keep border radius, less padding
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            ...shorthands.borderRadius(tokens.borderRadiusMedium),
            ...shorthands.padding(tokens.spacingVerticalS),
        },
    },
    viewerInner: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        // Mobile: touch-friendly
        touchAction: 'none',
        ':active': {
            cursor: 'grabbing',
        },
    },
    viewerInnerDragging: {
        cursor: 'grabbing',
    },
    // SVG styles - imported from shared MermaidStyles.ts
    viewerSvg: {
        transformOrigin: 'center center',
        transition: 'none',
        userSelect: 'none',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '& svg': {
            // Give SVG explicit dimensions since MermaidBlock removes them
            // Use a reasonable default that will scale with zoom
            width: 'auto',
            height: 'auto',
            minWidth: '400px',
            minHeight: '300px',
            maxWidth: '100%',
            maxHeight: '100%',
        },
        // Import shared base styles for all diagram types
        ...diagramBaseStyles,
        // Mobile: smaller minimum size
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            '& svg': {
                minWidth: '250px',
                minHeight: '200px',
            },
        },
    },
    // Light mode styles
    viewerSvgLight: {
        ...diagramLightModeStyles,
    },
    hint: {
        position: 'absolute',
        bottom: tokens.spacingVerticalM,
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        color: 'white',
        fontSize: tokens.fontSizeBase200,
        ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalM),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        pointerEvents: 'none',
        opacity: 0.8,
    },
    actions: {
        display: 'flex',
        gap: tokens.spacingHorizontalS,
        justifyContent: 'flex-end',
        marginTop: tokens.spacingVerticalS,
        // Mobile: center and stack buttons
        [`@media (max-width: ${MOBILE_BREAKPOINT})`]: {
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: tokens.spacingHorizontalXS,
        },
    },
});

interface MermaidViewerModalProps {
    svg: string;
    code: string;
    isDark?: boolean;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenEditor?: () => void;
}

export const MermaidViewerModal: React.FC<MermaidViewerModalProps> = ({
    svg,
    code: _code, // Kept for potential future use
    isDark: _isDark = false,
    isOpen,
    onOpenChange,
    onOpenEditor,
}) => {
    const classes = useClasses();
    const [zoom, setZoom] = useState(100);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [showHint, setShowHint] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Touch support ref for pinch-zoom
    const lastPinchDistanceRef = useRef<number | null>(null);

    // Get SVG dimensions from viewBox or data attributes
    const svgDimensions = useMemo(() => {
        if (!svg) return { width: 800, height: 600 };

        const parser = new DOMParser();
        const doc = parser.parseFromString(svg, 'image/svg+xml');
        const svgEl = doc.documentElement;

        let width = 0;
        let height = 0;

        // Try viewBox first
        const viewBox = svgEl.getAttribute('viewBox') ?? '';
        if (viewBox) {
            const parts = viewBox.split(/\s+|,/).map((p) => Number.parseFloat(p));
            if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
                width = parts[2];
                height = parts[3];
            }
        }

        // Fallback to data attributes
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

        return { width: Math.max(width, 100), height: Math.max(height, 100) };
    }, [svg]);

    // Download as SVG
    const downloadSvg = useCallback(() => {
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
    }, [svg]);

    // Download as PNG
    const downloadPng = useCallback(
        async (scale = 2) => {
            if (!svg) return;
            setDownloading(true);

            try {
                const { width, height } = svgDimensions;
                const scaledWidth = Math.round(width * scale);
                const scaledHeight = Math.round(height * scale);

                // Parse and clone SVG with explicit dimensions
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
                const svgEl = svgDoc.documentElement;

                const svgClone = svgEl.cloneNode(true) as SVGSVGElement;
                svgClone.setAttribute('width', String(scaledWidth));
                svgClone.setAttribute('height', String(scaledHeight));

                // Ensure viewBox is set
                if (!svgClone.getAttribute('viewBox') && width && height) {
                    svgClone.setAttribute('viewBox', `0 0 ${width} ${height}`);
                }

                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(svgClone);
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
                        reject(new Error('Failed to load SVG'));
                    };
                    img.src = dataUrl;
                });

                // Create canvas and draw
                const canvas = document.createElement('canvas');
                canvas.width = scaledWidth;
                canvas.height = scaledHeight;

                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('Could not create canvas context');

                // White background
                ctx.fillStyle = LIGHT_BACKGROUND;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

                // Export as PNG
                const pngBlob: Blob | null = await new Promise((resolve) => {
                    canvas.toBlob((b) => {
                        resolve(b);
                    }, 'image/png');
                });

                if (!pngBlob) {
                    // Fallback to SVG
                    downloadSvg();
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
                // Fallback to SVG on error
                downloadSvg();
            } finally {
                setDownloading(false);
            }
        },
        [svg, svgDimensions, downloadSvg],
    );

    // Reset state when modal opens
    useEffect(() => {
        if (!isOpen) {
            return;
        }
        setZoom(100);
        setPanOffset({ x: 0, y: 0 });
        setShowHint(true);
        // Hide hint after 3 seconds
        const timer = setTimeout(() => {
            setShowHint(false);
        }, 3000);
        return () => {
            clearTimeout(timer);
        };
    }, [isOpen]);

    const handleZoomIn = () => {
        setZoom((z) => Math.min(z + 50, 1000));
        setShowHint(false);
    };

    const handleZoomOut = () => {
        setZoom((z) => Math.max(z - 50, 10));
        setShowHint(false);
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
        setShowHint(false);
    }, []);

    // Pan/drag handlers
    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (e.button !== 0) return; // Only left click
            setIsPanning(true);
            setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
            setShowHint(false);
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
            setShowHint(false);
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

    const handleOpenEditor = () => {
        onOpenChange(false);
        onOpenEditor?.();
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(_, data) => {
                onOpenChange(data.open);
            }}
        >
            <DialogSurface className={classes.surface}>
                <DialogBody>
                    <DialogTitle
                        action={
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
                                <span className={classes.zoomLabel}>{zoom}%</span>
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
                                <DialogTrigger action="close">
                                    <Button appearance="subtle" aria-label="Lukk" icon={<Dismiss24Regular />} />
                                </DialogTrigger>
                            </div>
                        }
                    >
                        Diagram
                    </DialogTitle>
                    <DialogContent>
                        <div className={classes.contentWrapper}>
                            <div ref={containerRef} className={classes.viewerContainer}>
                                <div
                                    className={mergeClasses(
                                        classes.viewerInner,
                                        isPanning && classes.viewerInnerDragging,
                                    )}
                                    onWheel={handleWheel}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseLeave}
                                    onTouchStart={handleTouchStart}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                >
                                    <div
                                        className={mergeClasses(classes.viewerSvg, classes.viewerSvgLight)}
                                        style={{
                                            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom / 100})`,
                                        }}
                                        dangerouslySetInnerHTML={{ __html: svg }}
                                    />
                                </div>
                                {showHint && (
                                    <div className={classes.hint}>Scroll/knip for å zoome • Dra for å flytte</div>
                                )}
                            </div>
                            <div className={classes.actions}>
                                <Tooltip content="Opne i diagrameditor for å redigere" relationship="label">
                                    <Button appearance="secondary" icon={<Open20Regular />} onClick={handleOpenEditor}>
                                        Opne i editor
                                    </Button>
                                </Tooltip>
                                <Menu>
                                    <MenuTrigger disableButtonEnhancement>
                                        <Button
                                            appearance="primary"
                                            icon={<ArrowDownload20Regular />}
                                            iconPosition="before"
                                            disabled={!svg || downloading}
                                        >
                                            Last ned
                                            <ChevronDown16Regular style={{ marginLeft: '4px' }} />
                                        </Button>
                                    </MenuTrigger>
                                    <MenuPopover>
                                        <MenuList>
                                            <MenuItem onClick={downloadSvg} disabled={downloading}>
                                                <div>
                                                    <div style={{ fontWeight: 500 }}>SVG (vektor)</div>
                                                    <div style={{ fontSize: '12px', opacity: 0.7 }}>
                                                        Beste kvalitet, skalerbar til alle storleikar
                                                    </div>
                                                </div>
                                            </MenuItem>
                                            {PNG_RESOLUTION_OPTIONS.map((option) => (
                                                <MenuItem
                                                    key={option.scale}
                                                    onClick={() => {
                                                        void downloadPng(option.scale);
                                                    }}
                                                    disabled={downloading}
                                                >
                                                    <div>
                                                        <div style={{ fontWeight: 500 }}>PNG {option.label}</div>
                                                        <div style={{ fontSize: '12px', opacity: 0.7 }}>
                                                            {option.description}
                                                        </div>
                                                    </div>
                                                </MenuItem>
                                            ))}
                                        </MenuList>
                                    </MenuPopover>
                                </Menu>
                            </div>
                        </div>
                    </DialogContent>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};

export default MermaidViewerModal;
