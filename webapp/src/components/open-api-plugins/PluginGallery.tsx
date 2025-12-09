import {
    Body1,
    Button,
    Dialog,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    Label,
    Link,
    Subtitle1,
    Subtitle2,
    makeStyles,
    shorthands,
    tokens,
} from '@fluentui/react-components';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { usePlugins } from '../../libs/hooks';
import { AlertType } from '../../libs/models/AlertType';
import { useAppSelector } from '../../redux/app/hooks';
import { RootState } from '../../redux/app/store';
import { addAlert } from '../../redux/features/app/appSlice';
import { Plugin, PluginAuthRequirements } from '../../redux/features/plugins/PluginsState';
import { Dismiss24 } from '../shared/BundledIcons';
// import { AppsAddIn24 } from '../shared/BundledIcons';
import { AddPluginCard } from './cards/AddPluginCard';
import { PluginCard } from './cards/PluginCard';

const useClasses = makeStyles({
    root: {
        maxWidth: '1052px',
        height: '852px',
        width: 'fit-content',
        display: 'flex',
    },
    title: {
        ...shorthands.margin(0, 0, '12px'),
    },
    description: {
        ...shorthands.margin(0, 0, '12px'),
    },
    dialogContent: {
        ...shorthands.overflow('hidden'),
        display: 'flex',
        flexDirection: 'column',
    },
    content: {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        overflowY: 'auto',
        rowGap: '24px',
        columnGap: '24px',
        ...shorthands.padding('12px', '2px', '12px'),
        '&::-webkit-scrollbar-thumb': {
            backgroundColor: tokens.colorScrollbarOverlay,
            visibility: 'visible',
        },
    },
});

export const PluginGallery: React.FC = () => {
    const classes = useClasses();
    const dispatch = useDispatch();

    const { plugins } = useAppSelector((state: RootState) => state.plugins);
    const { serviceInfo } = useAppSelector((state: RootState) => state.app);
    const { conversations, selectedId } = useAppSelector((state: RootState) => state.conversations);
    const [open, setOpen] = useState(false);

    const [hostedPlugins, setHostedPlugins] = useState([] as Plugin[]);
    const { getPluginManifest } = usePlugins();

    useEffect(() => {
        function updateHostedPlugin() {
            setHostedPlugins([]);
            serviceInfo.availablePlugins.forEach((availablePlugin) => {
                getPluginManifest(availablePlugin.manifestDomain)
                    .then((manifest) => {
                        const newHostedPlugin = {
                            name: manifest.name_for_human,
                            publisher: 'N/A',
                            description: manifest.description_for_human,
                            enabled: conversations[selectedId].enabledHostedPlugins.includes(availablePlugin.name),
                            authRequirements: {} as PluginAuthRequirements,
                            icon: manifest.logo_url,
                        } as Plugin;
                        setHostedPlugins((hostedPlugins) => [...hostedPlugins, newHostedPlugin]);
                    })
                    .catch((error: Error) => {
                        dispatch(
                            addAlert({
                                message: `Kunne ikkje hente tillegget ${availablePlugin.name}: ${error.message}`,
                                type: AlertType.Error,
                            }),
                        );
                    });
            });
        }

        if (open) {
            updateHostedPlugin();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversations[selectedId], open, serviceInfo.availablePlugins]);

    return (
        <Dialog
            open={open}
            onOpenChange={(_event, data) => {
                setOpen(data.open);
            }}
        >
            <DialogTrigger>
                {/*                 <Button
                    data-testid="pluginButton"
                    style={{ color: 'white' }}
                    appearance="transparent"
                    icon={<AppsAddIn24 color="white" />}
                    title="Tilleggsgalleri"
                    aria-label="Tilleggsgalleri"
                >
                    Tillegg
                </Button> */}
            </DialogTrigger>
            <DialogSurface className={classes.root}>
                <DialogBody>
                    <DialogTitle
                        action={
                            <DialogTrigger action="close">
                                <Button
                                    data-testid="closeEnableCCPluginsPopUp"
                                    appearance="subtle"
                                    aria-label="lukk"
                                    icon={<Dismiss24 />}
                                />
                            </DialogTrigger>
                        }
                    >
                        <Subtitle1 block className={classes.title}>
                            Aktiver Chat Copilot-tillegg
                        </Subtitle1>
                        <Body1 as="p" block className={classes.description}>
                            Autoriser tillegg og få kraftigare botar!
                        </Body1>
                    </DialogTitle>
                    <DialogContent className={classes.dialogContent}>
                        <AddPluginCard />
                        <Subtitle2 block className={classes.title}>
                            Tilgjengelege Tillegg
                        </Subtitle2>
                        <div className={classes.content}>
                            {Object.entries(plugins).map((entry) => {
                                const plugin = entry[1];
                                return <PluginCard key={plugin.name} plugin={plugin} isHosted={false} />;
                            })}
                        </div>
                        <Subtitle2 block className={classes.title}>
                            Hosta Tillegg
                        </Subtitle2>
                        <div className={classes.content}>
                            {Object.entries(hostedPlugins).map((entry) => {
                                const plugin = entry[1];
                                return <PluginCard key={plugin.name} plugin={plugin} isHosted={true} />;
                            })}
                        </div>
                        <Label size="small" color="brand">
                            Vil du lære meir om tillegg? Klikk{' '}
                            <Link href="https://aka.ms/sk-plugins-howto" target="_blank" rel="noreferrer">
                                her
                            </Link>
                            .
                        </Label>
                    </DialogContent>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
