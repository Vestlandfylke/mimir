// Copyright (c) Microsoft. All rights reserved.

import { Body1, Subtitle1, Title3 } from '@fluentui/react-components';
import { FC } from 'react';
import { useClasses } from '../../App';

interface IData {
    missingVariables: string[];
}

const MissingEnvVariablesError: FC<IData> = ({ missingVariables }) => {
    const classes = useClasses();

    return (
        <div className={classes.container}>
            <div className={classes.header}>
                <Subtitle1 as="h1">Mimir-prat</Subtitle1>
            </div>
            <div style={{ padding: 80, gap: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Title3>
                    {
                        'Vennligst sørg for at din ".env"-fil er sett opp korrekt med alle miljøvariablar definert i ".env.example" og start appen på nytt.'
                    }
                </Title3>
                <Body1>Du manglar følgjande variablar: {missingVariables.join(', ')}</Body1>
            </div>
        </div>
    );
};

export default MissingEnvVariablesError;
