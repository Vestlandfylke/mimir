// Copyright (c) Microsoft. All rights reserved.

import {
    Accordion,
    AccordionHeader,
    AccordionItem,
    AccordionPanel,
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    Label,
    Link,
    Tooltip,
    makeStyles,
    shorthands,
} from '@fluentui/react-components';
import { Info16Regular } from '@fluentui/react-icons';
import React from 'react';
import { BotResponsePrompt, DependencyDetails, PromptSectionsNameMap } from '../../../libs/models/BotResponsePrompt';
import { ChatMessageType, IChatMessage } from '../../../libs/models/ChatMessage';
import { PlanType } from '../../../libs/models/Plan';
import { PlanExecutionMetadata } from '../../../libs/models/PlanExecutionMetadata';
import { useDialogClasses } from '../../../styles';
import { TokenUsageGraph } from '../../token-usage/TokenUsageGraph';
import { formatParagraphTextContent } from '../../utils/TextUtils';
import { StepwiseThoughtProcessView } from './stepwise-planner/StepwiseThoughtProcessView';

/**
 * Extracts user-friendly parts of the system persona, hiding technical instructions.
 * Shows only:
 * 1. The introduction paragraph
 * 2. User's custom instructions (if any)
 */
const extractUserFriendlySystemPersona = (fullPersona: string): string => {
    if (!fullPersona) return '';

    // Technical sections to hide - these start with markers that indicate internal instructions
    const technicalMarkers = [
        '=== GRUNNLEGGJANDE PRINSIPP ===',
        'KVALITETSSTANDARDAR:',
        'TRYGGLEIK OG ETIKK:',
        'KOMMUNIKASJONSSTIL:',
        'SVARSTIL OG KVALITET:',
        'MERMAID-SYNTAKS',
        'MARKDOWN-FORMATERING',
        'VIKTIGE AVGRENSINGAR:',
        'RESPONS-REGLAR:',
        'FILFORMAT-STØTTE:',
        'FORMAT-INSTRUKSJONAR:',
    ];

    // Find the earliest technical marker
    let cutoffIndex = fullPersona.length;
    for (const marker of technicalMarkers) {
        const index = fullPersona.indexOf(marker);
        if (index !== -1 && index < cutoffIndex) {
            cutoffIndex = index;
        }
    }

    // Extract the introduction part
    let userFriendlyPart = fullPersona.substring(0, cutoffIndex).trim();

    // Look for user's custom instructions (usually after "BRUKARINSTRUKSJONAR:" or similar)
    const customInstructionsMarkers = [
        'BRUKARINSTRUKSJONAR:',
        'EIGNE INSTRUKSJONAR:',
        'Brukarinstruksjonar:',
        'Eigne instruksjonar:',
    ];

    for (const marker of customInstructionsMarkers) {
        const markerIndex = fullPersona.indexOf(marker);
        if (markerIndex !== -1) {
            // Find the end of this section (next section marker or end of string)
            let endIndex = fullPersona.length;
            for (const techMarker of technicalMarkers) {
                const techIndex = fullPersona.indexOf(techMarker, markerIndex + marker.length);
                if (techIndex !== -1 && techIndex < endIndex) {
                    endIndex = techIndex;
                }
            }
            const customInstructions = fullPersona.substring(markerIndex, endIndex).trim();
            if (customInstructions) {
                userFriendlyPart += '\n\n' + customInstructions;
            }
            break;
        }
    }

    return userFriendlyPart || 'Ingen systeminstruksjonar tilgjengeleg.';
};

/**
 * Removes redundant English prefixes from prompt section content.
 * These prefixes are already shown as Norwegian headers, so they're redundant.
 */
const stripRedundantPrefixes = (content: string, key: string): string => {
    if (!content) return content;

    // Map of keys to their English prefixes that should be removed
    const prefixesToRemove = new Map<string, string[]>([
        ['userIntent', ['User intent:', 'User Intent:', 'User request:', 'User Request:']],
        ['chatHistory', ['Chat history:', 'Chat History:']],
        ['audience', ['Audience:', 'Target audience:']],
        ['chatMemories', ['Chat memories:', 'Chat Memories:']],
    ]);

    const prefixes = prefixesToRemove.get(key);
    if (!prefixes) return content;

    let result = content;
    for (const prefix of prefixes) {
        if (result.startsWith(prefix)) {
            result = result.substring(prefix.length).trim();
            break;
        }
    }

    return result;
};

/**
 * Cleans up content to be more user-friendly.
 * - Replaces diagram request prompts with a simple note
 * - Removes technical prefixes
 */
