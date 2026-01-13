// Copyright (c) Microsoft. All rights reserved.
import {
    Button,
    makeStyles,
    Menu,
    MenuItem,
    MenuList,
    MenuPopover,
    MenuTrigger,
    shorthands,
    tokens,
    Tooltip,
} from '@fluentui/react-components';
import { DiagramRegular, Open20Regular, Wrench20Regular } from '@fluentui/react-icons';
import React, { useState } from 'react';
import { MermaidEditorModal } from './chat-history/MermaidEditorModal';
import { DIAGRAM_TYPES, DiagramType } from './DiagramTypeSelector';

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
    menuItem: {
        display: 'flex',
        alignItems: 'center',
        ...shorthands.gap(tokens.spacingHorizontalS),
    },
    diagramSubmenu: {
        maxHeight: '400px',
        overflowY: 'auto',
    },
    diagramItem: {
        display: 'flex',
        alignItems: 'center',
        ...shorthands.gap(tokens.spacingHorizontalS),
    },
    diagramIcon: {
        fontSize: '18px',
        display: 'flex',
        alignItems: 'center',
    },
    selectedIndicator: {
        marginLeft: 'auto',
        color: tokens.colorBrandForeground1,
        fontWeight: tokens.fontWeightSemibold,
        fontSize: tokens.fontSizeBase200,
    },
});

// Note: DIAGRAM_TYPES is imported from DiagramTypeSelector.tsx to keep prompts in sync

interface ToolsMenuProps {
    selectedDiagramType: DiagramType | null;
    onSelectDiagramType: (type: DiagramType | null) => void;
    disabled?: boolean;
    isDark?: boolean;
}

export const ToolsMenu: React.FC<ToolsMenuProps> = ({
    selectedDiagramType,
    onSelectDiagramType,
    disabled,
    isDark = false,
}) => {
    const classes = useClasses();
    const [isOpen, setIsOpen] = useState(false);
    const [editorOpen, setEditorOpen] = useState(false);

    const handleDiagramSelect = (diagram: (typeof DIAGRAM_TYPES)[number]) => {
        if (selectedDiagramType?.id === diagram.id) {
            // Deselect if clicking the same one
            onSelectDiagramType(null);
        } else {
            onSelectDiagramType({
                id: diagram.id,
                label: diagram.label,
                description: diagram.description,
                icon: diagram.icon,
                prompt: diagram.prompt,
            });
        }
        setIsOpen(false);
    };

    const handleClearDiagram = () => {
        onSelectDiagramType(null);
        setIsOpen(false);
    };

    const hasSelectedDiagram = selectedDiagramType !== null;

    return (
        <>
            <Menu
                open={isOpen}
                onOpenChange={(_, data) => {
                    setIsOpen(data.open);
                }}
            >
                <MenuTrigger disableButtonEnhancement>
                    <Tooltip
                        content={hasSelectedDiagram ? `Verktøy (${selectedDiagramType.label} valt)` : 'Verktøy'}
                        relationship="label"
                    >
                        <Button
                            appearance="transparent"
                            size="large"
                            icon={hasSelectedDiagram ? <DiagramRegular /> : <Wrench20Regular />}
                            disabled={disabled}
                            className={hasSelectedDiagram ? classes.selectedButton : classes.triggerButton}
                            aria-label="Verktøy"
                        />
                    </Tooltip>
                </MenuTrigger>
                <MenuPopover>
                    <MenuList>
                        {/* Diagram type submenu */}
                        <Menu>
                            <MenuTrigger disableButtonEnhancement>
                                <MenuItem icon={<DiagramRegular />}>
                                    <span className={classes.menuItem}>
                                        Vel diagramtype
                                        {hasSelectedDiagram && (
                                            <span className={classes.selectedIndicator}>
                                                ({selectedDiagramType.label})
                                            </span>
                                        )}
                                    </span>
                                </MenuItem>
                            </MenuTrigger>
                            <MenuPopover>
                                <MenuList className={classes.diagramSubmenu}>
                                    {hasSelectedDiagram && (
                                        <MenuItem onClick={handleClearDiagram}>
                                            <span style={{ color: tokens.colorPaletteRedForeground1 }}>
                                                ✕ Fjern diagramval
                                            </span>
                                        </MenuItem>
                                    )}
                                    {DIAGRAM_TYPES.map((diagram) => (
                                        <Tooltip
                                            key={diagram.id}
                                            content={diagram.description}
                                            relationship="description"
                                            positioning="after"
                                        >
                                            <MenuItem
                                                onClick={() => {
                                                    handleDiagramSelect(diagram);
                                                }}
                                            >
                                                <span className={classes.diagramItem}>
                                                    <span className={classes.diagramIcon}>{diagram.icon}</span>
                                                    {diagram.label}
                                                    {selectedDiagramType?.id === diagram.id && (
                                                        <span className={classes.selectedIndicator}>✓</span>
                                                    )}
                                                </span>
                                            </MenuItem>
                                        </Tooltip>
                                    ))}
                                </MenuList>
                            </MenuPopover>
                        </Menu>

                        {/* Open diagram editor */}
                        <MenuItem
                            icon={<Open20Regular />}
                            onClick={() => {
                                setEditorOpen(true);
                                setIsOpen(false);
                            }}
                        >
                            Opne diagrameditor
                        </MenuItem>
                    </MenuList>
                </MenuPopover>
            </Menu>

            {/* Diagram editor modal - controlled externally, no trigger needed */}
            {editorOpen && (
                <MermaidEditorModal code="" isOpen={editorOpen} onOpenChange={setEditorOpen} isDark={isDark} />
            )}
        </>
    );
};
