// Copyright (c) Microsoft. All rights reserved.

import { useIsAuthenticated } from '@azure/msal-react';
import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

const TOUR_COMPLETED_KEY = 'mimir-tour-completed';

interface TourContextType {
    isTourRunning: boolean;
    startTour: () => void;
    stopTour: () => void;
    hasCompletedTour: boolean;
    setTourCompleted: (completed: boolean) => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export const useTour = () => {
    const context = useContext(TourContext);
    if (!context) {
        throw new Error('useTour must be used within a TourProvider');
    }
    return context;
};

interface TourProviderProps {
    children: ReactNode;
}

export const TourProvider = ({ children }: TourProviderProps) => {
    const [isTourRunning, setIsTourRunning] = useState(false);
    const [hasCompletedTour, setHasCompletedTour] = useState(() => {
        // Check localStorage on initial load
        return localStorage.getItem(TOUR_COMPLETED_KEY) === 'true';
    });

    // Check if user is authenticated before starting tour
    const isMsalAuthenticated = useIsAuthenticated();
    const isTeamsAuthenticated = sessionStorage.getItem('teamsToken') !== null;
    const isAuthenticated = isMsalAuthenticated || isTeamsAuthenticated;

    const startTour = useCallback(() => {
        setIsTourRunning(true);
    }, []);

    const stopTour = useCallback(() => {
        setIsTourRunning(false);
    }, []);

    const setTourCompleted = useCallback((completed: boolean) => {
        setHasCompletedTour(completed);
        if (completed) {
            localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
        } else {
            localStorage.removeItem(TOUR_COMPLETED_KEY);
        }
    }, []);

    // Auto-start tour for new users after UI is fully loaded AND user is authenticated
    useEffect(() => {
        // Only start tour if user hasn't completed it AND is authenticated
        if (!hasCompletedTour && isAuthenticated) {
            // Function to check if the app is ready
            const checkAppReady = () => {
                // Check for key UI elements that indicate the app is fully loaded
                const chatInput = document.querySelector('[data-tour="chat-input"]');
                const chatList = document.querySelector('[data-tour="chat-list"]');
                return chatInput !== null && chatList !== null;
            };

            // Poll for app readiness with a maximum wait time
            let attempts = 0;
            const maxAttempts = 20; // Max 10 seconds (20 * 500ms)

            const checkInterval = setInterval(() => {
                attempts++;
                if (checkAppReady()) {
                    clearInterval(checkInterval);
                    // Additional delay after elements are found to ensure animations complete
                    setTimeout(() => {
                        if (!isTourRunning) {
                            startTour();
                        }
                    }, 500);
                } else if (attempts >= maxAttempts) {
                    // Max time reached but UI not ready - don't start tour
                    // (user might not be fully logged in or there's an issue)
                    clearInterval(checkInterval);
                }
            }, 500);

            return () => {
                clearInterval(checkInterval);
            };
        }
        return undefined;
    }, [hasCompletedTour, isAuthenticated, isTourRunning, startTour]);

    return (
        <TourContext.Provider
            value={{
                isTourRunning,
                startTour,
                stopTour,
                hasCompletedTour,
                setTourCompleted,
            }}
        >
            {children}
        </TourContext.Provider>
    );
};
