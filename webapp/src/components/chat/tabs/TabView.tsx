// Copyright (c) Microsoft. All rights reserved.

import { Label, Link, makeStyles, shorthands, tokens } from '@fluentui/react-components';
import { SharedStyles } from '../../../styles';

const useClasses = makeStyles({
    root: {
        ...shorthands.margin(tokens.spacingVerticalM, tokens.spacingHorizontalM),
        ...SharedStyles.scroll,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: tokens.colorNeutralBackground3, // Same gray as ChatRoom
        height: '100%',
        overflowX: 'hidden', // Hide horizontal scrollbar
        '@media (max-width: 744px)': {
            ...shorthands.margin(tokens.spacingVerticalS, tokens.spacingHorizontalS),
        },
    },
    title: {
        '@media (max-width: 744px)': {
            fontSize: tokens.fontSizeBase500,
            marginTop: tokens.spacingVerticalS,
            marginBottom: tokens.spacingVerticalS,
        },
    },
    footer: {
        paddingTop: tokens.spacingVerticalL,
        '@media (max-width: 744px)': {
            paddingTop: tokens.spacingVerticalM,
            fontSize: tokens.fontSizeBase200,
        },
    },
});

interface ITabViewProps {
    title: string;
    learnMoreDescription?: string;
    learnMoreLink?: string;
    children?: React.ReactNode;
}

export const TabView: React.FC<ITabViewProps> = ({ title, learnMoreDescription, learnMoreLink, children }) => {
    const classes = useClasses();

    return (
        <div className={classes.root}>
            <h2 className={classes.title}>{title}</h2>
            {children}
            {learnMoreDescription && learnMoreLink && (
                <Label size="small" color="brand" className={classes.footer}>
                    Vil du lære meir om {learnMoreDescription}? Klikk{' '}
                    <Link href={learnMoreLink} target="_blank" rel="noreferrer">
                        her
                    </Link>
                    .
                </Label>
            )}
        </div>
    );
};
