// Copyright (c) Microsoft. All rights reserved.

import { useMsal } from '@azure/msal-react';
import { Body1, Button, Image, Title3 } from '@fluentui/react-components';
import React from 'react';
import signInLogo from '../../ms-symbollockup_signin_light.png';
import { useSharedClasses } from '../../styles';
import { getErrorDetails } from '../utils/TextUtils';

export const Login: React.FC = () => {
    const { instance } = useMsal();
    const classes = useSharedClasses();

    return (
        <div className={classes.informativeView}>
            <Title3>Velkommen til Mimir</Title3>
            <Body1>
                Den klokaste av alle gudar i norrøn mytologi! Mimir voktar kunnskapens brønn under
                Yggdrasil, og no har du tilgang til visdommen hans.
                <br />
                <br />
                Mimir er her for å gi deg verdifulle råd og innsikt – akkurat som han gjorde for Odin.
            </Body1>

            <Button
                style={{ padding: 0 }}
                appearance="transparent"
                onClick={() => {
                    instance.loginRedirect().catch((e: unknown) => {
                        alert(`Feil ved innlogging: ${getErrorDetails(e)}`);
                    });
                }}
                data-testid="signinButton"
            >
                <Image src={signInLogo} />
            </Button>
        </div>
    );
};
