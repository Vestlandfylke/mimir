// Copyright (c) Microsoft. All rights reserved.

import {
    AvatarProps,
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    Menu,
    MenuItem,
    MenuList,
    MenuPopover,
    MenuTrigger,
    Persona,
    Text,
    ToggleButton,
    Tooltip,
    makeStyles,
    mergeClasses,
    shorthands,
} from '@fluentui/react-components';
import {
    ChevronDown20Regular,
    ChevronUp20Regular,
    Clipboard20Regular,
    ClipboardTask20Regular,
    Delete20Regular,
    Image20Regular,
    ThumbDislikeFilled,
    ThumbLikeFilled,
} from '@fluentui/react-icons';
import * as htmlToImage from 'html-to-image';
import React, { useRef, useState } from 'react';
import { useChat } from '../../../libs/hooks/useChat';
import { AuthorRoles, ChatMessageType, IChatMessage, UserFeedback } from '../../../libs/models/ChatMessage';
import { useAppSelector } from '../../../redux/app/hooks';
import { RootState } from '../../../redux/app/store';
import { DefaultChatUser, FeatureKeys } from '../../../redux/features/app/AppState';
import { Breakpoints, customTokens } from '../../../styles';
import { timestampToDateString } from '../../utils/TextUtils';
import { PlanViewer } from '../plan-viewer/PlanViewer';
import { PromptDialog } from '../prompt-dialog/PromptDialog';
import { TypingIndicator } from '../typing-indicator/TypingIndicator';
import * as utils from './../../utils/TextUtils';
import { ChatHistoryDocumentContent } from './ChatHistoryDocumentContent';
import { ChatHistoryTextContent } from './ChatHistoryTextContent';
import { CitationCards } from './CitationCards';
import { ReasoningBlock } from './ReasoningBlock';
import { UserFeedbackActions } from './UserFeedbackActions';

const useClasses = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'row',
        maxWidth: '75%',
        minWidth: '24em',
        ...shorthands.borderRadius(customTokens.borderRadiusMedium),
        ...Breakpoints.small({
            maxWidth: '100%',
            minWidth: 'unset',
        }),
        ...shorthands.gap(customTokens.spacingHorizontalXS),
    },
    debug: {
        position: 'absolute',
        top: '-4px',
        right: '-4px',
    },
    alignEnd: {
        alignSelf: 'flex-end',
    },
    persona: {
        paddingTop: customTokens.spacingVerticalS,
    },
    item: {
        ...shorthands.borderRadius(customTokens.borderRadiusMedium),
        ...shorthands.padding(customTokens.spacingVerticalXS, customTokens.spacingHorizontalS),
        // Allow the bubble to shrink within the row and wrap long strings instead of expanding page width
        minWidth: 0,
        maxWidth: '100%',
        overflowX: 'hidden',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
    },
    me: {
        // Fill remaining space next to the avatar without forcing overflow
        flexGrow: 1,
        minWidth: 0,
    },
    time: {
        color: customTokens.colorNeutralForeground3,
        fontSize: customTokens.fontSizeBase200,
        fontWeight: 400,
    },
    header: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'row',
        ...shorthands.gap(customTokens.spacingHorizontalL),
        minWidth: 0,
        maxWidth: '100%',
    },
    canvas: {
        width: '100%',
        textAlign: 'center',
    },
    image: {
        maxWidth: '250px',
    },
    blur: {
        filter: 'blur(5px)',
    },
    controls: {
        display: 'flex',
        flexDirection: 'row',
        marginTop: customTokens.spacingVerticalS,
        marginBottom: customTokens.spacingVerticalS,
        ...shorthands.gap(customTokens.spacingHorizontalL),
    },
    citationButton: {
        marginRight: 'auto',
    },
    rlhf: {
        marginLeft: 'auto',
    },
});

interface ChatHistoryItemProps {
    message: IChatMessage;
    messageIndex: number;
}

