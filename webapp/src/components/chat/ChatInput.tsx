// Copyright (c) Microsoft. All rights reserved.

import { useMsal } from '@azure/msal-react';
import { Button, Spinner, Textarea, makeStyles, mergeClasses, shorthands, tokens } from '@fluentui/react-components';
import { AttachRegular, MicRegular, SendRegular } from '@fluentui/react-icons';
import debug from 'debug';
import * as speechSdk from 'microsoft-cognitiveservices-speech-sdk';
import React, { useRef, useState } from 'react';
import { Constants } from '../../Constants';
import { COPY } from '../../assets/strings';
import { AuthHelper } from '../../libs/auth/AuthHelper';
import { useFile } from '../../libs/hooks';
import { GetResponseOptions } from '../../libs/hooks/useChat';
import { AlertType } from '../../libs/models/AlertType';
import { ChatMessageType } from '../../libs/models/ChatMessage';
import { useAppDispatch, useAppSelector } from '../../redux/app/hooks';
import { RootState } from '../../redux/app/store';
import { addAlert } from '../../redux/features/app/appSlice';
import { editConversationInput, updateBotResponseStatus } from '../../redux/features/conversations/conversationsSlice';
import { Alerts } from '../shared/Alerts';
import { getErrorDetails } from '../utils/TextUtils';
import { SpeechService } from './../../libs/services/SpeechService';
import { updateUserIsTyping } from './../../redux/features/conversations/conversationsSlice';
import { ChatStatus } from './ChatStatus';

const log = debug(Constants.debug.root).extend('chat-input');

const useClasses = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '105em',
        ...shorthands.margin(tokens.spacingVerticalNone, tokens.spacingHorizontalM),
    },
    typingIndicator: {
        maxHeight: '28px',
    },
    content: {
        ...shorthands.gap(tokens.spacingHorizontalM),
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
    },
    input: {
        width: '100%',
    },
    textarea: {
        maxHeight: '80px',
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
    const { importingDocuments } = conversations[selectedId];

    const documentFileRef = useRef<HTMLInputElement | null>(null);
    const textAreaRef = React.useRef<HTMLTextAreaElement>(null);
    React.useEffect(() => {
        // Focus on the text area when the selected conversation changes
        textAreaRef.current?.focus();
    }, [selectedId]);

    React.useEffect(() => {
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

    React.useEffect(() => {
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

    const handleSubmit = (value: string, messageType: ChatMessageType = ChatMessageType.Message) => {
        if (value.trim() === '') {
            return; // berre send inn dersom verdien ikkje er tom
        }

        setValue('');
        dispatch(editConversationInput({ id: selectedId, newInput: '' }));
        dispatch(updateBotResponseStatus({ chatId: selectedId, status: 'Kallar på kjernen' }));
        onSubmit({ value, messageType, chatId: selectedId }).catch((error) => {
            const message = `Feil ved innsending av chat-input: ${(error as Error).message}`;
            log(message);
            dispatch(
                addAlert({
                    type: AlertType.Error,
                    message,
                }),
            );
        });
    };

    const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
        onDragLeave(e);
        void fileHandler.handleImport(selectedId, documentFileRef, false, undefined, e.dataTransfer.files);
    };

    return (
        <div className={classes.root}>
            <div className={classes.typingIndicator}>
                <ChatStatus />
            </div>
            <Alerts />
            <div className={classes.content}>
                <Textarea
                    title="Chat-input"
                    aria-label="Chat-input felt. Klikk enter for å sende inn input."
                    ref={textAreaRef}
                    id="chat-input"
                    resize="vertical"
                    disabled={conversations[selectedId].disabled}
                    textarea={{
                        className: isDraggingOver
                            ? mergeClasses(classes.dragAndDrop, classes.textarea)
                            : classes.textarea,
                    }}
                    className={classes.input}
                    value={isDraggingOver ? 'Slepp filene dine her' : value}
                    onDrop={handleDrop}
                    onFocus={() => {
                        // oppdater den lokalt lagra verdien til den nåverande verdien
                        const chatInput = document.getElementById('chat-input');
                        if (chatInput) {
                            setValue((chatInput as HTMLTextAreaElement).value);
                        }
                        // Brukeren er ansett som skrivande hvis input er i fokus
                        if (activeUserInfo) {
                            dispatch(
                                updateUserIsTyping({ userId: activeUserInfo.id, chatId: selectedId, isTyping: true }),
                            );
                        }
                    }}
                    onChange={(_event, data) => {
                        if (isDraggingOver) {
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
                        // Brukeren er ansett som ikkje skrivande hvis input ikkje er i fokus
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
                        style={{ display: 'none' }}
                        accept={Constants.app.importTypes}
                        multiple={true}
                        onChange={() => {
                            void fileHandler.handleImport(selectedId, documentFileRef);
                        }}
                    />
                    <Button
                        disabled={
                            conversations[selectedId].disabled || (importingDocuments && importingDocuments.length > 0)
                        }
                        appearance="transparent"
                        icon={<AttachRegular />}
                        onClick={() => documentFileRef.current?.click()}
                        title="Vedlegg fil"
                        aria-label="Vedlegg fil-knapp"
                    />
                    {importingDocuments && importingDocuments.length > 0 && <Spinner size="tiny" />}
                </div>
                <div className={classes.essentials}>
                    {recognizer && (
                        <Button
                            appearance="transparent"
                            disabled={conversations[selectedId].disabled || isListening}
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
                        disabled={conversations[selectedId].disabled}
                    />
                </div>
            </div>
        </div>
    );
};
