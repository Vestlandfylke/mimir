// Copyright (c) Microsoft. All rights reserved.
import { useMsal } from '@azure/msal-react';
import {
    Button,
    Spinner,
    Textarea,
    Tooltip,
    makeStyles,
    mergeClasses,
    shorthands,
    tokens,
} from '@fluentui/react-components';
import { AttachRegular, DeleteRegular, MicRegular, SendRegular } from '@fluentui/react-icons';
import debug from 'debug';
import * as speechSdk from 'microsoft-cognitiveservices-speech-sdk';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BsStopFill } from 'react-icons/bs';
import { Constants } from '../../Constants';
import { COPY } from '../../assets/strings';
import { AuthHelper } from '../../libs/auth/AuthHelper';
import { useFile } from '../../libs/hooks';
import { GetResponseOptions } from '../../libs/hooks/useChat';
import { AlertType } from '../../libs/models/AlertType';
import { AuthorRoles, ChatMessageType } from '../../libs/models/ChatMessage';
import { chatRequestQueue } from '../../libs/services/ChatRequestQueue';
import { ChatService } from '../../libs/services/ChatService';
import { useAppDispatch, useAppSelector } from '../../redux/app/hooks';
import { RootState } from '../../redux/app/store';
import { addAlert } from '../../redux/features/app/appSlice';
import { editConversationInput, updateBotResponseStatus } from '../../redux/features/conversations/conversationsSlice';
import { Alerts } from '../shared/Alerts';
import { getErrorDetails } from '../utils/TextUtils';
import { SpeechService } from './../../libs/services/SpeechService';
import { updateUserIsTyping } from './../../redux/features/conversations/conversationsSlice';
import { ChatStatus } from './ChatStatus';
import { DiagramType, DiagramTypeSelector } from './DiagramTypeSelector';

const log = debug(Constants.debug.root).extend('chat-input');

// Auto-resize height thresholds
const MIN_TEXTAREA_HEIGHT = 52; // Single line height
const MAX_TEXTAREA_HEIGHT = 200; // Maximum expanded height

const useClasses = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '48rem', // Narrower like Claude.ai (~768px)
        ...shorthands.margin(tokens.spacingVerticalNone, 'auto'), // Center horizontally
        ...shorthands.padding(tokens.spacingVerticalNone, tokens.spacingHorizontalM),
        '@media (max-width: 744px)': {
            maxWidth: '100%',
            ...shorthands.padding(tokens.spacingVerticalNone, tokens.spacingHorizontalS),
        },
    },
    typingIndicator: {
        maxHeight: '28px',
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
    },
    inputWrapper: {
        position: 'relative',
        width: '100%',
        ...shorthands.borderRadius(tokens.borderRadiusXLarge),
        backgroundColor: tokens.colorNeutralBackground3,
        ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
        ...shorthands.overflow('hidden'), // Clip content at rounded corners
        transitionProperty: 'border-color, box-shadow',
        transitionDuration: '0.1s',
        transitionTimingFunction: 'ease',
        '&:hover': {
            ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1Hover),
        },
        '&:focus-within': {
            ...shorthands.border('1px', 'solid', tokens.colorBrandStroke1),
            boxShadow: `0 0 0 1px ${tokens.colorBrandStroke1}`,
        },
    },
    input: {
        width: '100%',
        // Remove all borders from Fluent UI Textarea - outer wrapper has the border
        ...shorthands.border('none'),
        '& textarea': {
            ...shorthands.border('none'),
            backgroundColor: 'transparent',
            resize: 'none',
            ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
            paddingBottom: tokens.spacingVerticalXS,
            // Remove focus outline - we show focus on the wrapper instead
            '&:focus, &:focus-visible': {
                ...shorthands.outline('none'),
            },
        },
        // Remove all Fluent UI internal borders - we use inputWrapper for border styling
        '& .fui-Textarea__root, & .fui-Textarea, & > span': {
            ...shorthands.border('none'),
            backgroundColor: 'transparent',
        },
        // Hide Fluent UI's ::after and ::before border indicators in ALL states
        '& span::after, & span::before, & .fui-Textarea::after, & .fui-Textarea::before': {
            display: 'none !important',
            border: 'none !important',
            height: '0 !important',
            width: '0 !important',
        },
    },
    textarea: {
        // Height is controlled via inline styles for auto-resize
        // Custom scrollbar styling
        '&::-webkit-scrollbar': {
            width: '6px',
        },
        '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
            backgroundColor: tokens.colorNeutralStroke1,
            ...shorthands.borderRadius('3px'),
        },
        '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: tokens.colorNeutralStroke1Hover,
        },
        '@media (max-width: 744px)': {
            fontSize: tokens.fontSizeBase300,
        },
    },
    controls: {
        display: 'flex',
        flexDirection: 'row',
        ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalS),
        paddingTop: '0',
    },
    essentials: {
        display: 'flex',
        flexDirection: 'row',
        marginLeft: 'auto', // align to right
        alignItems: 'center',
    },
    functional: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
    },
    queueInfo: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        ...shorthands.gap(tokens.spacingHorizontalS),
        marginBottom: tokens.spacingVerticalXS,
        flexWrap: 'wrap',
    },
    queuedItem: {
        display: 'flex',
        alignItems: 'center',
        ...shorthands.gap(tokens.spacingHorizontalXS),
        backgroundColor: tokens.colorNeutralBackground4,
        ...shorthands.padding(tokens.spacingVerticalXXS, tokens.spacingHorizontalS),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
    },
    cancelQueueBtn: {
        minWidth: 'unset',
        ...shorthands.padding('2px'),
    },
    stopButton: {
        color: tokens.colorPaletteRedForeground1,
        '&:hover': {
            color: tokens.colorPaletteRedForeground2,
            backgroundColor: tokens.colorNeutralBackground1Hover,
        },
    },
    hiddenFileInput: {
        display: 'none',
    },
    dragAndDrop: {
        ...shorthands.border(tokens.strokeWidthThick, ' solid', tokens.colorBrandStroke1),
        ...shorthands.padding('8px'),
        textAlign: 'center',
        backgroundColor: tokens.colorNeutralBackgroundInvertedDisabled,
        fontSize: tokens.fontSizeBase300,
        color: tokens.colorBrandForeground1,
        caretColor: 'transparent',
    },
});

