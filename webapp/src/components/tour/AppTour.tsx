// Copyright (c) Microsoft. All rights reserved.

import { useCallback, useState, useMemo, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, EVENTS, ACTIONS, Step } from 'react-joyride';
import { useAppSelector } from '../../redux/app/hooks';
import { RootState } from '../../redux/app/store';
import { FeatureKeys, BrandColors } from '../../redux/features/app/AppState';
import { useTour } from './TourContext';
import { tourSteps, mobileTourSteps } from './tourSteps';
import logoLight from '../../assets/sidestilt-logo-vlfk.svg';
import logoDark from '../../assets/sidestilt-logo-kvit-skrift-vlfk.svg';

/**
 * Custom welcome content with Vestland logo
 */
const WelcomeContent = ({ isDark }: { isDark: boolean }) => (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <img
            src={isDark ? logoDark : logoLight}
            alt="Vestland fylkeskommune"
            style={{ height: '48px', marginBottom: '16px' }}
        />
        <h2 style={{ margin: '0 0 16px 0', fontSize: '1.5rem', fontWeight: 600 }}>Velkomen til Mimir</h2>
        <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6 }}>
            Mímir var vaktaren av visdomskjelda under Yggdrasil i norrøn mytologi. Odin ofra auga sitt for å drikke frå
            kjelda, og Mímir vart sidan den klokaste rådgivaren hans.
            <br />
            <br />
            <b>Lat meg vise deg rundt!</b>
        </p>
    </div>
);

/**
 * Custom final step content with Vestland logo
 */
const FinalContent = ({ isDark }: { isDark: boolean }) => (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <img
            src={isDark ? logoDark : logoLight}
            alt="Vestland fylkeskommune"
            style={{ height: '48px', marginBottom: '16px' }}
        />
        <h2 style={{ margin: '0 0 16px 0', fontSize: '1.5rem', fontWeight: 600 }}>No er du klar!</h2>
        <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6 }}>
            Tips: Spør gjerne Mimir
            <br />
            «Korleis brukar eg deg?» for meir hjelp.
        </p>
        <p style={{ margin: '12px 0 0 0', fontSize: '1rem', fontWeight: 500 }}>Lykke til!</p>
    </div>
);

/**
 * AppTour component that provides a guided introduction to the Mimir application.
 * Uses react-joyride to highlight UI elements and explain their functions.
 */
