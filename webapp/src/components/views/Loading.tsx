// Copyright (c) Microsoft. All rights reserved.

import { makeStyles, Spinner } from '@fluentui/react-components';
import { FC } from 'react';
import { useSharedClasses } from '../../styles';

const useClasses = makeStyles({
    spinner: {
        '& .fui-Spinner__label': {
            fontWeight: '600',
        },
    },
});

interface ILoadingProps {
    text: string;
}

export const Loading: FC<ILoadingProps> = ({ text }) => {
    const classes = useClasses();
    const sharedClasses = useSharedClasses();
    return (
        <div className={sharedClasses.informativeView}>
            <Spinner className={classes.spinner} labelPosition="below" label={text} />
        </div>
    );
};
