// Copyright (c) Microsoft. All rights reserved.

import { makeStyles, shorthands, tokens } from '@fluentui/react-components';
import React from 'react';
import { IChatUser } from '../../libs/models/ChatUser';
import { useAppSelector } from '../../redux/app/hooks';
import { RootState } from '../../redux/app/store';
import { TypingIndicator } from './typing-indicator/TypingIndicator';

const useClasses = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        ...shorthands.gap(tokens.spacingHorizontalXS),
        // Simple CSS animation instead of @fluentui/react-northstar Animation
        // which can cause layout glitches
        animationName: {
            from: {
                opacity: 0,
                transform: 'translateY(0.5rem)',
            },
            to: {
                opacity: 1,
                transform: 'translateY(0)',
            },
        },
        animationDuration: '0.2s',
        animationTimingFunction: 'ease-out',
        animationFillMode: 'forwards',
    },
});

export const ChatStatus: React.FC = () => {
    const classes = useClasses();

    const { conversations, selectedId } = useAppSelector((state: RootState) => state.conversations);
    const { users } = conversations[selectedId];
    const { activeUserInfo } = useAppSelector((state: RootState) => state.app);
    const [typingUserList, setTypingUserList] = React.useState<IChatUser[]>([]);

    React.useEffect(() => {
        const checkAreTyping = () => {
            const updatedTypingUsers: IChatUser[] = users.filter(
                (chatUser: IChatUser) => chatUser.id !== activeUserInfo?.id && chatUser.isTyping,
            );

            setTypingUserList(updatedTypingUsers);
        };
        checkAreTyping();
    }, [activeUserInfo, users]);

    let message = conversations[selectedId].botResponseStatus;
    const numberOfUsersTyping = typingUserList.length;
    if (numberOfUsersTyping === 1) {
        message = message ? `${message} og ein brukar skriv` : 'Ein brukar skriv';
    } else if (numberOfUsersTyping > 1) {
        message = message
            ? `${message} og ${numberOfUsersTyping} brukarar skriv`
            : `${numberOfUsersTyping} brukarar skriv`;
    }

    if (!message) {
        return null;
    }

    return (
        <div className={classes.root}>
            <label>{message}</label>
            <TypingIndicator />
        </div>
    );
};
