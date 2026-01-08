// Copyright (c) Microsoft. All rights reserved.

import {
    Body1Strong,
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    Divider,
    Label,
    Link,
    SelectTabEventHandler,
    Tab,
    TabList,
    TabValue,
    Tooltip,
    makeStyles,
    mergeClasses,
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
    result = result.replace(diagramRequestPattern, key === 'chatHistory' ? '🎨 [Brukte diagramveljar] ' : '');

    // For chat history, also clean up "User said:" and "Bot said:" prefixes
    if (key === 'chatHistory') {
        result = result.replace(/User said:\s*/g, '');
        result = result.replace(/Bot said:\s*/g, '');
    }

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
});

interface IPromptDialogProps {
    message: IChatMessage;
}

export const PromptDialog: React.FC<IPromptDialogProps> = ({ message }) => {
    const classes = useClasses();
    const dialogClasses = useDialogClasses();

    const [selectedTab, setSelectedTab] = React.useState<TabValue>('formatted');
    const onTabSelect: SelectTabEventHandler = (_event, data) => {
        setSelectedTab(data.value);
    };

    let prompt: string | BotResponsePrompt;
    try {
        prompt = JSON.parse(message.prompt ?? '{}') as BotResponsePrompt;
    } catch (e) {
        prompt = message.prompt ?? '';
    }

    let promptDetails;
    if (typeof prompt === 'string') {
        promptDetails = formatParagraphTextContent(prompt);
    } else {
        promptDetails = Object.entries(prompt).map(([key, value]) => {
            let isStepwiseThoughtProcess = false;
            if (key === 'externalInformation') {
                const information = value as DependencyDetails;
                if (information.context) {
                    // TODO: [Issue #150, sk#2106] Accommodate different planner contexts once core team finishes work to return prompt and token usage.
                    const details = information.context as PlanExecutionMetadata;
                    isStepwiseThoughtProcess = details.plannerType === PlanType.Stepwise;

                    // Backend can be configured to return the raw response from Stepwise Planner. In this case, no meta prompt was generated or completed
                    // and we should show the Stepwise thought process as the raw content view.
                    if (prompt.metaPromptTemplate.length <= 0) {
                        prompt.rawView = (
                            <pre className={mergeClasses(dialogClasses.text, classes.text)}>
                                {JSON.stringify(JSON.parse(details.stepsTaken), null, 2)}
                            </pre>
                        );
                    }
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

            return value && key !== 'metaPromptTemplate' ? (
                <div className={dialogClasses.paragraphs} key={`prompt-details-${key}`}>
                    <Body1Strong>{PromptSectionsNameMap[key]}</Body1Strong>
                    {isStepwiseThoughtProcess ? (
                        <StepwiseThoughtProcessView thoughtProcess={value as DependencyDetails} />
                    ) : (
                        formatParagraphTextContent(value as string)
                    )}
                </div>
            ) : null;
        });
    }

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
                        {message.prompt && typeof prompt !== 'string' && (
                            <TabList selectedValue={selectedTab} onTabSelect={onTabSelect}>
                                <Tab data-testid="formatted" id="formatted" value="formatted">
                                    Formatert
                                </Tab>
                                <Tab data-testid="rawContent" id="rawContent" value="rawContent">
                                    Råinnhald
                                </Tab>
                            </TabList>
                        )}
                        <div
                            className={
                                message.prompt && typeof prompt !== 'string' ? dialogClasses.innerContent : undefined
                            }
                        >
                            {selectedTab === 'formatted' && promptDetails}
                            {selectedTab === 'rawContent' &&
                                ((prompt as BotResponsePrompt).metaPromptTemplate.length > 0
                                    ? (prompt as BotResponsePrompt).metaPromptTemplate.map((contextMessage, index) => {
                                          return (
                                              <div key={`context-message-${index}`}>
                                                  <p>{`Rolle: ${contextMessage.Role.Label}`}</p>
                                                  {formatParagraphTextContent(`Innhald: ${contextMessage.Content}`)}
                                                  <Divider />
                                              </div>
                                          );
                                      })
                                    : (prompt as BotResponsePrompt).rawView)}
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
