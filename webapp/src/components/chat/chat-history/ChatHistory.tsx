// Copyright (c) Microsoft. All rights reserved.

import { makeStyles, shorthands, tokens } from '@fluentui/react-components';
import React from 'react';
import { IChatMessage } from '../../../libs/models/ChatMessage';
import { ChatHistoryItem } from './ChatHistoryItem';

const useClasses = makeStyles({
    root: {
        ...shorthands.gap(tokens.spacingVerticalM),
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '105em',
        width: '100%',
        justifySelf: 'center',
    },
    item: {
        display: 'flex',
        flexDirection: 'column',
    },
});

interface ChatHistoryProps {
    messages: IChatMessage[];
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({ messages }) => {
    const classes = useClasses();

    return (
        <div className={classes.root}>
            {messages.map((message, index) => (
                <div
                    key={message.timestamp}
                    data-message-index={index}
                    data-message-author={message.authorRole}
                    className={classes.item}
                >
                    <ChatHistoryItem message={message} messageIndex={index} />
                </div>
            ))}
        </div>
    );
};
