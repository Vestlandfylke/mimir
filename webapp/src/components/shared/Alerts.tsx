// Copyright (c) Microsoft. All rights reserved.

import { Button, makeStyles, shorthands, tokens } from '@fluentui/react-components';
import { Alert } from '@fluentui/react-components/unstable';
import { ArrowSync16Regular } from '@fluentui/react-icons';
import React from 'react';
import { COPY, refreshPage } from '../../assets/strings';
import { useAppDispatch, useAppSelector } from '../../redux/app/hooks';
import { RootState } from '../../redux/app/store';
import { removeAlert } from '../../redux/features/app/appSlice';
import { Dismiss16 } from './BundledIcons';

const useClasses = makeStyles({
    alert: {
        fontWeight: tokens.fontWeightRegular,
        color: tokens.colorNeutralForeground1,
        backgroundColor: tokens.colorNeutralBackground6,
        fontSize: tokens.fontSizeBase200,
        lineHeight: tokens.lineHeightBase200,
    },
    actionItems: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        ...shorthands.gap(tokens.spacingHorizontalS),
    },
    refreshButton: {
        minWidth: 'auto',
        padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
        fontSize: tokens.fontSizeBase200,
        // Dark text for better contrast on light brand colors
        color: tokens.colorNeutralForeground1,
        ':hover': {
            color: tokens.colorNeutralForeground1,
        },
    },
    retryButton: {
        minWidth: 'auto',
        padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
        fontSize: tokens.fontSizeBase200,
        // Dark text for better contrast on light brand colors
        color: tokens.colorNeutralForeground1,
        ':hover': {
            color: tokens.colorNeutralForeground1,
        },
    },
    dismissButton: {
        alignSelf: 'center',
        cursor: 'pointer',
    },
});

export const Alerts: React.FC = () => {
    const classes = useClasses();
    const dispatch = useAppDispatch();
    const { alerts } = useAppSelector((state: RootState) => state.app);

    return (
        <div>
            {alerts.map(({ type, message, onRetry, retryLabel, showRefresh }, index) => {
                return (
                    <Alert
                        intent={type}
                        action={{
                            children: (
                                <div className={classes.actionItems}>
                                    {onRetry && (
                                        <Button
                                            appearance="primary"
                                            size="small"
                                            className={classes.retryButton}
                                            onClick={onRetry}
                                        >
                                            {retryLabel ?? 'Prøv igjen'}
                                        </Button>
                                    )}
                                    {showRefresh && (
                                        <Button
                                            appearance="primary"
                                            size="small"
                                            icon={<ArrowSync16Regular />}
                                            className={classes.refreshButton}
                                            onClick={refreshPage}
                                        >
                                            {COPY.REFRESH_BUTTON_TEXT}
                                        </Button>
                                    )}
                                    <Dismiss16
                                        aria-label="avvis melding"
                                        onClick={() => {
                                            dispatch(removeAlert(index));
                                        }}
                                        color="black"
                                        className={classes.dismissButton}
                                    />
                                </div>
                            ),
                        }}
                        key={`${index}-${type}`}
                        className={classes.alert}
                    >
                        {message.slice(0, 1000) + (message.length > 1000 ? '...' : '')}
                    </Alert>
                );
            })}
        </div>
    );
};
