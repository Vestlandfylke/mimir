// Copyright (c) Microsoft. All rights reserved.

import {
    Accordion,
    AccordionHeader,
    AccordionItem,
    AccordionPanel,
    Body1,
    Button,
    makeStyles,
    shorthands,
    Spinner,
    tokens,
} from '@fluentui/react-components';
import { ArrowSync20Regular, ChevronDown20Regular, ErrorCircle24Regular } from '@fluentui/react-icons';
import { FC, useState } from 'react';
import { refreshPage } from '../../assets/strings';
import { useAppDispatch, useAppSelector } from '../../redux/app/hooks';
import { RootState } from '../../redux/app/store';
import { ServiceError } from '../../redux/features/app/AppState';
import { clearServiceError } from '../../redux/features/app/appSlice';

const useClasses = makeStyles({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(8px)',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: '500px',
        textAlign: 'center',
        ...shorthands.padding(tokens.spacingVerticalXXL, tokens.spacingHorizontalXXL),
        ...shorthands.borderRadius(tokens.borderRadiusXLarge),
        backgroundColor: tokens.colorNeutralBackground1,
        boxShadow: tokens.shadow64,
        ...shorthands.gap(tokens.spacingVerticalL),
    },
    iconContainer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '64px',
        height: '64px',
        ...shorthands.borderRadius('50%'),
        backgroundColor: tokens.colorPaletteRedBackground2,
    },
    icon: {
        color: tokens.colorPaletteRedForeground1,
    },
    title: {
        fontSize: tokens.fontSizeBase500,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForeground1,
        margin: 0,
    },
    message: {
        fontSize: tokens.fontSizeBase300,
        color: tokens.colorNeutralForeground2,
        lineHeight: tokens.lineHeightBase300,
        margin: 0,
    },
    buttonContainer: {
        display: 'flex',
        flexDirection: 'row',
        ...shorthands.gap(tokens.spacingHorizontalM),
        marginTop: tokens.spacingVerticalM,
    },
    errorDetailsContainer: {
        width: '100%',
        marginTop: tokens.spacingVerticalS,
    },
    accordion: {
        width: '100%',
    },
    accordionHeader: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
    },
    errorDetails: {
        textAlign: 'left',
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
        backgroundColor: tokens.colorNeutralBackground3,
        ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: '150px',
        overflowY: 'auto',
    },
    retryingContainer: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        ...shorthands.gap(tokens.spacingHorizontalS),
        color: tokens.colorNeutralForeground3,
    },
});

interface ServiceUnavailableOverlayProps {
    /** Optional callback when user clicks retry */
    onRetry?: () => void;
}

export const ServiceUnavailableOverlay: FC<ServiceUnavailableOverlayProps> = ({ onRetry }) => {
    const classes = useClasses();
    const dispatch = useAppDispatch();
    const { serviceError } = useAppSelector((state: RootState) => state.app);
    const [isRetrying, setIsRetrying] = useState(false);

    if (!serviceError) {
        return null;
    }

    // Extract error details with proper typing after null check
    const error: ServiceError = serviceError;
    const errorDetails = error.details;

    const handleRetry = () => {
        setIsRetrying(true);

        if (onRetry) {
            onRetry();
        }

        // Clear the error and let the app retry
        dispatch(clearServiceError());

        // Small delay to show the retrying state
        setTimeout(() => {
            setIsRetrying(false);
        }, 1000);
    };

    const handleRefresh = () => {
        refreshPage();
    };

    return (
        <div className={classes.overlay}>
            <div className={classes.container}>
                <div className={classes.iconContainer}>
                    <ErrorCircle24Regular className={classes.icon} fontSize={32} />
                </div>

                <h2 className={classes.title}>Mimir er midlertidig utilgjengeleg</h2>

                <Body1 className={classes.message}>
                    Vi opplever for tida nokre tekniske utfordringar. Prøv igjen om litt, eller oppdater sida.
                </Body1>

                {isRetrying ? (
                    <div className={classes.retryingContainer}>
                        <Spinner size="tiny" />
                        <span>Prøver på nytt...</span>
                    </div>
                ) : (
                    <div className={classes.buttonContainer}>
                        <Button appearance="primary" icon={<ArrowSync20Regular />} onClick={handleRetry}>
                            Prøv igjen
                        </Button>
                        <Button appearance="secondary" onClick={handleRefresh}>
                            Oppdater sida
                        </Button>
                    </div>
                )}

                {errorDetails && (
                    <div className={classes.errorDetailsContainer}>
                        <Accordion collapsible className={classes.accordion}>
                            <AccordionItem value="error-details">
                                <AccordionHeader
                                    expandIconPosition="end"
                                    expandIcon={<ChevronDown20Regular />}
                                    className={classes.accordionHeader}
                                >
                                    Tekniske detaljar
                                </AccordionHeader>
                                <AccordionPanel>
                                    <div className={classes.errorDetails}>{errorDetails}</div>
                                </AccordionPanel>
                            </AccordionItem>
                        </Accordion>
                    </div>
                )}
            </div>
        </div>
    );
};
