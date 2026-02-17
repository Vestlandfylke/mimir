// Copyright (c) Microsoft. All rights reserved.

import {
    Badge,
    Caption1,
    Card,
    CardHeader,
    makeStyles,
    mergeClasses,
    shorthands,
    Text,
    ToggleButton,
    tokens,
} from '@fluentui/react-components';
import {
    ChevronDown20Regular,
    ChevronUp20Regular,
    Document20Regular,
    Globe20Regular,
    Library20Regular,
    Scales20Regular,
    CloudArrowUp20Regular,
} from '@fluentui/react-icons';
import React, { useState } from 'react';
import { Citation, IChatMessage } from '../../../libs/models/ChatMessage';
import { customTokens } from '../../../styles';

const useClasses = makeStyles({
    root: {
        display: 'flex',
        ...shorthands.gap(customTokens.spacingVerticalS),
        flexDirection: 'column',
    },
    card: {
        display: 'flex',
        width: '100%',
        height: 'fit-content',
    },
    headerRow: {
        display: 'flex',
        alignItems: 'center',
        ...shorthands.gap(customTokens.spacingHorizontalS),
    },
    sourceTypeBadge: {
        fontSize: tokens.fontSizeBase100,
        fontWeight: tokens.fontWeightSemibold,
        paddingLeft: tokens.spacingHorizontalSNudge,
        paddingRight: tokens.spacingHorizontalSNudge,
        whiteSpace: 'nowrap',
    },
    descriptionRow: {
        display: 'flex',
        alignItems: 'center',
        ...shorthands.gap(customTokens.spacingHorizontalXS),
    },
    sourceIcon: {
        display: 'flex',
        alignItems: 'center',
    },
    snippetText: {
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
    },
    linkText: {
        color: tokens.colorBrandForeground1,
        textDecorationLine: 'none',
        ':hover': {
            textDecorationLine: 'underline',
        },
    },
});

/**
 * Returns the display color for a source type badge.
 */
const getSourceTypeBadgeColor = (
    sourceType?: string,
): 'informative' | 'success' | 'warning' | 'danger' | 'important' | 'brand' | 'subtle' => {
    switch (sourceType) {
        case 'SharePoint':
            return 'brand';
        case 'Lovdata':
            return 'warning';
        case 'Kunnskapsbase':
            return 'success';
        case 'Leiardokument':
            return 'important';
        case 'Opplasta dokument':
            return 'informative';
        default:
            return 'subtle';
    }
};

/**
 * Returns an icon for the source type.
 */
const getSourceTypeIcon = (sourceType?: string) => {
    switch (sourceType) {
        case 'SharePoint':
            return <Globe20Regular />;
        case 'Lovdata':
            return <Scales20Regular />;
        case 'Kunnskapsbase':
            return <Library20Regular />;
        case 'Leiardokument':
            return <Document20Regular />;
        case 'Opplasta dokument':
            return <CloudArrowUp20Regular />;
        default:
            return <Document20Regular />;
    }
};

interface ICitationCardsProps {
    message: IChatMessage;
}

export const CitationCards: React.FC<ICitationCardsProps> = ({ message }) => {
    const classes = useClasses();

    const [showSnippetStates, setShowSnippetStates] = useState<boolean[]>([]);
    React.useEffect(() => {
        initShowSnippetStates();
        // This will only run once, when the component is mounted
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!message.citations || message.citations.length === 0) {
        return null;
    }

    const initShowSnippetStates = () => {
        if (!message.citations) {
            return;
        }

        const newShowSnippetStates = [...showSnippetStates];
        message.citations.forEach((_, index) => {
            newShowSnippetStates[index] = false;
        });
        setShowSnippetStates(newShowSnippetStates);
    };

    const showSnippet = (index: number) => {
        const newShowSnippetStates = [...showSnippetStates];
        newShowSnippetStates[index] = !newShowSnippetStates[index];
        setShowSnippetStates(newShowSnippetStates);
    };

    const renderCitationHeader = (citation: Citation) => {
        return (
            <div className={classes.headerRow}>
                <Text weight="semibold">{citation.sourceName}</Text>
                {citation.sourceType && (
                    <Badge
                        shape="rounded"
                        appearance="tint"
                        color={getSourceTypeBadgeColor(citation.sourceType)}
                        className={classes.sourceTypeBadge}
                    >
                        {citation.sourceType}
                    </Badge>
                )}
            </div>
        );
    };

    const renderCitationDescription = (citation: Citation) => {
        return (
            <div className={classes.descriptionRow}>
                {citation.sourceType && (
                    <span className={classes.sourceIcon}>{getSourceTypeIcon(citation.sourceType)}</span>
                )}
                <Caption1>Relevanspoengsum: {citation.relevanceScore.toFixed(3)}</Caption1>
            </div>
        );
    };

    return (
        <div className={classes.root}>
            {message.citations.map((citation, index) => {
                return (
                    <Card className={classes.card} size="small" key={`citation-card-${index}`}>
                        <CardHeader
                            image={
                                <Badge shape="rounded" appearance="outline" color="informative">
                                    {index + 1}
                                </Badge>
                            }
                            header={renderCitationHeader(citation)}
                            description={renderCitationDescription(citation)}
                            action={
                                <ToggleButton
                                    appearance="transparent"
                                    icon={showSnippetStates[index] ? <ChevronUp20Regular /> : <ChevronDown20Regular />}
                                    onClick={() => {
                                        showSnippet(index);
                                    }}
                                />
                            }
                        />

                        {showSnippetStates[index] && (
                            <div>
                                <p className={classes.snippetText}>{citation.snippet}</p>
                                {citation.link && citation.link.startsWith('http') && (
                                    <Caption1>
                                        <a
                                            href={citation.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={mergeClasses(classes.linkText)}
                                        >
                                            Opne kjelde
                                        </a>
                                    </Caption1>
                                )}
                            </div>
                        )}
                    </Card>
                );
            })}
        </div>
    );
};
