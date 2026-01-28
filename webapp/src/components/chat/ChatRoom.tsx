// Copyright (c) Microsoft. All rights reserved.

import { Button, makeStyles, shorthands, Spinner, tokens } from '@fluentui/react-components';
import { ArrowDownRegular } from '@fluentui/react-icons';
import React from 'react';
import { GetResponseOptions, useChat } from '../../libs/hooks/useChat';
import { useConnectionSync } from '../../libs/hooks/useConnectionSync';
import { AuthorRoles } from '../../libs/models/ChatMessage';
import { useAppSelector } from '../../redux/app/hooks';
import { RootState } from '../../redux/app/store';
import { FeatureKeys, Features } from '../../redux/features/app/AppState';
import { ChatInput } from './ChatInput';
import { ChatHistory } from './chat-history/ChatHistory';

const useClasses = makeStyles({
    root: {
        ...shorthands.overflow('hidden'),
        display: 'flex',
        flexDirection: 'column',
        // Removed justifyContent: 'space-between' - flexGrow on children handles spacing
        // Using space-between with flex children that have flexGrow can cause layout glitches
        height: '100%',
        flex: '1 1 0%',
        // Ensure it never exceeds parent
        minHeight: 0,
    },
    scroll: {
        ...shorthands.margin(tokens.spacingVerticalXS),
        // Use flex shorthand for more reliable sizing in flex containers
        // Don't use height: '100%' with flexGrow as it causes conflicts
        flex: '1 1 0%',
        minHeight: 0, // Important for flex scroll containers
        overflowY: 'auto',
        // Custom scrollbar styling (from SharedStyles.scroll but without height: 100%)
        '&:hover': {
            '&::-webkit-scrollbar-thumb': {
                backgroundColor: tokens.colorScrollbarOverlay,
                visibility: 'visible',
            },
            '&::-webkit-scrollbar-track': {
                backgroundColor: tokens.colorNeutralBackground1,
                WebkitBoxShadow: 'inset 0 0 5px rgba(0, 0, 0, 0.1)',
                visibility: 'visible',
            },
        },
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
    scrollToBottomButton: {
        position: 'absolute',
        bottom: tokens.spacingVerticalXXL,
        right: tokens.spacingHorizontalL,
        zIndex: 100,
        boxShadow: tokens.shadow8,
        borderRadius: '50%',
        minWidth: '40px',
        width: '40px',
        height: '40px',
        padding: 0,
    },
    scrollContainer: {
        position: 'relative',
        // Use flex shorthand for more reliable cross-browser behavior
        flex: '1 1 0%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        // Ensure container always fills available space
        overflow: 'hidden',
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
    const botResponseStatus = conversation.botResponseStatus;

    // Trigger lazy loading of messages when conversation changes and messages aren't loaded
    React.useEffect(() => {
        const conv = conversation as typeof conversation | undefined;
        if (conv && !conv.userDataLoaded && conv.messages.length === 0) {
            void chat.loadChatMessages(selectedId);
        }
    }, [selectedId, conversation, chat]);

    const scrollViewTargetRef = React.useRef<HTMLDivElement>(null);
    const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true);
    const [showScrollButton, setShowScrollButton] = React.useState(false);
    // Track if we just submitted a message (to scroll once to show user's message)
    const justSubmittedRef = React.useRef(false);
    // Track previous message count to detect new messages
    const prevMessageCountRef = React.useRef(messages.length);
    // Track previous botResponseStatus to detect when Mimir starts typing
    const prevBotResponseStatusRef = React.useRef(botResponseStatus);

    const [isDraggingOver, setIsDraggingOver] = React.useState(false);
    // Use a counter to properly track drag enter/leave across nested elements
    // This prevents the "stuck" drag state when moving between child elements
    const dragCounterRef = React.useRef(0);

    const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        dragCounterRef.current++;
        if (dragCounterRef.current === 1) {
            setIsDraggingOver(true);
        }
    };

    const onDragLeave = (e: React.DragEvent<HTMLDivElement | HTMLTextAreaElement>) => {
        e.preventDefault();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) {
            setIsDraggingOver(false);
        }
    };

    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        // Ensure we're in drag state even if dragenter was missed
        if (!isDraggingOver && dragCounterRef.current > 0) {
            setIsDraggingOver(true);
        }
    };

    // Reset drag state when drop happens anywhere in the container
    const onDrop = (_e: React.DragEvent<HTMLDivElement>) => {
        // Don't prevent default here - let child handlers process the drop
        dragCounterRef.current = 0;
        setIsDraggingOver(false);
    };

    // Listen for drag end on document to reset state when drag is cancelled
    // (e.g., user presses Escape or moves cursor outside browser window)
    React.useEffect(() => {
        const resetDragState = () => {
            dragCounterRef.current = 0;
            setIsDraggingOver(false);
        };

        // Handle when drag operation ends (drop or cancel)
        document.addEventListener('dragend', resetDragState);
        // Handle drop anywhere on the document
        document.addEventListener('drop', resetDragState);

        return () => {
            document.removeEventListener('dragend', resetDragState);
            document.removeEventListener('drop', resetDragState);
        };
    }, []);

    // Helper function to scroll to the last bot message (start of response)
    const scrollToLastBotMessage = React.useCallback(() => {
        const container = scrollViewTargetRef.current;
        if (!container) return;

        // Find the last bot message element
        const botMessages = container.querySelectorAll('[data-message-author="1"]'); // 1 = Bot
        if (botMessages.length > 0) {
            const lastBotMessage = botMessages[botMessages.length - 1] as HTMLElement;
            // Scroll so the bot message is at the top of the viewport (with some padding)
            lastBotMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            // Fallback to bottom if no bot message found
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
    }, []);

    // Scroll when Mimir STARTS typing (shows "Mimir skriv")
    // This ensures user sees when the bot begins responding
    React.useEffect(() => {
        const wasNotTyping = !prevBotResponseStatusRef.current;
        const isNowTyping = !!botResponseStatus;
        prevBotResponseStatusRef.current = botResponseStatus;

        // When Mimir starts typing, scroll to show the typing indicator
        if (wasNotTyping && isNowTyping) {
            // Scroll to bottom initially to show typing indicator
            const container = scrollViewTargetRef.current;
            if (container) {
                container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            }
        }

        // When Mimir STOPS typing (response is complete), scroll to start of bot response
        const wasTyping = !!prevBotResponseStatusRef.current;
        const isNowNotTyping = !botResponseStatus;
        if (wasTyping && isNowNotTyping && messages.length > 0) {
            // Small delay to ensure the message is rendered
            setTimeout(() => {
                scrollToLastBotMessage();
                setShouldAutoScroll(false); // Let user read
            }, 100);
        }
    }, [botResponseStatus, messages.length, scrollToLastBotMessage]);

    // Smarter scroll behavior when messages change
    React.useEffect(() => {
        const container = scrollViewTargetRef.current;
        if (!container) return;

        const messageCountChanged = messages.length !== prevMessageCountRef.current;
        const prevCount = prevMessageCountRef.current;
        prevMessageCountRef.current = messages.length;

        // If user just submitted a message, scroll to show their message
        if (justSubmittedRef.current && messageCountChanged) {
            justSubmittedRef.current = false;
            // Scroll to bottom to show user's message
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            return;
        }

        // If a new message was added and it's a bot message, scroll to its start
        if (messageCountChanged && messages.length > prevCount) {
            const lastMessage = messages[messages.length - 1];
            // Check if it's a bot message (AuthorRoles.Bot = 1)
            if (lastMessage.authorRole === AuthorRoles.Bot) {
                // Small delay to ensure the message is rendered
                setTimeout(() => {
                    scrollToLastBotMessage();
                    setShouldAutoScroll(false);
                }, 100);
                return;
            }
        }

        // Only auto-scroll if user is actively at the bottom (opted in)
        // This prevents scrolling when user is reading earlier content
        if (shouldAutoScroll) {
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, shouldAutoScroll, scrollToLastBotMessage]);

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
        setShowScrollButton(false);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [selectedId]);

    // Track scroll position to show/hide scroll-to-bottom button
    React.useEffect(() => {
        const onScroll = () => {
            if (!scrollViewTargetRef.current) return;
            const { scrollTop, scrollHeight, clientHeight } = scrollViewTargetRef.current;

            // Use a larger threshold (100px) to be more forgiving
            // This prevents auto-scroll from kicking in when user scrolls up slightly
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            const isAtBottom = distanceFromBottom < 100;

            setShouldAutoScroll(isAtBottom);
            // Show scroll button when user is more than 300px from bottom
            setShowScrollButton(distanceFromBottom > 300);
        };

        if (!scrollViewTargetRef.current) return;

        const currentScrollViewTarget = scrollViewTargetRef.current;

        currentScrollViewTarget.addEventListener('scroll', onScroll);
        return () => {
            currentScrollViewTarget.removeEventListener('scroll', onScroll);
        };
    }, []);

    const scrollToBottom = () => {
        scrollViewTargetRef.current?.scrollTo({ top: scrollViewTargetRef.current.scrollHeight, behavior: 'smooth' });
        setShouldAutoScroll(true);
        setShowScrollButton(false);
    };

    const handleSubmit = async (options: GetResponseOptions) => {
        justSubmittedRef.current = true;
        setShouldAutoScroll(true); // Enable scroll for initial response
        await chat.getResponse(options);
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
        <div
            className={classes.root}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <div className={classes.scrollContainer}>
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
                {showScrollButton && (
                    <Button
                        className={classes.scrollToBottomButton}
                        icon={<ArrowDownRegular />}
                        appearance="secondary"
                        onClick={scrollToBottom}
                        title="Scroll til botn"
                    />
                )}
            </div>
            <div className={classes.input}>
                <ChatInput isDraggingOver={isDraggingOver} onDragLeave={onDragLeave} onSubmit={handleSubmit} />
            </div>
        </div>
    );
};
