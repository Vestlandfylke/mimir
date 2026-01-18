// Copyright (c) Microsoft. All rights reserved.

import { makeStyles, tokens } from '@fluentui/react-components';
import React from 'react';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
    },
    textContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
    },
    text: {
        fontSize: tokens.fontSizeBase300,
        color: tokens.colorNeutralForeground3,
        fontWeight: '500',
        letterSpacing: '0.01em',
    },
    // Modern bouncing dots animation
    dotsContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        marginLeft: '4px',
        height: '20px',
    },
    dot: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: tokens.colorBrandForeground1,
        animationName: {
            '0%, 60%, 100%': {
                transform: 'translateY(0)',
                opacity: 0.4,
            },
            '30%': {
                transform: 'translateY(-6px)',
                opacity: 1,
            },
        },
        animationDuration: '1.2s',
        animationIterationCount: 'infinite',
        animationTimingFunction: 'ease-in-out',
    },
    dot1: {
        animationDelay: '0s',
    },
    dot2: {
        animationDelay: '0.15s',
    },
    dot3: {
        animationDelay: '0.3s',
    },
    // Pulse ring animation for the indicator bubble
    bubbleContainer: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bubble: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        padding: '8px 12px',
        borderRadius: '18px',
        backgroundColor: tokens.colorNeutralBackground3,
        boxShadow: `0 2px 8px ${tokens.colorNeutralShadowAmbient}`,
        position: 'relative',
        overflow: 'hidden',
    },
    // Subtle shimmer effect
    shimmer: {
        position: 'absolute',
        top: 0,
        left: '-100%',
        width: '100%',
        height: '100%',
        background: `linear-gradient(90deg, transparent, ${tokens.colorNeutralBackground1Hover}, transparent)`,
        animationName: {
            '0%': { left: '-100%' },
            '100%': { left: '100%' },
        },
        animationDuration: '2s',
        animationIterationCount: 'infinite',
        animationTimingFunction: 'ease-in-out',
        opacity: 0.5,
    },
    bubbleDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: tokens.colorBrandForeground1,
        animationName: {
            '0%, 100%': {
                transform: 'scale(0.8)',
                opacity: 0.5,
            },
            '50%': {
                transform: 'scale(1.2)',
                opacity: 1,
            },
        },
        animationDuration: '1s',
        animationIterationCount: 'infinite',
        animationTimingFunction: 'ease-in-out',
    },
    bubbleDot1: {
        animationDelay: '0s',
    },
    bubbleDot2: {
        animationDelay: '0.2s',
    },
    bubbleDot3: {
        animationDelay: '0.4s',
    },
});

interface TypingIndicatorProps {
    showText?: boolean;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ showText = false }) => {
    const classes = useStyles();

    if (showText) {
        return (
            <div className={classes.container}>
                <div className={classes.textContainer}>
                    <span className={classes.text}>Mimir skriv</span>
                    <div className={classes.dotsContainer}>
                        <div className={`${classes.dot} ${classes.dot1}`} />
                        <div className={`${classes.dot} ${classes.dot2}`} />
                        <div className={`${classes.dot} ${classes.dot3}`} />
                    </div>
                </div>
            </div>
        );
    }

    // Compact bubble version for chat list
    return (
        <div className={classes.bubbleContainer}>
            <div className={classes.bubble}>
                <div className={classes.shimmer} />
                <div className={`${classes.bubbleDot} ${classes.bubbleDot1}`} />
                <div className={`${classes.bubbleDot} ${classes.bubbleDot2}`} />
                <div className={`${classes.bubbleDot} ${classes.bubbleDot3}`} />
            </div>
        </div>
    );
};
