// Copyright (c) Microsoft. All rights reserved.

import { makeStyles, mergeClasses, Spinner, tokens } from '@fluentui/react-components';
import { FC } from 'react';

const useClasses = makeStyles({
    overlayBase: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        gap: tokens.spacingVerticalM,
    },
    overlayLight: {
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
    },
    overlayDark: {
        backgroundColor: 'rgba(30, 30, 30, 0.85)',
    },
    text: {
        fontSize: '14px',
        color: tokens.colorNeutralForeground2,
        fontWeight: '600',
    },
});

interface ILoadingOverlayProps {
    text?: string;
    isDark?: boolean;
}

export const LoadingOverlay: FC<ILoadingOverlayProps> = ({ text, isDark = false }) => {
    const classes = useClasses();

    const overlayClassName = mergeClasses(classes.overlayBase, isDark ? classes.overlayDark : classes.overlayLight);

    return (
        <div className={overlayClassName}>
            <Spinner size="large" />
            {text && <span className={classes.text}>{text}</span>}
        </div>
    );
};
