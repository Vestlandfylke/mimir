import { makeStyles, tokens } from '@fluentui/react-components';
import AddPluginIcon from '../../../assets/plugin-icons/add-plugin.png';
import { PluginWizard } from '../plugin-wizard/PluginWizard';
import { BaseCard } from './BaseCard';

const useClasses = makeStyles({
    root: {
        marginBottom: tokens.spacingVerticalXXL,
    },
});

export const AddPluginCard: React.FC = () => {
    const classes = useClasses();

    return (
        <div className={classes.root}>
            <BaseCard
                image={AddPluginIcon}
                header="Tilpassa Tillegg"
                secondaryText="AI-Utviklar"
                description="Legg til ditt eige ChatGPT-kompatible tillegg."
                action={<PluginWizard />}
                helpText="Vil du lære korleis du kan lage eit tilpassa tillegg?"
                helpLink="https://aka.ms/sk-plugins-howto"
            />
        </div>
    );
};
