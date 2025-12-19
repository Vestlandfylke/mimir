// Copyright (c) Microsoft. All rights reserved.

import {
    Accordion,
    AccordionHeader,
    AccordionItem,
    AccordionPanel,
    Body1,
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogOpenChangeData,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    Divider,
    Label,
    Link,
    makeStyles,
    shorthands,
    tokens,
} from '@fluentui/react-components';
import { CommentMultiple24Regular } from '@fluentui/react-icons';
import React from 'react';
import { useAppSelector } from '../../../redux/app/hooks';
import { RootState } from '../../../redux/app/store';
import { SharedStyles, useDialogClasses } from '../../../styles';
import { TokenUsageGraph } from '../../token-usage/TokenUsageGraph';
import { SettingSection } from './SettingSection';

const useClasses = makeStyles({
    root: {
        ...shorthands.overflow('hidden'),
        display: 'flex',
        flexDirection: 'column',
        height: '600px',
    },
    outer: {
        paddingRight: tokens.spacingVerticalXS,
    },
    content: {
        height: '100%',
        ...SharedStyles.scroll,
        paddingRight: tokens.spacingVerticalL,
    },
    footer: {
        paddingTop: tokens.spacingVerticalL,
    },
    feedbackSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
        marginTop: tokens.spacingVerticalL,
        paddingTop: tokens.spacingVerticalM,
        paddingBottom: tokens.spacingVerticalXL,
        borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    feedbackLink: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        fontWeight: tokens.fontWeightSemibold,
    },
});

interface ISettingsDialogProps {
    open: boolean;
    closeDialog: () => void;
}

export const SettingsDialog: React.FC<ISettingsDialogProps> = ({ open, closeDialog }) => {
    const classes = useClasses();
    const dialogClasses = useDialogClasses();
    const { serviceInfo, settings, tokenUsage } = useAppSelector((state: RootState) => state.app);

    return (
        <Dialog
            open={open}
            onOpenChange={(_ev: any, data: DialogOpenChangeData) => {
                if (!data.open) closeDialog();
            }}
        >
            <DialogSurface className={classes.outer}>
                <DialogBody className={classes.root}>
                    <DialogTitle>Innstillingar</DialogTitle>
                    <DialogContent className={classes.content}>
                        <TokenUsageGraph tokenUsage={tokenUsage} />
                        <Accordion collapsible multiple defaultOpenItems={['basic']}>
                            <AccordionItem value="basic">
                                <AccordionHeader expandIconPosition="end">
                                    <h3>Grunnleggjande</h3>
                                </AccordionHeader>
                                <AccordionPanel>
                                    <SettingSection key={settings[0].title} setting={settings[0]} contentOnly />
                                </AccordionPanel>
                            </AccordionItem>
                            <Divider />
                            <AccordionItem value="advanced">
                                <AccordionHeader expandIconPosition="end" data-testid="advancedSettingsFoldup">
                                    <h3>Avansert</h3>
                                </AccordionHeader>
                                <AccordionPanel>
                                    <Body1 color={tokens.colorNeutralForeground3}>
                                        Enkelte innstillingar er som standard deaktiverte då dei ikkje er fullstendig
                                        støtta enno.
                                    </Body1>
                                    {settings.slice(1).map((setting) => {
                                        return <SettingSection key={setting.title} setting={setting} />;
                                    })}
                                </AccordionPanel>
                            </AccordionItem>
                            <Divider />
                            <AccordionItem value="about">
                                <AccordionHeader expandIconPosition="end">
                                    <h3>Om</h3>
                                </AccordionHeader>
                                <AccordionPanel>
                                    <Body1 color={tokens.colorNeutralForeground3}>
                                        Backend version: {serviceInfo.version}
                                        <br />
                                        Frontend version: {process.env.REACT_APP_SK_VERSION ?? '-'}
                                        <br />
                                        {process.env.REACT_APP_SK_BUILD_INFO}
                                    </Body1>
                                    <div className={classes.feedbackSection}>
                                        <Body1>
                                            Har du tilbakemeldingar eller forslag til forbetringar? Vi set pris på å
                                            høyre frå deg!
                                        </Body1>
                                        <Link
                                            href="https://forms.office.com/e/nPZciRWFFc"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={classes.feedbackLink}
                                        >
                                            <CommentMultiple24Regular />
                                            Gje innspel
                                        </Link>
                                    </div>
                                </AccordionPanel>
                            </AccordionItem>
                            <Divider />
                        </Accordion>
                    </DialogContent>
                </DialogBody>
                <DialogActions position="start" className={dialogClasses.footer}>
                    <Label size="small" color="brand" className={classes.footer}>
                        Mimir – KI-assistent for Vestland fylkeskommune{' '}
                        <a
                            href="https://vlfksky.sharepoint.com/sites/IT/SitePages/Kunstig-intelligens.aspx"
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            Les meir
                        </a>
                    </Label>
                    <DialogTrigger disableButtonEnhancement>
                        <Button appearance="secondary" data-testid="userSettingsCloseButton">
                            Lukk
                        </Button>
                    </DialogTrigger>
                </DialogActions>
            </DialogSurface>
        </Dialog>
    );
};
