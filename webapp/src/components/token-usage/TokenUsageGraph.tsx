import {
    Body1,
    Button,
    Divider,
    makeStyles,
    mergeClasses,
    Popover,
    PopoverSurface,
    PopoverTrigger,
    shorthands,
    Text,
    tokens,
} from '@fluentui/react-components';
import { Brands } from '@fluentui/tokens';
import {
    TokenUsage,
    TokenUsageFunctionNameMap,
    TokenUsageView,
    TokenUsageViewDetails,
} from '../../libs/models/TokenUsage';
import { useAppSelector } from '../../redux/app/hooks';
import { RootState } from '../../redux/app/store';
import { semanticKernelBrandRamp } from '../../styles';
import { TypingIndicator } from '../chat/typing-indicator/TypingIndicator';
import { Info16 } from '../shared/BundledIcons';
import { TokenUsageBar } from './TokenUsageBar';
import { TokenUsageLegendItem } from './TokenUsageLegendItem';

const useClasses = makeStyles({
    horizontal: {
        display: 'flex',
        ...shorthands.gap(tokens.spacingVerticalSNudge),
        alignItems: 'center',
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        ...shorthands.gap(tokens.spacingHorizontalS),
        paddingBottom: tokens.spacingHorizontalM,
    },
    popover: {
        width: '300px',
    },
    header: {
        marginBlockEnd: tokens.spacingHorizontalM,
    },
    legend: {
        'flex-flow': 'wrap',
    },
    divider: {
        width: '97%',
    },
});

interface ITokenUsageGraph {
    tokenUsage: TokenUsage;
    promptView?: boolean;
}

const contrastColors = [
    tokens.colorPaletteBlueBackground2,
    tokens.colorPaletteBlueForeground2,
    tokens.colorPaletteBlueBorderActive,
];

export const TokenUsageGraph: React.FC<ITokenUsageGraph> = ({ promptView, tokenUsage }) => {
    const classes = useClasses();
    const { conversations, selectedId } = useAppSelector((state: RootState) => state.conversations);
    const loadingResponse =
        selectedId !== '' && conversations[selectedId].botResponseStatus && Object.entries(tokenUsage).length === 0;

    const responseGenerationView: TokenUsageView = {};
    const memoryGenerationView: TokenUsageView = {};
    let memoryGenerationUsage = 0;
    let responseGenerationUsage = 0;

    const graphColors = {
        brand: {
            // Color index of semanticKernelBrandRamp array defined in styles.ts
            legend: 120 as Brands,
            index: 120 as Brands,
            getNextIndex: () => {
                const nextIndex = graphColors.brand.index - 20;
                return (nextIndex < 0 ? 160 : nextIndex) as Brands;
            },
        },
        contrast: {
            // Color index of contrastColors array defined above
            legend: 0,
            index: 0,
            getNextIndex: () => {
                return graphColors.contrast.index++ % 3;
            },
        },
    };

    Object.entries(tokenUsage).forEach(([key, value]) => {
        if (value && value > 0) {
            const viewDetails: TokenUsageViewDetails = {
                usageCount: value,
                legendLabel: TokenUsageFunctionNameMap[key],
                color: semanticKernelBrandRamp[graphColors.brand.index],
            };

            if (key.toLocaleUpperCase().includes('MEMORY')) {
                memoryGenerationUsage += value;
                viewDetails.color = contrastColors[graphColors.contrast.getNextIndex()];
                memoryGenerationView[key] = viewDetails;
            } else {
                responseGenerationUsage += value;
                graphColors.brand.index = graphColors.brand.getNextIndex();
                responseGenerationView[key] = viewDetails;
            }
        }
    });

    const totalUsage = memoryGenerationUsage + responseGenerationUsage;

    return (
        <>
            <h3 className={classes.header}>
                Tokenbruk
                <Popover withArrow>
                    <PopoverTrigger disableButtonEnhancement>
                        <Button icon={<Info16 />} appearance="transparent" />
                    </PopoverTrigger>
                    <PopoverSurface className={classes.popover}>
                        <Body1>
                            Token er måleeininga for kor mykje tekst KI-en les og skriv. Fleire token betyr lengre
                            tekstar eller meir komplekse svar.
                        </Body1>
                    </PopoverSurface>
                </Popover>
            </h3>
            <div className={classes.content}>
                {loadingResponse ? (
                    <Body1>
                        Endeleg tokenbruk vil bli tilgjengeleg når Mimir-svaret er generert.
                        <TypingIndicator />
                    </Body1>
                ) : (
                    <>
                        {totalUsage > 0 ? (
                            <>
                                {!promptView && <Text>Totalt tokenbruk for noverande økt</Text>}
                                <div className={classes.horizontal} style={{ gap: tokens.spacingHorizontalXXS }}>
                                    {Object.entries(responseGenerationView).map(([key, details]) => {
                                        return <TokenUsageBar key={key} details={details} totalUsage={totalUsage} />;
                                    })}
                                    {Object.entries(memoryGenerationView).map(([key, details]) => {
                                        return <TokenUsageBar key={key} details={details} totalUsage={totalUsage} />;
                                    })}
                                </div>
                                <div className={mergeClasses(classes.legend, classes.horizontal)}>
                                    <TokenUsageLegendItem
                                        key={'Svar'}
                                        name={'Svar'}
                                        usageCount={responseGenerationUsage}
                                        items={Object.values(responseGenerationView)}
                                        color={semanticKernelBrandRamp[graphColors.brand.legend]}
                                    />
                                    <TokenUsageLegendItem
                                        key={'Dokument og minne'}
                                        name={'Dokument og minne'}
                                        usageCount={memoryGenerationUsage}
                                        items={Object.values(memoryGenerationView)}
                                        color={contrastColors[graphColors.contrast.legend]}
                                    />
                                </div>
                            </>
                        ) : promptView ? (
                            <Text>Ingen token vart brukt i denne spørsmålai denne meldinga.</Text>
                        ) : (
                            <Text>Ingen token har blitt brukt i denne økta enno.</Text>
                        )}
                    </>
                )}
            </div>
            <Divider className={classes.divider} />
        </>
    );
};