const cleanupPromptContent = (content: string, key: string): string => {
    if (!content) return content;

    let result = content;

    // Pattern to match diagram request format: [Diagram request: ...]\n\nUser request: <actual message>
    // Replace with just the user's actual message and a note about diagram selection
    const diagramRequestPattern = /\[Diagram request: [^\]]+\]\s*\n\s*User request:\s*/g;
    result = result.replace(diagramRequestPattern, key === 'chatHistory' ? '[Diagramførespurnad] ' : '');

    // Clean up any remaining "User request:" prefixes
    result = result.replace(/User request:\s*/g, '');

    return result;
};

const useClasses = makeStyles({
    infoButton: {
        ...shorthands.padding(0),
        ...shorthands.margin(0),
        minWidth: 'auto',
        marginLeft: 'auto', // align to right
    },
    text: {
        width: '100%',
        overflowWrap: 'break-word',
    },
    chatHistoryContainer: {
        display: 'flex',
        flexDirection: 'column',
        ...shorthands.gap('8px'),
        marginTop: '8px',
    },
    chatMessage: {
        ...shorthands.padding('4px', '0'),
        ...shorthands.borderBottom('1px', 'solid', 'var(--colorNeutralStroke2)'),
        paddingBottom: '8px',
    },
    messageRole: {
        fontWeight: '600',
        marginBottom: '2px',
        color: 'var(--colorNeutralForeground2)',
        fontSize: '0.9em',
    },
    messageContent: {
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
    },
    accordionHeader: {
        '& button': {
            fontWeight: '700',
        },
    },
    accordionPanel: {
        ...shorthands.padding('8px', '0', '16px', '0'),
    },
});

/**
 * Parses chat history string into structured messages.
 * Backend format: "[timestamp] Username said: content"
 */
const parseChatHistory = (
    content: string,
): Array<{ role: 'user' | 'bot'; content: string; timestamp?: string; username?: string }> => {
    if (!content) return [];

    const messages: Array<{ role: 'user' | 'bot'; content: string; timestamp?: string; username?: string }> = [];

    // Split by lines first, then look for message patterns
    const lines = content.split('\n');

    let currentMessage: { role: 'user' | 'bot'; content: string; timestamp?: string; username?: string } | null = null;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // Match pattern: [timestamp] Username said: content
        // The username can be "bot" for bot messages, or actual user names
        const messageMatch = trimmedLine.match(/^\[([^\]]+)\]\s*(.+?)\s+said:\s*(.*)$/i);

        if (messageMatch) {
            // Save previous message if exists
            if (currentMessage?.content.trim()) {
                messages.push(currentMessage);
            }

            const [, timestamp, username, messageContent] = messageMatch;
            const isBot = username.toLowerCase() === 'bot' || username.toLowerCase() === 'mimir';

            currentMessage = {
                role: isBot ? 'bot' : 'user',
                content: messageContent,
                timestamp,
                username: isBot ? 'Mimir' : username,
            };
        } else if (currentMessage) {
            // Continuation of previous message
            currentMessage.content += '\n' + trimmedLine;
        } else {
            // No pattern match and no current message - treat as standalone
            currentMessage = {
                role: 'bot',
                content: trimmedLine,
            };
        }
    }

    // Don't forget the last message
    if (currentMessage?.content.trim()) {
        messages.push(currentMessage);
    }

    // If no structured messages found, return the whole content as a single message
    if (messages.length === 0 && content.trim()) {
        messages.push({ role: 'bot', content: content.trim() });
    }

    return messages;
};

interface ChatHistoryViewProps {
    content: string;
    classes: ReturnType<typeof useClasses>;
}

const ChatHistoryView: React.FC<ChatHistoryViewProps> = ({ content, classes }) => {
    const messages = parseChatHistory(content);

    if (messages.length === 0) {
        return <p>Ingen meldingar i historikken.</p>;
    }

    return (
        <div className={classes.chatHistoryContainer}>
            {messages.map((msg, index) => (
                <div key={`chat-msg-${index}`} className={classes.chatMessage}>
                    <div className={classes.messageRole}>
                        {msg.username ?? (msg.role === 'user' ? 'Brukar' : 'Mimir')}
                        {msg.timestamp && ` [${msg.timestamp}]`}
                    </div>
                    <div className={classes.messageContent}>{msg.content}</div>
                </div>
            ))}
        </div>
    );
};

interface IPromptDialogProps {
    message: IChatMessage;
}

