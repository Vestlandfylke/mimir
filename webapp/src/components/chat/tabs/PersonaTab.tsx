// Copyright (c) Microsoft. All rights reserved.

import {
    Accordion,
    AccordionHeader,
    AccordionItem,
    AccordionPanel,
    Button,
    Dropdown,
    Label,
    Option,
    Textarea,
    makeStyles,
    shorthands,
    tokens,
} from '@fluentui/react-components';
import { CheckmarkCircle16Filled, ChevronDown16Regular } from '@fluentui/react-icons';
import * as React from 'react';
import { useChat } from '../../../libs/hooks/useChat';
import { AlertType } from '../../../libs/models/AlertType';
import { useAppDispatch, useAppSelector } from '../../../redux/app/hooks';
import { RootState } from '../../../redux/app/store';
import { addAlert } from '../../../redux/features/app/appSlice';
import { editConversationSystemDescription } from '../../../redux/features/conversations/conversationsSlice';
import { MemoryBiasSlider } from '../persona/MemoryBiasSlider';
import { PromptEditor } from '../persona/PromptEditor';
import { TabView } from './TabView';

const useClasses = makeStyles({
    section: {
        display: 'flex',
        flexDirection: 'column',
        ...shorthands.gap(tokens.spacingVerticalM),
        marginBottom: tokens.spacingVerticalL,
    },
    sectionTitle: {
        fontSize: tokens.fontSizeBase400,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForeground1,
        marginBottom: tokens.spacingVerticalXS,
    },
    description: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
        marginBottom: tokens.spacingVerticalS,
    },
    quickSettings: {
        display: 'flex',
        flexDirection: 'column',
        ...shorthands.gap(tokens.spacingVerticalM),
    },
    settingRow: {
        display: 'flex',
        alignItems: 'center',
        ...shorthands.gap(tokens.spacingHorizontalM),
    },
    settingLabel: {
        minWidth: '100px',
        fontSize: tokens.fontSizeBase300,
    },
    dropdown: {
        minWidth: '180px',
    },
    textarea: {
        width: '100%',
        minHeight: '120px',
        maxHeight: '300px',
        '& textarea': {
            maxHeight: '280px',
            overflowY: 'auto',
            // Custom scrollbar styling
            '&::-webkit-scrollbar': {
                width: '6px',
            },
            '&::-webkit-scrollbar-track': {
                backgroundColor: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
                backgroundColor: tokens.colorNeutralStroke1,
                ...shorthands.borderRadius('3px'),
            },
            '&::-webkit-scrollbar-thumb:hover': {
                backgroundColor: tokens.colorNeutralStroke1Hover,
            },
        },
    },
    saveButtonContainer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        ...shorthands.gap(tokens.spacingHorizontalS),
        marginTop: tokens.spacingVerticalS,
    },
    savedIndicator: {
        display: 'flex',
        alignItems: 'center',
        ...shorthands.gap(tokens.spacingHorizontalXS),
        color: tokens.colorPaletteGreenForeground1,
        fontSize: tokens.fontSizeBase200,
    },
    advancedSection: {
        marginTop: tokens.spacingVerticalL,
    },
    advancedContent: {
        display: 'flex',
        flexDirection: 'column',
        ...shorthands.gap(tokens.spacingVerticalM),
        paddingTop: tokens.spacingVerticalM,
    },
});

// Tone options
const TONE_OPTIONS = [
    { key: 'standard', text: 'Standard' },
    { key: 'formal', text: 'Formell' },
    { key: 'casual', text: 'Uformell' },
    { key: 'pedagogisk', text: 'Pedagogisk' },
];

// Response length options
const LENGTH_OPTIONS = [
    { key: 'standard', text: 'Standard' },
    { key: 'kort', text: 'Kort og konsis' },
    { key: 'detaljert', text: 'Detaljert' },
];

const QUICK_SETTINGS_MARKER = '\n\n--- SVARSTIL ---\n';
const CUSTOM_INSTRUCTIONS_MARKER = '\n\n--- EIGNE INSTRUKSJONAR ---\n';

