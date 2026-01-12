// Copyright (c) Microsoft. All rights reserved.

import { Badge, makeStyles, shorthands, tokens, Tooltip } from '@fluentui/react-components';
import { Bot16Regular, Sparkle16Regular } from '@fluentui/react-icons';
import * as React from 'react';
import { useModels } from '../../libs/hooks';
import { useAppSelector } from '../../redux/app/hooks';
import { RootState } from '../../redux/app/store';

const useClasses = makeStyles({
    badge: {
        display: 'inline-flex',
        alignItems: 'center',
        ...shorthands.gap(tokens.spacingHorizontalXS),
        cursor: 'default',
    },
});

/**
 * Small badge showing the current AI model for a chat.
 */
export const ModelIndicator: React.FC = () => {
    const classes = useClasses();
    const { availableModels, defaultModelId, fetchAvailableModels, getModelInfo } = useModels();
    const { conversations, selectedId } = useAppSelector((state: RootState) => state.conversations);

    // Fetch models if not already loaded
    React.useEffect(() => {
        if (availableModels.length === 0) {
            void fetchAvailableModels();
        }
    }, [availableModels.length, fetchAvailableModels]);

    const conversation = selectedId ? conversations[selectedId] : undefined;
    const currentModelId = conversation?.modelId ?? defaultModelId;
    const modelInfo = getModelInfo(currentModelId);

    if (!modelInfo) {
        return null;
    }

    const isAnthropic = modelInfo.provider === 'AzureAnthropic';
    const icon = isAnthropic ? <Sparkle16Regular /> : <Bot16Regular />;

    return (
        <Tooltip content={modelInfo.description || modelInfo.displayName} relationship="label">
            <Badge
                className={classes.badge}
                appearance="outline"
                color={isAnthropic ? 'important' : 'informative'}
                icon={icon}
            >
                {modelInfo.displayName}
            </Badge>
        </Tooltip>
    );
};
