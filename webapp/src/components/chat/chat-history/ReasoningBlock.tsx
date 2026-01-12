// Copyright (c) Microsoft. All rights reserved.

import {
    Accordion,
    AccordionHeader,
    AccordionItem,
    AccordionPanel,
    makeStyles,
    shorthands,
    tokens,
} from '@fluentui/react-components';
import { Brain24Regular, ChevronDown16Regular } from '@fluentui/react-icons';
import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const useClasses = makeStyles({
    container: {
        marginBottom: tokens.spacingVerticalM,
    },
    accordionItem: {
        ...shorthands.borderRadius('8px'),
        backgroundColor: tokens.colorNeutralBackground3,
        ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
    },
    accordionHeader: {
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    },
    headerContent: {
        display: 'flex',
        alignItems: 'center',
        ...shorthands.gap(tokens.spacingHorizontalS),
        color: tokens.colorNeutralForeground2,
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightSemibold,
    },
    brainIcon: {
        color: tokens.colorBrandForeground1,
    },
    panel: {
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
        ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke1),
        backgroundColor: tokens.colorNeutralBackground2,
        ...shorthands.borderRadius('0', '0', '8px', '8px'),
    },
    reasoningContent: {
        fontSize: tokens.fontSizeBase200,
        lineHeight: '1.5',
        color: tokens.colorNeutralForeground2,
        '& p': {
            marginTop: 0,
            marginBottom: tokens.spacingVerticalS,
        },
        '& p:last-child': {
            marginBottom: 0,
        },
        '& ol, & ul': {
            marginTop: 0,
            marginBottom: tokens.spacingVerticalS,
            paddingLeft: tokens.spacingHorizontalL,
        },
        '& li': {
            marginBottom: tokens.spacingVerticalXS,
        },
        '& code': {
            ...shorthands.padding('1px', '4px'),
            ...shorthands.borderRadius('4px'),
            backgroundColor: tokens.colorNeutralBackground4,
            fontFamily: 'monospace',
            fontSize: '0.9em',
        },
    },
    thinkingLabel: {
        display: 'flex',
        alignItems: 'center',
        ...shorthands.gap(tokens.spacingHorizontalXS),
    },
    pulseAnimation: {
        animationName: {
            '0%': { opacity: 0.5 },
            '50%': { opacity: 1 },
            '100%': { opacity: 0.5 },
        },
        animationDuration: '1.5s',
        animationIterationCount: 'infinite',
        animationTimingFunction: 'ease-in-out',
    },
});

interface ReasoningBlockProps {
    reasoning: string;
    isStreaming?: boolean;
}

/**
 * ReasoningBlock displays the AI's reasoning/thinking process in a collapsible accordion.
 * Similar to how Cursor and other AI chat apps show the model's thought process.
 */
export const ReasoningBlock: React.FC<ReasoningBlockProps> = memo(({ reasoning, isStreaming = false }) => {
    const classes = useClasses();

    if (!reasoning || reasoning.trim().length === 0) {
        return null;
    }

    // When streaming, expand by default so users can see the thinking process in real-time
    // When done, collapse by default to save space
    const defaultOpenItems = isStreaming ? ['reasoning'] : [];

    return (
        <div className={classes.container}>
            <Accordion collapsible defaultOpenItems={defaultOpenItems}>
                <AccordionItem value="reasoning" className={classes.accordionItem}>
                    <AccordionHeader expandIcon={<ChevronDown16Regular />} className={classes.accordionHeader}>
                        <div className={classes.headerContent}>
                            <Brain24Regular className={classes.brainIcon} />
                            <span className={isStreaming ? classes.pulseAnimation : undefined}>
                                {isStreaming ? 'Tenkjer...' : 'Vis tankeprosessen'}
                            </span>
                        </div>
                    </AccordionHeader>
                    <AccordionPanel className={classes.panel}>
                        <div className={classes.reasoningContent}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{reasoning}</ReactMarkdown>
                        </div>
                    </AccordionPanel>
                </AccordionItem>
            </Accordion>
        </div>
    );
});

ReasoningBlock.displayName = 'ReasoningBlock';