interface ChatInputProps {
    isDraggingOver?: boolean;
    onDragLeave: React.DragEventHandler<HTMLDivElement | HTMLTextAreaElement>;
    onSubmit: (options: GetResponseOptions) => Promise<void>;
}

export const ChatInput: React.FC<ChatInputProps> = ({ isDraggingOver, onDragLeave, onSubmit }) => {
    const classes = useClasses();
    const { instance, inProgress } = useMsal();
    const dispatch = useAppDispatch();
    const { conversations, selectedId } = useAppSelector((state: RootState) => state.conversations);
    const { activeUserInfo } = useAppSelector((state: RootState) => state.app);
    const fileHandler = useFile();

    const [value, setValue] = useState('');
    const [recognizer, setRecognizer] = useState<speechSdk.SpeechRecognizer>();
    const [isListening, setIsListening] = useState(false);
    const [selectedDiagramType, setSelectedDiagramType] = useState<DiagramType | null>(null);
    const { importingDocuments } = conversations[selectedId];

    // Queue info state
    const [queueLength, setQueueLength] = useState(0);
    const [queuedRequests, setQueuedRequests] = useState<Array<{ id: string; chatId: string }>>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // Local state to track when we're waiting for a response
    const [waitingForResponse, setWaitingForResponse] = useState(false);

    // Subscribe to queue state changes
    useEffect(() => {
        const updateQueueState = () => {
            setQueueLength(chatRequestQueue.getQueueLength());
            setQueuedRequests(chatRequestQueue.getQueuedRequests());
            setIsProcessing(chatRequestQueue.isCurrentlyProcessing());
        };

        // Check immediately
        updateQueueState();

        // Subscribe to changes
        const unsubscribe = chatRequestQueue.subscribe(updateQueueState);
        return () => {
            unsubscribe();
        };
    }, []);

    // Clear waitingForResponse when we receive a bot message
    useEffect(() => {
        const messages = conversations[selectedId].messages;
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            // If the last message is from the bot and has content, we're no longer waiting
            if (lastMessage.authorRole === AuthorRoles.Bot && lastMessage.content) {
                setWaitingForResponse(false);
            }
        }
    }, [conversations, selectedId]);

    const documentFileRef = useRef<HTMLInputElement | null>(null);
    const textAreaRef = React.useRef<HTMLTextAreaElement>(null);
    const [textareaHeight, setTextareaHeight] = useState(MIN_TEXTAREA_HEIGHT);

    // Auto-resize textarea based on content
    const adjustTextareaHeight = useCallback(() => {
        // Find the actual textarea element by id since Fluent UI wraps it
        const textarea = document.getElementById('chat-input') as HTMLTextAreaElement | null;
        if (textarea === null) return;

        // Reset to minimum height first to get accurate scrollHeight
        textarea.style.height = `${MIN_TEXTAREA_HEIGHT}px`;

        // Get the scroll height which represents the content height
        const scrollHeight = textarea.scrollHeight;

        // Calculate new height with constraints
        let newHeight = Math.max(MIN_TEXTAREA_HEIGHT, scrollHeight);
        newHeight = Math.min(newHeight, MAX_TEXTAREA_HEIGHT);

        // Apply the new height
        textarea.style.height = `${newHeight}px`;
        setTextareaHeight(newHeight);
    }, []);

    useEffect(() => {
        // Focus on the text area when the selected conversation changes
        textAreaRef.current?.focus();
    }, [selectedId]);

    // Adjust height when value changes
    useEffect(() => {
        // Use requestAnimationFrame to ensure DOM has updated
        const rafId = requestAnimationFrame(() => {
            adjustTextareaHeight();
        });
        return () => {
            cancelAnimationFrame(rafId);
        };
    }, [value, adjustTextareaHeight]);

    useEffect(() => {
        async function initSpeechRecognizer() {
            const speechService = new SpeechService();
            const response = await speechService.getSpeechTokenAsync(
                await AuthHelper.getSKaaSAccessToken(instance, inProgress),
            );
            if (response.isSuccess) {
                const recognizer = speechService.getSpeechRecognizerAsyncWithValidKey(response);
                setRecognizer(recognizer);
            }
        }

        initSpeechRecognizer().catch((e) => {
            const errorDetails = getErrorDetails(e);
            const errorMessage = `Kan ikkje initialisere talegjenkjenner. Detaljar: ${errorDetails}`;
            dispatch(addAlert({ message: errorMessage, type: AlertType.Error }));
        });
    }, [dispatch, instance, inProgress]);

    useEffect(() => {
        const chatState = conversations[selectedId];
        setValue(chatState.disabled ? COPY.CHAT_DELETED_MESSAGE() : chatState.input);
    }, [conversations, selectedId]);

    const handleSpeech = () => {
        setIsListening(true);
        if (recognizer) {
            recognizer.recognizeOnceAsync((result) => {
                if (result.reason === speechSdk.ResultReason.RecognizedSpeech) {
                    if (result.text && result.text.length > 0) {
                        handleSubmit(result.text);
                    }
                }
                setIsListening(false);
            });
        }
    };

    // Track last submitted message to prevent exact duplicates from rapid clicks
    const lastSubmittedRef = useRef<string>('');

    const handleSubmit = useCallback(
        (inputValue: string, messageType: ChatMessageType = ChatMessageType.Message) => {
            if (inputValue.trim() === '') {
                return;
            }

            // Prevent rapid duplicate submissions of the exact same message
            // (allows queuing different messages while waiting for response)
            if (inputValue === lastSubmittedRef.current) {
                log('Ignoring duplicate submit of same message');
                return;
            }
            lastSubmittedRef.current = inputValue;

            // Clear the duplicate prevention after a short delay to allow re-sending the same message later
            setTimeout(() => {
                lastSubmittedRef.current = '';
            }, 1000);

            // If a diagram type is selected, prepend the diagram instruction to the message
            // but keep the original message for display in the chat UI
            let finalValue = inputValue;
            let displayValue: string | undefined;
            if (selectedDiagramType) {
                finalValue = `[Diagram request: ${selectedDiagramType.prompt}]\n\nUser request: ${inputValue}`;
                displayValue = inputValue; // Show only user's message in chat
            }

            // Clear input immediately - don't wait for response
            setValue('');
            dispatch(editConversationInput({ id: selectedId, newInput: '' }));
            dispatch(updateBotResponseStatus({ chatId: selectedId, status: 'Kallar på kjernen' }));

            // Clear any previous cancelled status for this chat
            chatRequestQueue.clearCancelledChat(selectedId);

            // Mark that we're waiting for a response
            setWaitingForResponse(true);

            // Clear diagram type after sending (user can re-select for next message)
            setSelectedDiagramType(null);

            // Fire and forget - onSubmit handles queuing internally
            // The queue will process requests one at a time
            onSubmit({ value: finalValue, displayValue, messageType, chatId: selectedId }).catch((error) => {
                const message = `Feil ved innsending av chat-input: ${(error as Error).message}`;
                log(message);
                dispatch(
                    addAlert({
                        type: AlertType.Error,
                        message,
                    }),
                );
            });
        },
        [dispatch, selectedId, onSubmit, selectedDiagramType],
    );

    const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
        onDragLeave(e);
        void fileHandler.handleImport(selectedId, documentFileRef, false, undefined, e.dataTransfer.files);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const clipboardItems = e.clipboardData.items;

        // Look for image data in the clipboard
        for (const item of clipboardItems) {
            if (item.type.startsWith('image/')) {
                e.preventDefault(); // Prevent default paste behavior for images

                const blob = item.getAsFile();
                if (!blob) continue;

                // Generate a filename with timestamp
                const extension = item.type.split('/')[1] || 'png';
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `screenshot-${timestamp}.${extension}`;

                // Create a File from the blob with the generated filename
                const file = new File([blob], filename, { type: item.type });

                // Use existing import handler
                void fileHandler.handleImport(selectedId, documentFileRef, false, file);
                return; // Only handle one image
            }
        }
        // If no image found, let the default paste behavior happen (text paste)
    };

    const dragging = isDraggingOver ?? false;

    // Show queue info when there are items waiting
    const showQueueInfo = queueLength > 0;

    // Handle stop button click - cancel on server first (to stop LLM ASAP), then cleanup client
    const handleStopRequest = useCallback(async () => {
        log('Stop button clicked - cancelling request for chat:', selectedId);

        // Call the server FIRST to cancel the LLM request (stops token generation immediately)
        try {
            const chatService = new ChatService();
            const accessToken = await AuthHelper.getSKaaSAccessToken(instance, inProgress);
            await chatService.cancelChatAsync(selectedId, accessToken);
            log('Successfully cancelled chat request on server');
        } catch (error) {
            // Don't show error to user - the request may have already completed
            log('Failed to cancel on server (request may have completed):', error);
        }

        // Then abort the client-side request and cleanup UI
        chatRequestQueue.abortCurrentRequest();
        dispatch(updateBotResponseStatus({ chatId: selectedId, status: undefined }));
        setWaitingForResponse(false);
    }, [dispatch, selectedId, instance, inProgress]);

    // Handle cancel queued request
    const handleCancelQueuedRequest = useCallback((requestId: string) => {
        chatRequestQueue.cancelQueuedRequest(requestId);
    }, []);

    // Check if we should show the stop button (bot is responding to current chat)
    const botResponseStatus = conversations[selectedId].botResponseStatus;
    const showStopButton = isProcessing || !!botResponseStatus || waitingForResponse;

    return (
        <div className={classes.root}>
            <div className={classes.typingIndicator}>
                <ChatStatus />
            </div>
            <Alerts />
            {showQueueInfo && (
                <div className={classes.queueInfo}>
                    <Spinner size="tiny" />
                    <span>{queueLength === 1 ? '1 melding ventar i kø' : `${queueLength} meldingar ventar i kø`}</span>
                    {queuedRequests.map((req, index) => (
                        <div key={req.id} className={classes.queuedItem}>
                            <span>#{index + 1}</span>
                            <Tooltip content="Slett denne meldinga frå køen" relationship="label">
                                <Button
                                    appearance="subtle"
                                    size="small"
                                    icon={<DeleteRegular />}
                                    onClick={() => {
                                        handleCancelQueuedRequest(req.id);
                                    }}
                                    className={classes.cancelQueueBtn}
                                    aria-label={`Slett melding ${index + 1} frå køen`}
                                />
                            </Tooltip>
                        </div>
                    ))}
                </div>
            )}
            <div className={classes.content}>
                <div className={classes.inputWrapper}>
                    <Textarea
                        title="Chat-input"
                        aria-label="Chat-input felt. Klikk enter for å sende inn input. Du kan òg lime inn skjermbilete."
                        ref={textAreaRef}
                        id="chat-input"
                        resize="none"
                        disabled={conversations[selectedId].disabled || dragging}
                        textarea={{
                            className: dragging
                                ? mergeClasses(classes.dragAndDrop, classes.textarea)
                                : classes.textarea,
                            style: {
                                height: `${textareaHeight}px`,
                                overflowY: textareaHeight >= MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden',
                            },
                        }}
                        className={classes.input}
                        value={dragging ? 'Slepp filene dine her' : value}
                        placeholder="Skriv meldinga di her"
                        onDrop={handleDrop}
                        onPaste={handlePaste}
                        onFocus={() => {
                            // oppdater den lokalt lagra verdien til den nåverande verdien
                            const chatInput = document.getElementById('chat-input');
                            if (chatInput) {
                                setValue((chatInput as HTMLTextAreaElement).value);
                            }
                            // User is considered typing if the input is in focus
                            if (activeUserInfo) {
                                dispatch(
                                    updateUserIsTyping({
                                        userId: activeUserInfo.id,
                                        chatId: selectedId,
                                        isTyping: true,
                                    }),
                                );
                            }
                        }}
                        onChange={(_event, data) => {
                            if (dragging) {
                                return;
                            }

                            setValue(data.value);
                            dispatch(editConversationInput({ id: selectedId, newInput: data.value }));
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                handleSubmit(value);
                            }
                        }}
                        onBlur={() => {
                            // User is considered not typing if the input is not  in focus
                            if (activeUserInfo) {
                                dispatch(
                                    updateUserIsTyping({
                                        userId: activeUserInfo.id,
                                        chatId: selectedId,
                                        isTyping: false,
                                    }),
                                );
                            }
                        }}
                    />
                    <div className={classes.controls}>
                        <div className={classes.functional}>
                            {/* Skjult input for filopplasting. Godtek berre .txt og .pdf filer for nå. */}
                            <input
                                type="file"
                                ref={documentFileRef}
                                className={classes.hiddenFileInput}
                                aria-label="Fil opplasting input"
                                accept={Constants.app.importTypes}
                                multiple={true}
                                onChange={() => {
                                    void fileHandler.handleImport(selectedId, documentFileRef);
                                }}
                            />
                            <Button
                                disabled={
                                    conversations[selectedId].disabled ||
                                    dragging ||
                                    (importingDocuments?.length ?? 0) > 0
                                }
                                appearance="transparent"
                                size="large"
                                icon={<AttachRegular />}
                                onClick={() => documentFileRef.current?.click()}
                                title="Vedlegg fil"
                                aria-label="Vedlegg fil-knapp"
                            />
                            <DiagramTypeSelector
                                selectedType={selectedDiagramType}
                                onSelectType={setSelectedDiagramType}
                                disabled={conversations[selectedId].disabled || dragging}
                            />
                            {importingDocuments && importingDocuments.length > 0 && <Spinner size="tiny" />}
                        </div>
                        <div className={classes.essentials}>
                            {recognizer && (
                                <Button
                                    appearance="transparent"
                                    size="large"
                                    disabled={conversations[selectedId].disabled || isListening || dragging}
                                    icon={<MicRegular />}
                                    onClick={handleSpeech}
                                />
                            )}
                            {showStopButton ? (
                                <Tooltip content="Stopp generering" relationship="label">
                                    <Button
                                        title="Stopp"
                                        aria-label="Stopp generering"
                                        appearance="transparent"
                                        size="large"
                                        icon={<BsStopFill />}
                                        onClick={() => {
                                            void handleStopRequest();
                                        }}
                                        className={classes.stopButton}
                                    />
                                </Tooltip>
                            ) : (
                                <Button
                                    title="Send inn"
                                    aria-label="Send inn melding"
                                    appearance="transparent"
                                    size="large"
                                    icon={<SendRegular />}
                                    onClick={() => {
                                        handleSubmit(value);
                                    }}
                                    disabled={conversations[selectedId].disabled || dragging}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
