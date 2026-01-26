// Copyright (c) Microsoft. All rights reserved.

import { makeStyles, shorthands, Text, tokens, Tooltip } from '@fluentui/react-components';
import { Checkmark20Filled } from '@fluentui/react-icons';
import React, { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../../redux/app/hooks';
import { RootState } from '../../../redux/app/store';
import { BrandColorKey, BrandColors } from '../../../redux/features/app/AppState';
import { setBrandColor } from '../../../redux/features/app/appSlice';

const useClasses = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
        marginTop: tokens.spacingVerticalM,
        marginBottom: tokens.spacingVerticalM,
    },
    label: {
        fontWeight: tokens.fontWeightSemibold,
        marginBottom: tokens.spacingVerticalXS,
    },
    colorGrid: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: tokens.spacingHorizontalS,
    },
    colorButton: {
        width: '36px',
        height: '36px',
        ...shorthands.borderRadius('50%'),
        ...shorthands.border('2px', 'solid', 'transparent'),
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.1s ease, border-color 0.1s ease',
        '&:hover': {
            transform: 'scale(1.1)',
        },
    },
    selected: {
        ...shorthands.border('2px', 'solid', tokens.colorNeutralForeground1),
    },
    checkmark: {
        color: 'white',
        filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5))',
    },
});

export const BrandColorPicker: React.FC = () => {
    const classes = useClasses();
    const dispatch = useAppDispatch();
    const { brandColor } = useAppSelector((state: RootState) => state.app);

    const handleColorChange = useCallback(
        (colorKey: BrandColorKey) => {
            dispatch(setBrandColor(colorKey));
        },
        [dispatch],
    );

    return (
        <div className={classes.container}>
            <Text className={classes.label}>Temafarge</Text>
            <div className={classes.colorGrid}>
                {(Object.keys(BrandColors) as BrandColorKey[]).map((colorKey) => {
                    const color = BrandColors[colorKey];
                    const isSelected = brandColor === colorKey;
                    return (
                        <Tooltip key={colorKey} content={color.name} relationship="label">
                            <button
                                type="button"
                                className={`${classes.colorButton} ${isSelected ? classes.selected : ''}`}
                                style={{ backgroundColor: color.hex }}
                                onClick={() => {
                                    handleColorChange(colorKey);
                                }}
                                aria-label={`${color.name}${isSelected ? ' (vald)' : ''}`}
                            >
                                {isSelected && <Checkmark20Filled className={classes.checkmark} />}
                            </button>
                        </Tooltip>
                    );
                })}
            </div>
        </div>
    );
};
