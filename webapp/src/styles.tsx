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

// Create a brand ramp from a hex color
const createBrandRamp = (hexColor: string): BrandVariants => ({
    10: hexColor,
    20: hexColor,
    30: hexColor,
    40: hexColor,
    50: hexColor,
    60: hexColor,
    70: hexColor,
    80: hexColor,
    90: hexColor,
    100: hexColor,
    110: hexColor,
    120: hexColor,
    130: hexColor,
    140: hexColor,
    150: hexColor,
    160: hexColor,
});

// Default brand ramp (green)
export const semanticKernelBrandRamp: BrandVariants = createBrandRamp('#50A684');

// Segoe UI font families (Fluent UI default)
const segoeUiFontFamilyBase =
    '"Segoe UI", "Segoe UI Web (West European)", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", sans-serif';
const segoeUiFontFamilyMonospace = '"Cascadia Code", "Segoe UI Mono", Consolas, Monaco, "Courier New", monospace';

// Export font families for use in components
export const VlfkFonts = {
    base: segoeUiFontFamilyBase,
    mono: segoeUiFontFamilyMonospace,
    heading: segoeUiFontFamilyBase, // Use same font for headings (Fluent UI style)
};

// Create light theme with a specific brand color
export const createCustomLightTheme = (
    brandColor: string,
): Theme & { colorMeBackground: string; colorBotBackground: string } => ({
    ...createLightTheme(createBrandRamp(brandColor)),
    fontFamilyBase: segoeUiFontFamilyBase,
    fontFamilyMonospace: segoeUiFontFamilyMonospace,
    colorMeBackground: '#e8ebf9', // Brukar-meldingar i lys modus
    colorBotBackground: '#ffffff', // Bot-meldingar i lys modus (original)
});

// Create dark theme with a specific brand color
export const createCustomDarkTheme = (
    brandColor: string,
): Theme & { colorMeBackground: string; colorBotBackground: string } => ({
    ...createDarkTheme(createBrandRamp(brandColor)),
    fontFamilyBase: segoeUiFontFamilyBase,
    fontFamilyMonospace: segoeUiFontFamilyMonospace,
    // Mjukare mørk modus - nøytral grå som Cursor
    colorNeutralBackground1: '#1e1e1e', // Hovudbakgrunn
    colorNeutralBackground2: '#252526', // Sekundær bakgrunn
    colorNeutralBackground3: '#2d2d2d', // Tertiær bakgrunn
    colorNeutralBackground4: '#333333', // Fjerde nivå
    colorNeutralBackground5: '#3c3c3c', // Femte nivå
    colorNeutralBackground6: '#454545', // Sjette nivå
    colorSubtleBackground: '#252526',
    colorSubtleBackgroundHover: '#2d2d2d',
    colorSubtleBackgroundPressed: '#333333',
    colorNeutralBackgroundStatic: '#1e1e1e',
    colorMeBackground: '#3c3c3c', // Brukar-meldingar i mørk modus
    colorBotBackground: '#333333', // Bot-meldingar i mørk modus
});

// Default themes (for backwards compatibility)
export const semanticKernelLightTheme = createCustomLightTheme('#50A684');
export const semanticKernelDarkTheme = createCustomDarkTheme('#50A684');

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
