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
    makeStyles,
    shorthands,
    tokens,
} from '@fluentui/react-components';
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
                                </AccordionPanel>
                            </AccordionItem>
                            <Divider />
                        </Accordion>
                    </DialogContent>
                </DialogBody>
                <DialogActions position="start" className={dialogClasses.footer}>
                    <Label size="small" color="brand" className={classes.footer}>
                        Pilot prosjekt for VLFK{' '}
                        <a href="https://vlfksky.sharepoint.com/sites/IT/SitePages/Kunstig-intelligens.aspx" target="_blank" rel="noreferrer">
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