// Helper to extract saved tone from system description
const extractSavedTone = (systemDescription: string): string => {
    const quickIndex = systemDescription.indexOf(QUICK_SETTINGS_MARKER);
    if (quickIndex === -1) return 'standard';

    const quickSection = systemDescription.substring(quickIndex + QUICK_SETTINGS_MARKER.length);
    const endIndex = quickSection.indexOf('\n\n---');
    const quickText = endIndex !== -1 ? quickSection.substring(0, endIndex) : quickSection;

    if (quickText.toLowerCase().includes('formell')) return 'formal';
    if (quickText.toLowerCase().includes('uformell')) return 'casual';
    if (quickText.toLowerCase().includes('pedagogisk')) return 'pedagogisk';
    return 'standard';
};

// Helper to extract saved length from system description
const extractSavedLength = (systemDescription: string): string => {
    const quickIndex = systemDescription.indexOf(QUICK_SETTINGS_MARKER);
    if (quickIndex === -1) return 'standard';

    const quickSection = systemDescription.substring(quickIndex + QUICK_SETTINGS_MARKER.length);
    const endIndex = quickSection.indexOf('\n\n---');
    const quickText = endIndex !== -1 ? quickSection.substring(0, endIndex) : quickSection;

    if (quickText.toLowerCase().includes('korte og konsise')) return 'kort';
    if (quickText.toLowerCase().includes('detaljerte og utfyllande')) return 'detaljert';
    return 'standard';
};

// Helper to extract custom instructions from system description
const extractCustomInstructions = (systemDescription: string): string => {
    const index = systemDescription.indexOf(CUSTOM_INSTRUCTIONS_MARKER);
    if (index !== -1) {
        return systemDescription.substring(index + CUSTOM_INSTRUCTIONS_MARKER.length).trim();
    }
    // Fallback for old format
    const oldMarker = '\n\n--- TILLEGGSINSTRUKSJONAR ---\n';
    const oldIndex = systemDescription.indexOf(oldMarker);
    if (oldIndex !== -1) {
        return systemDescription.substring(oldIndex + oldMarker.length).trim();
    }
    return '';
};

// Helper to get base system description (without any customizations)
const getBaseSystemDescription = (systemDescription: string): string => {
    // Remove quick settings section if present
    let result = systemDescription;
    const quickIndex = result.indexOf(QUICK_SETTINGS_MARKER);
    if (quickIndex !== -1) {
        const nextMarkerIndex = result.indexOf('\n\n---', quickIndex + QUICK_SETTINGS_MARKER.length);
        if (nextMarkerIndex !== -1) {
            result = result.substring(0, quickIndex) + result.substring(nextMarkerIndex);
        } else {
            result = result.substring(0, quickIndex);
        }
    }

    // Remove custom instructions section if present
    const customIndex = result.indexOf(CUSTOM_INSTRUCTIONS_MARKER);
    if (customIndex !== -1) {
        result = result.substring(0, customIndex);
    }

    // Fallback for old format
    const oldMarker = '\n\n--- TILLEGGSINSTRUKSJONAR ---\n';
    const oldIndex = result.indexOf(oldMarker);
    if (oldIndex !== -1) {
        result = result.substring(0, oldIndex);
    }

    return result;
};

// Helper to build full system description with quick settings and custom instructions
const buildFullSystemDescription = (
    baseDescription: string,
    quickSettingsText: string,
    customInstructions: string,
): string => {
    let result = baseDescription;

    if (quickSettingsText.trim()) {
        result += `${QUICK_SETTINGS_MARKER}${quickSettingsText.trim()}`;
    }

    if (customInstructions.trim()) {
        result += `${CUSTOM_INSTRUCTIONS_MARKER}${customInstructions.trim()}`;
    }

    return result;
};

