// Copyright (c) Microsoft. All rights reserved.

import { makeStyles, shorthands, Spinner, tokens } from '@fluentui/react-components';
import React from 'react';
import { GetResponseOptions, useChat } from '../../libs/hooks/useChat';
import { useConnectionSync } from '../../libs/hooks/useConnectionSync';
import { logger } from '../../libs/utils/Logger';
import { useAppSelector } from '../../redux/app/hooks';
import { RootState } from '../../redux/app/store';
import { FeatureKeys, Features } from '../../redux/features/app/AppState';
import { SharedStyles } from '../../styles';
import { ChatInput } from './ChatInput';
import { ChatHistory } from './chat-history/ChatHistory';

const useClasses = makeStyles({
    root: {
        ...shorthands.overflow('hidden'),
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        flexGrow: 1,
        // Ensure it never exceeds parent
        minHeight: 0,
    },
    scroll: {
        ...shorthands.margin(tokens.spacingVerticalXS),
        ...SharedStyles.scroll,
        flexGrow: 1,
        flexShrink: 1,
        minHeight: 0, // Important for flex scroll containers
        // Ensure proper scrolling on mobile
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain', // Prevent scroll chaining
    },
    history: {
        ...shorthands.padding(tokens.spacingVerticalM),
        paddingLeft: tokens.spacingHorizontalM,
        paddingRight: tokens.spacingHorizontalM,
        display: 'flex',
        justifyContent: 'center',
    },
    input: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        flexShrink: 0, // Don't shrink the input area
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingVerticalNone),
        // Add safe area padding for iPhone home indicator
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
    },
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: tokens.spacingVerticalM,
    },
    loadingText: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase300,
    },
});

export const ChatRoom: React.FC = () => {
    const classes = useClasses();
    const chat = useChat();

    // Automatically sync messages when connection is restored
    useConnectionSync();

    const { conversations, selectedId } = useAppSelector((state: RootState) => state.conversations);
    const conversation = conversations[selectedId];
    // Use the messages array directly from the conversation to ensure reactivity
    const messages = conversation.messages;

    // Debug logging for message updates
    React.useEffect(() => {
        logger.debug(`📋 ChatRoom: messages updated, count: ${messages.length}`);
    }, [messages.length]);

    // Trigger lazy loading of messages when conversation changes and messages aren't loaded
    React.useEffect(() => {
        const conv = conversation as typeof conversation | undefined;
        if (conv && !conv.userDataLoaded && conv.messages.length === 0) {
            logger.debug(`📋 ChatRoom: Triggering lazy load for chat ${selectedId}`);
            void chat.loadChatMessages(selectedId);
        }
    }, [selectedId, conversation, chat]);

    const scrollViewTargetRef = React.useRef<HTMLDivElement>(null);
    const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true);

    const [isDraggingOver, setIsDraggingOver] = React.useState(false);
    const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingOver(true);
    };
    const onDragLeave = (e: React.DragEvent<HTMLDivElement | HTMLTextAreaElement>) => {
        e.preventDefault();
        setIsDraggingOver(false);
    };

    // Scroll to bottom when messages change (if auto-scroll is enabled)
    React.useEffect(() => {
        if (!shouldAutoScroll) return;
        scrollViewTargetRef.current?.scrollTo(0, scrollViewTargetRef.current.scrollHeight);
    }, [messages, shouldAutoScroll]);

    // Scroll to bottom on initial load and when conversation changes
    React.useEffect(() => {
        // Use requestAnimationFrame to ensure DOM is ready
        const scrollToBottom = () => {
            if (scrollViewTargetRef.current) {
                scrollViewTargetRef.current.scrollTo(0, scrollViewTargetRef.current.scrollHeight);
            }
        };

        // Immediate scroll
        scrollToBottom();

        // Also schedule after a short delay to handle any async rendering
        const timeoutId = setTimeout(scrollToBottom, 100);

        // Reset auto-scroll on conversation change
        setShouldAutoScroll(true);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [selectedId]);

    React.useEffect(() => {
        const onScroll = () => {
            if (!scrollViewTargetRef.current) return;
            const { scrollTop, scrollHeight, clientHeight } = scrollViewTargetRef.current;
            const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
            setShouldAutoScroll(isAtBottom);
        };

        if (!scrollViewTargetRef.current) return;

        const currentScrollViewTarget = scrollViewTargetRef.current;

        currentScrollViewTarget.addEventListener('scroll', onScroll);
        return () => {
            currentScrollViewTarget.removeEventListener('scroll', onScroll);
        };
    }, []);

    const handleSubmit = async (options: GetResponseOptions) => {
        await chat.getResponse(options);
        setShouldAutoScroll(true);
    };

    if (conversations[selectedId].hidden) {
        return (
            <div className={classes.root}>
                <div className={classes.scroll}>
                    <div className={classes.history}>
                        <h3>
                            Denne samtalen er ikkje synleg i appen fordi {Features[FeatureKeys.MultiUserChat].label} er
                            deaktivert. Vennlegst aktiver funksjonen i innstillingane for å sjå samtalen, vel ein annan,
                            eller lag ein ny samtale.
                        </h3>
                    </div>
                </div>
            </div>
        );
    }

    // Show loading state when messages haven't been loaded yet (lazy loading)
    const isLoadingMessages = !conversation.userDataLoaded && messages.length === 0;

    return (
        <div className={classes.root} onDragEnter={onDragEnter} onDragOver={onDragEnter} onDragLeave={onDragLeave}>
            <div ref={scrollViewTargetRef} className={classes.scroll}>
                <div className={classes.history}>
                    {isLoadingMessages ? (
                        <div className={classes.loadingContainer}>
                            <Spinner size="medium" />
                            <span className={classes.loadingText}>Lastar meldingar...</span>
                        </div>
                    ) : (
                        <ChatHistory messages={messages} />
                    )}
                </div>
            </div>
            <div className={classes.input}>
                <ChatInput isDraggingOver={isDraggingOver} onDragLeave={onDragLeave} onSubmit={handleSubmit} />
            </div>
        </div>
    );
};
