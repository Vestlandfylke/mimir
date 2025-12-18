import {
    Body1,
    Button,
    Card,
    CardHeader,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    makeStyles,
    shorthands,
    Text,
    tokens,
} from '@fluentui/react-components';
import { Dismiss12Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { Plan } from '../../../libs/models/Plan';

const useClasses = makeStyles({
    card: {
        ...shorthands.margin('auto'),
        width: '700px',
        maxWidth: '100%',
        overflowX: 'hidden',
    },
    headerText: {
        // Prevent long tool names/descriptions from forcing horizontal overflow.
        maxWidth: '100%',
        overflow: 'hidden',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        // Cut off after a couple of lines for a cleaner, more professional look.
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
    },
    header: {
        color: tokens.colorBrandForeground1,
    },
    parameters: {
        ...shorthands.gap(tokens.spacingHorizontalS),
        display: 'flex',
        flexWrap: 'wrap',
        maxWidth: '100%',
        minWidth: 0,
    },
    bar: {
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        width: '4px',
        backgroundColor: tokens.colorBrandBackground,
    },
    flexRow: {
        display: 'flex',
        flexDirection: 'row',
        minWidth: 0,
    },
    flexColumn: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minWidth: 0,
        marginLeft: tokens.spacingHorizontalS,
        marginTop: tokens.spacingVerticalXS,
        marginBottom: tokens.spacingVerticalXS,
        ...shorthands.gap(tokens.spacingHorizontalS),
    },
    singleLine: {
        ...shorthands.overflow('hidden'),
        lineHeight: tokens.lineHeightBase200,
        display: '-webkit-box',
        WebkitLineClamp: 1,
        WebkitBoxOrient: 'vertical',
        width: '100%',
        fontSize: tokens.fontSizeBase200,
    },
    dialog: {
        width: '398px',
        '& button': {
            marginTop: tokens.spacingVerticalL,
            width: 'max-content',
        },
    },
    errorMessage: {
        fontSize: tokens.fontSizeBase300,
        color: tokens.colorPaletteRedForeground1,
    },
});

interface PlanStepCardProps {
    /* eslint-disable 
        @typescript-eslint/no-unsafe-assignment,
        @typescript-eslint/no-unsafe-member-access,
        @typescript-eslint/no-unsafe-call 
    */
    step: Plan;
    enableEdits: boolean;
    enableStepDelete: boolean;
    onDeleteStep: (index: number) => void;
}

export const PlanStepCard: React.FC<PlanStepCardProps> = ({ step, enableEdits, enableStepDelete, onDeleteStep }) => {
    const classes = useClasses();
    const [openDialog, setOpenDialog] = useState(false);

    return (
        <Card className={classes.card}>
            <div className={classes.flexRow}>
                <div className={classes.bar} />
                <div className={classes.flexColumn}>
                    <CardHeader
                        header={
                            <Body1 className={classes.headerText}>
                                <b className={classes.header}>Steg {step.index + 1}</b>
                            </Body1>
                        }
                        action={
                            enableEdits && enableStepDelete ? (
                                <Dialog open={openDialog}>
                                    <DialogTrigger disableButtonEnhancement>
                                        <Button
                                            appearance="transparent"
                                            icon={<Dismiss12Regular />}
                                            aria-label="Slett steg"
                                            onClick={() => {
                                                setOpenDialog(true);
                                            }}
                                        />
                                    </DialogTrigger>
                                    <DialogSurface className={classes.dialog}>
                                        <DialogBody>
                                            <DialogTitle>Er du sikker på at du vil slette dette steget?</DialogTitle>
                                            <DialogContent>
                                                {
                                                    'Å slette dette steget kan forstyrre planens opprinnelige logikk og føre til feil i påfølgende steg. Sørg for at neste steg ikkje er avhengig av dette stegets utdata.'
                                                }
                                            </DialogContent>
                                            <DialogActions>
                                                <DialogTrigger disableButtonEnhancement>
                                                    <Button
                                                        appearance="secondary"
                                                        onClick={() => {
                                                            setOpenDialog(false);
                                                        }}
                                                    >
                                                        Avbryt
                                                    </Button>
                                                </DialogTrigger>
                                                <Button
                                                    appearance="primary"
                                                    onClick={() => {
                                                        setOpenDialog(false);
                                                        onDeleteStep(step.index);
                                                    }}
                                                >
                                                    Ja, slett steg
                                                </Button>
                                            </DialogActions>
                                        </DialogBody>
                                    </DialogSurface>
                                </Dialog>
                            ) : undefined
                        }
                    />
                    {step.description && (
                        <div className={classes.singleLine}>
                            <Text weight="semibold">Om: </Text> <Text>{step.description}</Text>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};