export const PersonaTab: React.FC = () => {
    const classes = useClasses();
    const chat = useChat();
    const dispatch = useAppDispatch();

    const { conversations, selectedId } = useAppSelector((state: RootState) => state.conversations);
    const chatState = conversations[selectedId];

    const [shortTermMemory, setShortTermMemory] = React.useState<string>('');
    const [longTermMemory, setLongTermMemory] = React.useState<string>('');
    const [customInstructions, setCustomInstructions] = React.useState<string>('');
    const [selectedTone, setSelectedTone] = React.useState<string>('standard');
    const [selectedLength, setSelectedLength] = React.useState<string>('standard');
    const [isSaving, setIsSaving] = React.useState(false);
    const [isSaved, setIsSaved] = React.useState(false);
    const [hasChanges, setHasChanges] = React.useState(false);

    // Track initial values for change detection
    const [initialTone, setInitialTone] = React.useState<string>('standard');
    const [initialLength, setInitialLength] = React.useState<string>('standard');
    const [initialInstructions, setInitialInstructions] = React.useState<string>('');

    // Load memories and extract custom instructions
    React.useEffect(() => {
        if (!conversations[selectedId].disabled) {
            void Promise.all([
                chat.getSemanticMemories(selectedId, 'WorkingMemory').then((memories) => {
                    setShortTermMemory(memories.join('\n'));
                }),
                chat.getSemanticMemories(selectedId, 'LongTermMemory').then((memories) => {
                    setLongTermMemory(memories.join('\n'));
                }),
            ]);
        }

        // Extract saved values from current system description
        const extractedInstructions = extractCustomInstructions(chatState.systemDescription);
        const extractedTone = extractSavedTone(chatState.systemDescription);
        const extractedLength = extractSavedLength(chatState.systemDescription);

        setCustomInstructions(extractedInstructions);
        setInitialInstructions(extractedInstructions);
        setSelectedTone(extractedTone);
        setInitialTone(extractedTone);
        setSelectedLength(extractedLength);
        setInitialLength(extractedLength);

        // Reset state when changing chat
        setIsSaved(false);
        setHasChanges(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    // Check for changes whenever values change
    React.useEffect(() => {
        const toneChanged = selectedTone !== initialTone;
        const lengthChanged = selectedLength !== initialLength;
        const instructionsChanged = customInstructions !== initialInstructions;

        const changed = toneChanged || lengthChanged || instructionsChanged;
        setHasChanges(changed);

        // If user makes changes after saving, hide the saved indicator
        if (changed && isSaved) {
            setIsSaved(false);
        }
    }, [selectedTone, selectedLength, customInstructions, initialTone, initialLength, initialInstructions, isSaved]);

    const handleSaveCustomizations = async () => {
        setIsSaving(true);
        setIsSaved(false);
        try {
            // Build the tone/length instructions
            let quickSettingsText = '';
            if (selectedTone !== 'standard') {
                const toneText = TONE_OPTIONS.find((t) => t.key === selectedTone)?.text ?? '';
                quickSettingsText += `Bruk ein ${toneText.toLowerCase()} tone i svara dine. `;
            }
            if (selectedLength !== 'standard') {
                if (selectedLength === 'kort') {
                    quickSettingsText += 'Gje korte og konsise svar. ';
                } else if (selectedLength === 'detaljert') {
                    quickSettingsText += 'Gje detaljerte og utfyllande svar. ';
                }
            }

            const baseDescription = getBaseSystemDescription(chatState.systemDescription);
            const newSystemDescription = buildFullSystemDescription(
                baseDescription,
                quickSettingsText,
                customInstructions,
            );

            await chat.editChat(selectedId, chatState.title, newSystemDescription, chatState.memoryBalance);
            dispatch(
                editConversationSystemDescription({
                    id: selectedId,
                    newSystemDescription: newSystemDescription,
                }),
            );

            // Update initial values to current values (so hasChanges becomes false)
            setInitialTone(selectedTone);
            setInitialLength(selectedLength);
            setInitialInstructions(customInstructions);

            // Show saved indicator
            setIsSaved(true);
            setHasChanges(false);
        } catch (error) {
            dispatch(
                addAlert({
                    type: AlertType.Error,
                    message: `Feil ved lagring: ${(error as Error).message}`,
                }),
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <TabView title="Tilpassing">
            {/* Quick Settings Section */}
            <div className={classes.section}>
                <h3 className={classes.sectionTitle}>Svarstil</h3>
                <p className={classes.description}>Juster korleis Mimir svarar deg i denne samtalen.</p>
                <div className={classes.quickSettings}>
                    <div className={classes.settingRow}>
                        <Label className={classes.settingLabel}>Tone:</Label>
                        <Dropdown
                            className={classes.dropdown}
                            value={TONE_OPTIONS.find((t) => t.key === selectedTone)?.text ?? 'Standard'}
                            selectedOptions={[selectedTone]}
                            onOptionSelect={(_, data) => {
                                setSelectedTone(data.optionValue ?? 'standard');
                            }}
                            disabled={chatState.disabled}
                        >
                            {TONE_OPTIONS.map((option) => (
                                <Option key={option.key} value={option.key}>
                                    {option.text}
                                </Option>
                            ))}
                        </Dropdown>
                    </div>
                    <div className={classes.settingRow}>
                        <Label className={classes.settingLabel}>Svarlengde:</Label>
                        <Dropdown
                            className={classes.dropdown}
                            value={LENGTH_OPTIONS.find((l) => l.key === selectedLength)?.text ?? 'Standard'}
                            selectedOptions={[selectedLength]}
                            onOptionSelect={(_, data) => {
                                setSelectedLength(data.optionValue ?? 'standard');
                            }}
                            disabled={chatState.disabled}
                        >
                            {LENGTH_OPTIONS.map((option) => (
                                <Option key={option.key} value={option.key}>
                                    {option.text}
                                </Option>
                            ))}
                        </Dropdown>
                    </div>
                </div>
            </div>

            {/* Custom Instructions Section */}
            <div className={classes.section}>
                <h3 className={classes.sectionTitle}>Eigne instruksjonar</h3>
                <p className={classes.description}>
                    Skriv eventuelle spesielle instruksjonar til Mimir. Til dømes: &quot;Svar alltid på bokmål&quot;
                    eller &quot;Forklar ting som om eg er nybyrjar&quot;.
                </p>
                <Textarea
                    className={classes.textarea}
                    placeholder="Skriv dine eigne instruksjonar her (valfritt)..."
                    value={customInstructions}
                    onChange={(_, data) => {
                        setCustomInstructions(data.value);
                    }}
                    rows={5}
                    resize="none"
                    disabled={chatState.disabled}
                />
                <div className={classes.saveButtonContainer}>
                    {isSaved && (
                        <span className={classes.savedIndicator}>
                            <CheckmarkCircle16Filled />
                            Lagra
                        </span>
                    )}
                    <Button
                        appearance={hasChanges ? 'primary' : 'secondary'}
                        onClick={() => {
                            void handleSaveCustomizations();
                        }}
                        disabled={chatState.disabled || isSaving || !hasChanges}
                    >
                        {isSaving ? 'Lagrar...' : 'Lagre tilpassingar'}
                    </Button>
                </div>
            </div>

            {/* Memory Balance */}
            <MemoryBiasSlider />

            {/* Advanced Section - Collapsible */}
            <div className={classes.advancedSection}>
                <Accordion collapsible>
                    <AccordionItem value="advanced">
                        <AccordionHeader expandIcon={<ChevronDown16Regular />}>Avansert</AccordionHeader>
                        <AccordionPanel>
                            <div className={classes.advancedContent}>
                                <PromptEditor
                                    title="Full systeminstruks"
                                    chatId={selectedId}
                                    prompt={chatState.systemDescription}
                                    isEditable={false}
                                    info="Den fullstendige tekniske instruksjonen som styrer Mimir. Denne kan ikkje endrast direkte - bruk dei forenkla vala øvst for tilpassingar."
                                />
                                <PromptEditor
                                    title="Korttidsminne"
                                    chatId={selectedId}
                                    prompt={`<label>: <details>\n${shortTermMemory}`}
                                    isEditable={false}
                                    info="Viser nyleg kontekst frå denne samtaleøkta."
                                />
                                <PromptEditor
                                    title="Langtidsminne"
                                    chatId={selectedId}
                                    prompt={`<label>: <details>\n${longTermMemory}`}
                                    isEditable={false}
                                    info="Viser viktige fakta og tema frå denne samtaleøkta."
                                />
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                </Accordion>
            </div>
        </TabView>
    );
};