export const PromptDialog: React.FC<IPromptDialogProps> = ({ message }) => {
    const classes = useClasses();
    const dialogClasses = useDialogClasses();

    let prompt: string | BotResponsePrompt;
    try {
        prompt = JSON.parse(message.prompt ?? '{}') as BotResponsePrompt;
    } catch (e) {
        prompt = message.prompt ?? '';
    }

    // Build accordion items from prompt sections
    let promptAccordionItems: React.ReactNode[] = [];
    let isStringPrompt = false;

    if (typeof prompt === 'string') {
        isStringPrompt = true;
        promptAccordionItems = [
            <AccordionItem value="raw-prompt" key="raw-prompt">
                <AccordionHeader expandIconPosition="end" className={classes.accordionHeader}>
                    Prompt
                </AccordionHeader>
                <AccordionPanel className={classes.accordionPanel}>{formatParagraphTextContent(prompt)}</AccordionPanel>
            </AccordionItem>,
        ];
    } else {
        promptAccordionItems = Object.entries(prompt)
            .map(([key, value]) => {
                let isStepwiseThoughtProcess = false;
                if (key === 'externalInformation') {
                    const information = value as DependencyDetails;
                    if (information.context) {
                        const details = information.context as PlanExecutionMetadata;
                        isStepwiseThoughtProcess = details.plannerType === PlanType.Stepwise;
                    }

                    if (!isStepwiseThoughtProcess) {
                        value = information.result;
                    }
                }

                if (
                    key === 'chatMemories' &&
                    value &&
                    !(value as string).includes('User has also shared some document snippets:')
                ) {
                    value = (value as string) + '\nIngen relevante dokumentminner.';
                }

                // Filter systemPersona to show only user-friendly parts
                if (key === 'systemPersona' && value) {
                    value = extractUserFriendlySystemPersona(value as string);
                }

                // Clean up content (remove diagram request prefixes, etc.)
                if (typeof value === 'string') {
                    value = cleanupPromptContent(value, key);
                }

                // Strip redundant English prefixes (already shown as Norwegian headers)
                if (typeof value === 'string') {
                    value = stripRedundantPrefixes(value, key);
                }

                if (!value || key === 'metaPromptTemplate') return null;

                const sectionTitle = PromptSectionsNameMap[key] || key;

                return (
                    <AccordionItem value={key} key={`prompt-accordion-${key}`}>
                        <AccordionHeader expandIconPosition="end" className={classes.accordionHeader}>
                            {sectionTitle}
                        </AccordionHeader>
                        <AccordionPanel className={classes.accordionPanel}>
                            {isStepwiseThoughtProcess ? (
                                <StepwiseThoughtProcessView thoughtProcess={value as DependencyDetails} />
                            ) : key === 'chatHistory' ? (
                                <ChatHistoryView content={value as string} classes={classes} />
                            ) : (
                                formatParagraphTextContent(value as string)
                            )}
                        </AccordionPanel>
                    </AccordionItem>
                );
            })
            .filter(Boolean);
    }

    // Get keys for default open items (first item open by default)
    const defaultOpenItems = promptAccordionItems.length > 0 ? ['systemPersona'] : [];

    return (
        <Dialog>
            <DialogTrigger disableButtonEnhancement>
                <Tooltip content={'Vis prompt'} relationship="label">
                    <Button className={classes.infoButton} icon={<Info16Regular />} appearance="transparent" />
                </Tooltip>
            </DialogTrigger>
            <DialogSurface className={dialogClasses.surface}>
                <DialogBody
                    style={{
                        height: message.type !== ChatMessageType.Message || !message.prompt ? 'fit-content' : '825px',
                    }}
                >
                    <DialogTitle>Prompt</DialogTitle>
                    <DialogContent className={dialogClasses.content}>
                        <TokenUsageGraph promptView tokenUsage={message.tokenUsage ?? {}} />
                        <div className={message.prompt && !isStringPrompt ? dialogClasses.innerContent : undefined}>
                            <Accordion collapsible multiple defaultOpenItems={defaultOpenItems}>
                                {promptAccordionItems}
                            </Accordion>
                        </div>
                    </DialogContent>
                    <DialogActions position="start" className={dialogClasses.footer}>
                        <Label size="small" color="brand">
                            Vil du lære meir om prompts? Klikk{' '}
                            <Link
                                href="https://learn.microsoft.com/en-us/semantic-kernel/concepts/prompts/"
                                target="_blank"
                                rel="noreferrer"
                            >
                                her
                            </Link>
                            .
                        </Label>
                        <DialogTrigger disableButtonEnhancement>
                            <Button appearance="secondary">Lukk</Button>
                        </DialogTrigger>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
