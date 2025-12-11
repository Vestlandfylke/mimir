import {
    BrandVariants,
    GriffelStyle,
    Theme,
    createDarkTheme,
    createLightTheme,
    makeStyles,
    shorthands,
    themeToTokensObject,
    tokens,
} from '@fluentui/react-components';

export const semanticKernelBrandRamp: BrandVariants = {
    10: '#007096',
    20: '#007096',
    30: '#007096',
    40: '#007096',
    50: '#007096',
    60: '#007096',
    70: '#007096',
    80: '#007096',
    90: '#007096',
    100: '#007096',
    110: '#007096',
    120: '#007096',
    130: '#007096',
    140: '#007096',
    150: '#007096',
    160: '#007096',
};

export const semanticKernelLightTheme: Theme & { colorMeBackground: string } = {
    ...createLightTheme(semanticKernelBrandRamp),
    colorMeBackground: '#e8ebf9',
};

export const semanticKernelDarkTheme: Theme & { colorMeBackground: string } = {
    ...createDarkTheme(semanticKernelBrandRamp),
    colorMeBackground: '#2b2b3e',
};

export const customTokens = themeToTokensObject(semanticKernelLightTheme);

export const Breakpoints = {
    // Tablets and smaller desktops
    small: (style: GriffelStyle): Record<string, GriffelStyle> => {
        return { '@media (max-width: 744px)': style };
    },
    // Mobile phones in landscape or larger phones
    extraSmall: (style: GriffelStyle): Record<string, GriffelStyle> => {
        return { '@media (max-width: 480px)': style };
    },
    // Mobile phones in portrait
    mobile: (style: GriffelStyle): Record<string, GriffelStyle> => {
        return { '@media (max-width: 390px)': style };
    },
};

export const ScrollBarStyles: GriffelStyle = {
    overflowY: 'auto',
    '&:hover': {
        '&::-webkit-scrollbar-thumb': {
            backgroundColor: tokens.colorScrollbarOverlay,
            visibility: 'visible',
        },
        '&::-webkit-scrollbar-track': {
            backgroundColor: tokens.colorNeutralBackground1,
            WebkitBoxShadow: 'inset 0 0 5px rgba(0, 0, 0, 0.1)',
            visibility: 'visible',
        },
    },
};

export const SharedStyles: Record<string, GriffelStyle> = {
    scroll: {
        height: '100%',
        ...ScrollBarStyles,
    },
    overflowEllipsis: {
        ...shorthands.overflow('hidden'),
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
};

export const useSharedClasses = makeStyles({
    informativeView: {
        display: 'flex',
        flexDirection: 'column',
        ...shorthands.padding('80px'),
        alignItems: 'center',
        ...shorthands.gap(tokens.spacingVerticalXL),
        marginTop: tokens.spacingVerticalXXXL,
    },
});

export const useDialogClasses = makeStyles({
    surface: {
        paddingRight: tokens.spacingVerticalXS,
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        ...shorthands.overflow('hidden'),
        width: '100%',
    },
    paragraphs: {
        marginTop: tokens.spacingHorizontalS,
    },
    innerContent: {
        height: '100%',
        ...SharedStyles.scroll,
        paddingRight: tokens.spacingVerticalL,
    },
    text: {
        whiteSpace: 'pre-wrap',
        textOverflow: 'wrap',
    },
    footer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        minWidth: '175px',
    },
});
