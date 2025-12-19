// Copyright (c) Microsoft. All rights reserved.
import { useMsal } from '@azure/msal-react';
import { Button, Spinner, Textarea, makeStyles, mergeClasses, shorthands, tokens } from '@fluentui/react-components';
import { AttachRegular, MicRegular, SendRegular } from '@fluentui/react-icons';
import debug from 'debug';
import * as speechSdk from 'microsoft-cognitiveservices-speech-sdk';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Constants } from '../../Constants';
import { COPY } from '../../assets/strings';
import { AuthHelper } from '../../libs/auth/AuthHelper';
import { useFile } from '../../libs/hooks';
import { GetResponseOptions } from '../../libs/hooks/useChat';
import { AlertType } from '../../libs/models/AlertType';
import { ChatMessageType } from '../../libs/models/ChatMessage';
import { chatRequestQueue } from '../../libs/services/ChatRequestQueue';
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

const useClasses = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '105em',
        ...shorthands.margin(tokens.spacingVerticalNone, tokens.spacingHorizontalM),
        '@media (max-width: 744px)': {
            ...shorthands.margin(tokens.spacingVerticalNone, tokens.spacingHorizontalS),
        },
    },
    typingIndicator: {
        maxHeight: '28px',
    },
    content: {
        ...shorthands.gap(tokens.spacingHorizontalM),
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        '@media (max-width: 744px)': {
            ...shorthands.gap(tokens.spacingHorizontalS),
        },
    },
    input: {
        width: '100%',
    },
    textarea: {
        maxHeight: '80px',
        '@media (max-width: 744px)': {
            maxHeight: '60px',
            fontSize: tokens.fontSizeBase300,
        },
    },
    controls: {
        display: 'flex',
        flexDirection: 'row',
    },
    essentials: {
        display: 'flex',
        flexDirection: 'row',
        marginLeft: 'auto', // align to right
    },
    functional: {
        display: 'flex',
        flexDirection: 'row',
    },
    queueInfo: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        ...shorthands.gap(tokens.spacingHorizontalS),
        marginBottom: tokens.spacingVerticalXS,
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

    // Queue info state - number of messages waiting in queue
    const [queueLength, setQueueLength] = useState(0);

    // Poll queue state periodically when processing
    useEffect(() => {
        const updateQueueState = () => {
            setQueueLength(chatRequestQueue.getQueueLength());
        };

        // Check immediately
        updateQueueState();

        // Poll every 500ms to update queue status
        const interval = setInterval(updateQueueState, 500);
        return () => {
            clearInterval(interval);
        };
    }, []);

    const documentFileRef = useRef<HTMLInputElement | null>(null);
    const textAreaRef = React.useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        // Focus on the text area when the selected conversation changes
        textAreaRef.current?.focus();
    }, [selectedId]);

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

    const handleSubmit = useCallback(
        (inputValue: string, messageType: ChatMessageType = ChatMessageType.Message) => {
            if (inputValue.trim() === '') {
                return;
            }

            // If a diagram type is selected, prepend the diagram instruction to the message
            let finalValue = inputValue;
            if (selectedDiagramType) {
                finalValue = `[Diagram request: ${selectedDiagramType.prompt}]\n\nUser request: ${inputValue}`;
            }

            // Clear input immediately - don't wait for response
            setValue('');
            dispatch(editConversationInput({ id: selectedId, newInput: '' }));
            dispatch(updateBotResponseStatus({ chatId: selectedId, status: 'Kallar på kjernen' }));

            // Clear diagram type after sending (user can re-select for next message)
            setSelectedDiagramType(null);

            // Fire and forget - onSubmit handles queuing internally
            // The queue will process requests one at a time
            onSubmit({ value: finalValue, messageType, chatId: selectedId }).catch((error) => {
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
                </div>
            )}
            <div className={classes.content}>
                <Textarea
                    title="Chat-input"
                    aria-label="Chat-input felt. Klikk enter for å sende inn input. Du kan òg lime inn skjermbilete."
                    ref={textAreaRef}
                    id="chat-input"
                    resize="vertical"
                    disabled={conversations[selectedId].disabled || dragging}
                    textarea={{
                        className: dragging ? mergeClasses(classes.dragAndDrop, classes.textarea) : classes.textarea,
                    }}
                    className={classes.input}
                    value={dragging ? 'Slepp filene dine her' : value}
                    placeholder="Skriv meldinga di her. Du kan lime inn bilete med Ctrl+V."
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
                                updateUserIsTyping({ userId: activeUserInfo.id, chatId: selectedId, isTyping: true }),
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
                                updateUserIsTyping({ userId: activeUserInfo.id, chatId: selectedId, isTyping: false }),
                            );
                        }
                    }}
                />
            </div>
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
                            conversations[selectedId].disabled || dragging || (importingDocuments?.length ?? 0) > 0
                        }
                        appearance="transparent"
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
                            disabled={conversations[selectedId].disabled || isListening || dragging}
                            icon={<MicRegular />}
                            onClick={handleSpeech}
                        />
                    )}
                    <Button
                        title="Send inn"
                        aria-label="Send inn melding"
                        appearance="transparent"
                        icon={<SendRegular />}
                        onClick={() => {
                            handleSubmit(value);
                        }}
                        disabled={conversations[selectedId].disabled || dragging}
                    />
                </div>
            </div>
        </div>
    );
};
