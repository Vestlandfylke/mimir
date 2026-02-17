import { makeStyles, shorthands, Button, tokens } from '@fluentui/react-components';
import { ChevronLeft24Regular, Navigation24Regular } from '@fluentui/react-icons';
import { FC, useState, useEffect, useCallback } from 'react';
import { useChat } from '../../libs/hooks';
import { useAppDispatch, useAppSelector } from '../../redux/app/hooks';
import { RootState } from '../../redux/app/store';
import { setChatManagementModalOpen, setFileManagementModalOpen } from '../../redux/features/app/appSlice';
import { Breakpoints } from '../../styles';
import { ChatWindow } from '../chat/ChatWindow';
import { ChatList } from '../chat/chat-list/ChatList';
import { ChatManagementModal } from '../chat/chat-list/ChatManagementModal';
import { FileManagementModal } from '../files/FileManagementModal';

const useClasses = makeStyles({
    container: {
        ...shorthands.overflow('hidden'),
        display: 'flex',
        flexDirection: 'row',
        alignContent: 'start',
        height: '100%',
        position: 'relative',
    },
    chatListWrapper: {
        display: 'flex',
        flexShrink: 0,
        height: '100%',
        ...Breakpoints.small({
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 100,
            transition: 'transform 0.3s ease-in-out',
        }),
    },
    chatListHidden: {
        ...Breakpoints.small({
            transform: 'translateX(-100%)',
        }),
    },
    chatListVisible: {
        ...Breakpoints.small({
            transform: 'translateX(0)',
        }),
    },
    chatWindowWrapper: {
        flexGrow: 1,
        height: '100%',
        ...shorthands.overflow('hidden'),
        ...Breakpoints.small({
            width: '100%',
        }),
    },
    mobileMenuButton: {
        display: 'none',
        position: 'absolute',
        top: tokens.spacingVerticalS,
        left: tokens.spacingHorizontalS,
        zIndex: 50,
        ...Breakpoints.small({
            display: 'flex',
        }),
    },
    overlay: {
        display: 'none',
        ...Breakpoints.small({
            display: 'block',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 99,
        }),
    },
    overlayHidden: {
        ...Breakpoints.small({
            display: 'none',
        }),
    },
});

export const ChatView: FC = () => {
    const classes = useClasses();
    const dispatch = useAppDispatch();
    const { selectedId } = useAppSelector((state: RootState) => state.conversations);
    const { isChatManagementModalOpen, isFileManagementModalOpen } = useAppSelector((state: RootState) => state.app);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const chat = useChat();

    // Detect mobile screen size
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 744);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => {
            window.removeEventListener('resize', checkMobile);
        };
    }, []);

    // Close menu when a chat is selected on mobile
    useEffect(() => {
        if (isMobile && selectedId) {
            setIsMobileMenuOpen(false);
        }
    }, [selectedId, isMobile]);

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    const handleCloseManagementModal = useCallback(() => {
        dispatch(setChatManagementModalOpen(false));
    }, [dispatch]);

    const handleCloseFileModal = useCallback(() => {
        dispatch(setFileManagementModalOpen(false));
    }, [dispatch]);

    const handleDeleteChats = useCallback(
        async (chatIds: string[]) => {
            // Delete chats sequentially to avoid race conditions
            for (const chatId of chatIds) {
                await chat.deleteChat(chatId);
            }
        },
        [chat],
    );

    return (
        <div className={classes.container}>
            {/* Mobile menu button */}
            {isMobile && !isMobileMenuOpen && (
                <Button
                    className={classes.mobileMenuButton}
                    appearance="subtle"
                    icon={<Navigation24Regular />}
                    onClick={toggleMobileMenu}
                    aria-label="Opne samtale-liste"
                />
            )}

            {/* Overlay for closing menu */}
            {isMobile && isMobileMenuOpen && <div className={classes.overlay} onClick={toggleMobileMenu} />}

            {/* Chat list sidebar */}
            <div
                data-tour="chat-list"
                className={`${classes.chatListWrapper} ${
                    isMobile ? (isMobileMenuOpen ? classes.chatListVisible : classes.chatListHidden) : ''
                }`}
            >
                {isMobile && isMobileMenuOpen && (
                    <Button
                        appearance="subtle"
                        icon={<ChevronLeft24Regular />}
                        onClick={toggleMobileMenu}
                        style={{
                            position: 'absolute',
                            right: tokens.spacingHorizontalS,
                            top: tokens.spacingVerticalS,
                            zIndex: 101,
                        }}
                        aria-label="Lukk samtale-liste"
                    />
                )}
                <ChatList />
            </div>

            {/* Chat window */}
            <div data-tour="chat-area" className={classes.chatWindowWrapper}>
                {selectedId !== '' && <ChatWindow />}
            </div>

            {/* Chat management modal */}
            <ChatManagementModal
                isOpen={isChatManagementModalOpen}
                onClose={handleCloseManagementModal}
                onDeleteChats={handleDeleteChats}
            />

            {/* File management modal */}
            <FileManagementModal isOpen={isFileManagementModalOpen} onClose={handleCloseFileModal} />
        </div>
    );
};