export const AppTour = () => {
    const { isTourRunning, stopTour, setTourCompleted } = useTour();
    const { features, brandColor } = useAppSelector((state: RootState) => state.app);
    const isDarkMode = features[FeatureKeys.DarkMode].enabled;
    const brandHex = BrandColors[brandColor].hex;

    const [stepIndex, setStepIndex] = useState(0);

    // Determine if we're on mobile
    const isMobile = window.innerWidth < 768;
    const baseSteps = isMobile ? mobileTourSteps : tourSteps;

    // Create steps with custom content for welcome and final steps
    const steps: Step[] = useMemo(() => {
        return baseSteps.map((step, index) => {
            // First step (welcome)
            if (index === 0) {
                return {
                    ...step,
                    content: <WelcomeContent isDark={isDarkMode} />,
                };
            }
            // Last step (final)
            if (index === baseSteps.length - 1) {
                return {
                    ...step,
                    content: <FinalContent isDark={isDarkMode} />,
                };
            }
            return step;
        });
    }, [baseSteps, isDarkMode]);

    // Helper function to navigate to a tab
    const navigateToTab = useCallback((tabName: string) => {
        const tabSelector = `[data-tour="tab-${tabName}"]`;
        const tabElement = document.querySelector<HTMLElement>(tabSelector);
        tabElement?.click();
    }, []);

    // Navigate to chat tab when tour starts to ensure consistent experience
    useEffect(() => {
        if (isTourRunning) {
            // Small delay to ensure the tour UI is ready
            const timer = setTimeout(() => {
                navigateToTab('chat');
                setStepIndex(0);
            }, 50);
            return () => {
                clearTimeout(timer);
            };
        }
        return undefined;
    }, [isTourRunning, navigateToTab]);

    // Type for step data with tab navigation
    interface StepTabData {
        navigateToTab?: string;
        activeTab?: string;
    }

    const handleJoyrideCallback = useCallback(
        (data: CallBackProps) => {
            const { status, action, index, type } = data;

            // Handle tour completion
            if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
                // Navigate back to chat tab when tour ends
                navigateToTab('chat');
                stopTour();
                setTourCompleted(true);
                setStepIndex(0);
                return;
            }

            // Handle step navigation
            if (type === EVENTS.STEP_AFTER) {
                let nextIndex = index;
                if (action === ACTIONS.NEXT) {
                    nextIndex = index + 1;
                } else if (action === ACTIONS.PREV) {
                    nextIndex = index - 1;
                }

                // Check if we've completed the tour (clicked Next on last step)
                if (nextIndex >= steps.length) {
                    navigateToTab('chat');
                    stopTour();
                    setTourCompleted(true);
                    setStepIndex(0);
                    return;
                }

                // Ensure nextIndex is within bounds
                if (nextIndex < 0) nextIndex = 0;

                // Check if next step needs tab navigation
                const nextStep = steps[nextIndex] as Step | undefined;
                const stepData = nextStep?.data as StepTabData | undefined;
                const navTab = stepData?.navigateToTab;
                const activeTab = stepData?.activeTab;

                // Determine which tab to navigate to
                const targetTab = navTab ?? activeTab;

                if (targetTab) {
                    // Navigate to the correct tab before showing the step
                    // Use longer delay when going backwards to ensure smooth transition
                    const delay = action === ACTIONS.PREV ? 150 : 100;
                    setTimeout(() => {
                        navigateToTab(targetTab);
                    }, delay);
                } else if (action === ACTIONS.PREV) {
                    // When going back to a step without tab data, check if we need to go back to chat
                    // Look at previous steps to determine if we were on a different tab
                    const prevSteps = steps.slice(0, nextIndex + 1);
                    let lastTab = 'chat';
                    for (const step of prevSteps) {
                        const data = step.data as StepTabData | undefined;
                        if (data?.navigateToTab) lastTab = data.navigateToTab;
                        else if (data?.activeTab) lastTab = data.activeTab;
                    }
                    if (lastTab !== 'chat') {
                        setTimeout(() => {
                            navigateToTab(lastTab);
                        }, 150);
                    } else {
                        // Make sure we're on chat tab for early steps
                        setTimeout(() => {
                            navigateToTab('chat');
                        }, 150);
                    }
                }

                setStepIndex(nextIndex);
            }

            // Handle close button
            if (action === ACTIONS.CLOSE) {
                // Navigate back to chat tab when closing
                navigateToTab('chat');
                stopTour();
                setTourCompleted(true);
                setStepIndex(0);
            }
        },
        [stopTour, setTourCompleted, navigateToTab, steps],
    );

    // Custom styles for the tour
    const joyrideStyles = {
        options: {
            zIndex: 10000,
            primaryColor: brandHex,
            backgroundColor: isDarkMode ? '#2d2d2d' : '#ffffff',
            textColor: isDarkMode ? '#e5e5e5' : '#242424',
            arrowColor: isDarkMode ? '#2d2d2d' : '#ffffff',
            overlayColor: 'rgba(0, 0, 0, 0.6)',
        },
        tooltip: {
            borderRadius: '12px',
            padding: '24px 28px',
            maxWidth: '480px',
        },
        tooltipContent: {
            padding: '8px 0',
            fontSize: '15px',
            lineHeight: '1.6',
            whiteSpace: 'pre-line' as const,
        },
        tooltipTitle: {
            fontSize: '16px',
            fontWeight: 600,
        },
        buttonNext: {
            backgroundColor: brandHex,
            color: '#000000',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 500,
        },
        buttonBack: {
            color: isDarkMode ? '#a1a1a1' : '#666666',
            marginRight: '8px',
            fontSize: '14px',
        },
        buttonClose: {
            color: isDarkMode ? '#a1a1a1' : '#666666',
        },
        buttonSkip: {
            color: isDarkMode ? '#a1a1a1' : '#666666',
            fontSize: '14px',
        },
        spotlight: {
            borderRadius: '8px',
        },
        beacon: {
            display: 'none', // We disable beacons as we auto-advance
        },
    };

    // Locale strings in Norwegian
    const locale = {
        back: 'Tilbake',
        close: 'Lukk',
        last: 'Ferdig',
        next: 'Neste',
        open: 'Opne',
        skip: 'Hopp over',
    };

    if (!isTourRunning) {
        return null;
    }

    // Custom progress text in Nynorsk
    const progressText = `Steg ${stepIndex + 1} av ${steps.length}`;

    return (
        <Joyride
            steps={steps}
            stepIndex={stepIndex}
            run={isTourRunning}
            continuous
            showProgress={false}
            showSkipButton
            hideCloseButton={false}
            disableScrolling={false}
            disableOverlayClose={true}
            spotlightClicks={false}
            callback={handleJoyrideCallback}
            styles={joyrideStyles}
            locale={{
                ...locale,
                next: `Neste (${progressText})`,
            }}
            floaterProps={{
                disableAnimation: true,
            }}
        />
    );
};