export const ChatHistoryItem: React.FC<ChatHistoryItemProps> = ({ message, messageIndex }) => {
    const classes = useClasses();
    const chat = useChat();
    const messageRef = useRef<HTMLDivElement>(null);

    const { conversations, selectedId } = useAppSelector((state: RootState) => state.conversations);
    const { activeUserInfo, features } = useAppSelector((state: RootState) => state.app);
    const [showCitationCards, setShowCitationCards] = useState(false);

    const isDefaultUser = message.userId === DefaultChatUser.id;
    const isMe = isDefaultUser || (message.authorRole === AuthorRoles.User && message.userId === activeUserInfo?.id);
    const isBot = message.authorRole === AuthorRoles.Bot;
    const user = isDefaultUser
        ? DefaultChatUser
        : chat.getChatUserById(message.userName, selectedId, conversations[selectedId].users);
    const fullName = user?.fullName ?? message.userName;

    const [messagedCopied, setMessageCopied] = useState(false);
    const [imageCopied, setImageCopied] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteMessage = async () => {
        if (!message.id) return;
        setIsDeleting(true);
        try {
            await chat.deleteMessage(selectedId, message.id);
        } finally {
            setIsDeleting(false);
        }
    };

    const copyTextOnClick = async () => {
        await navigator.clipboard.writeText(message.content).then(() => {
            setMessageCopied(true);
            setTimeout(() => {
                setMessageCopied(false);
            }, 2000);
        });
    };

    const copyImageOnClick = async () => {
        if (!messageRef.current) return;

        try {
            // Capture the message element as a PNG blob
            const dataUrl = await htmlToImage.toPng(messageRef.current, {
                backgroundColor: features[FeatureKeys.DarkMode].enabled ? '#1f1f1f' : '#f5f5f5',
                pixelRatio: 2, // Higher quality
            });

            // Convert data URL to blob
            const response = await fetch(dataUrl);
            const blob = await response.blob();

            // Copy to clipboard
            await navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob,
                }),
            ]);

            setImageCopied(true);
            setTimeout(() => {
                setImageCopied(false);
            }, 2000);
        } catch (error) {
            console.error('Failed to copy image:', error);
        }
    };

    const avatar: AvatarProps = isBot
        ? { image: { src: conversations[selectedId].botProfilePicture } }
        : isDefaultUser
          ? { idForColor: selectedId, color: 'colorful' }
          : { name: fullName, color: 'colorful' };

    // Check if this is a bot message that is still streaming
    // Content streaming: content is empty (waiting for response)
    // Reasoning streaming: has reasoning but content hasn't started yet
    const isContentStreaming = isBot && message.content.length === 0;
    const isReasoningStreaming = isBot && !!message.reasoning && message.content.length === 0;

    let content: JSX.Element;
    if (isBot && message.type === ChatMessageType.Plan) {
        content = <PlanViewer message={message} messageIndex={messageIndex} />;
    } else if (message.type === ChatMessageType.Document) {
        content = <ChatHistoryDocumentContent isMe={isMe} message={message} />;
    } else {
        // For bot messages, show reasoning block above content if available
        const reasoningBlock =
            isBot && message.reasoning ? (
                <ReasoningBlock reasoning={message.reasoning} isStreaming={isReasoningStreaming} />
            ) : null;

        // Show typing indicator only when content hasn't started AND no reasoning yet
        // When reasoning is streaming, show the reasoning block instead of typing indicator
        const mainContent =
            isContentStreaming && !message.reasoning ? (
                <TypingIndicator showText />
            ) : isContentStreaming && message.reasoning ? null : ( // Just show reasoning block, no typing indicator needed
                <ChatHistoryTextContent message={message} />
            );

        content = (
            <>
                {reasoningBlock}
                {mainContent}
            </>
        );
    }

    // TODO: [Issue #42] Persistent RLHF, hook up to model
    // Currently for demonstration purposes only, no feedback is actually sent to kernel / model
    const showShowRLHFMessage =
        features[FeatureKeys.RLHF].enabled &&
        message.userFeedback === UserFeedback.Requested &&
        messageIndex === conversations[selectedId].messages.length - 1 &&
        message.userId === 'Bot';

    const messageCitations = message.citations ?? [];
    const showMessageCitation = messageCitations.length > 0;
    const showExtra = showMessageCitation || showShowRLHFMessage || showCitationCards;

    return (
        <div
            className={isMe ? mergeClasses(classes.root, classes.alignEnd) : classes.root}
            // The following data attributes are needed for CI and testing
            data-testid={`chat-history-item-${messageIndex}`}
            data-username={fullName}
            data-content={utils.formatChatTextContent(message.content)}
        >
            {
                <Persona
                    className={classes.persona}
                    avatar={avatar}
                    presence={
                        !features[FeatureKeys.SimplifiedExperience].enabled && !isMe
                            ? { status: 'available' }
                            : undefined
                    }
                />
            }
            <div
                ref={messageRef}
                className={isMe ? mergeClasses(classes.item, classes.me) : classes.item}
                style={{
                    backgroundColor: isMe
                        ? features[FeatureKeys.DarkMode].enabled
                            ? '#3c3c3c'
                            : '#e8ebf9'
                        : features[FeatureKeys.DarkMode].enabled
                          ? '#333333'
                          : '#ffffff',
                }}
            >
                <div className={classes.header}>
                    {!isMe && <Text weight="semibold">{fullName}</Text>}
                    <Text className={classes.time}>{timestampToDateString(message.timestamp, true)}</Text>
                    <span
                        data-tour={isBot ? 'message-actions' : undefined}
                        style={{ display: 'inline-flex', gap: '4px', marginLeft: 'auto' }}
                    >
                        {isBot && <PromptDialog message={message} />}
                        <Menu>
                            <MenuTrigger disableButtonEnhancement>
                                <Tooltip
                                    content={
                                        messagedCopied ? 'Tekst kopiert!' : imageCopied ? 'Bilete kopiert!' : 'Kopier'
                                    }
                                    relationship="label"
                                >
                                    <Button
                                        icon={
                                            messagedCopied || imageCopied ? (
                                                <ClipboardTask20Regular />
                                            ) : (
                                                <Clipboard20Regular />
                                            )
                                        }
                                        appearance="transparent"
                                    />
                                </Tooltip>
                            </MenuTrigger>
                            <MenuPopover>
                                <MenuList>
                                    <MenuItem
                                        icon={<Clipboard20Regular />}
                                        onClick={() => {
                                            void copyTextOnClick();
                                        }}
                                    >
                                        Kopier tekst
                                    </MenuItem>
                                    <MenuItem
                                        icon={<Image20Regular />}
                                        onClick={() => {
                                            void copyImageOnClick();
                                        }}
                                    >
                                        Kopier som bilete
                                    </MenuItem>
                                </MenuList>
                            </MenuPopover>
                        </Menu>
                        {/* Don't show delete button for the initial bot message */}
                        {messageIndex > 0 && (
                            <Dialog>
                                <DialogTrigger disableButtonEnhancement>
                                    <Tooltip content="Slett melding" relationship="label">
                                        <Button
                                            icon={<Delete20Regular />}
                                            appearance="transparent"
                                            disabled={isDeleting}
                                        />
                                    </Tooltip>
                                </DialogTrigger>
                                <DialogSurface>
                                    <DialogBody>
                                        <DialogTitle>Slett melding</DialogTitle>
                                        <DialogContent>
                                            Er du sikker på at du vil slette denne meldinga? Dette kan ikkje angrast.
                                        </DialogContent>
                                        <DialogActions>
                                            <DialogTrigger disableButtonEnhancement>
                                                <Button appearance="secondary">Avbryt</Button>
                                            </DialogTrigger>
                                            <DialogTrigger disableButtonEnhancement>
                                                <Button
                                                    appearance="primary"
                                                    onClick={() => {
                                                        void handleDeleteMessage();
                                                    }}
                                                >
                                                    Slett
                                                </Button>
                                            </DialogTrigger>
                                        </DialogActions>
                                    </DialogBody>
                                </DialogSurface>
                            </Dialog>
                        )}
                    </span>
                </div>
                {content}
                {showExtra && (
                    <div className={classes.controls}>
                        {showMessageCitation && (
                            <ToggleButton
                                appearance="subtle"
                                checked={showCitationCards}
                                className={classes.citationButton}
                                icon={showCitationCards ? <ChevronUp20Regular /> : <ChevronDown20Regular />}
                                iconPosition="after"
                                onClick={() => {
                                    setShowCitationCards(!showCitationCards);
                                }}
                                size="small"
                            >
                                {`${messageCitations.length} ${messageCitations.length === 1 ? 'sitat' : 'sitater'}`}
                            </ToggleButton>
                        )}
                        {showShowRLHFMessage && (
                            <div className={classes.rlhf}>{<UserFeedbackActions messageIndex={messageIndex} />}</div>
                        )}
                        {showCitationCards && <CitationCards message={message} />}
                    </div>
                )}
            </div>
            {features[FeatureKeys.RLHF].enabled && message.userFeedback === UserFeedback.Positive && (
                <ThumbLikeFilled color="gray" />
            )}
            {features[FeatureKeys.RLHF].enabled && message.userFeedback === UserFeedback.Negative && (
                <ThumbDislikeFilled color="gray" />
            )}
        </div>
    );
};
