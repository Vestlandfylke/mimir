// Copyright (c) Microsoft. All rights reserved.

import { Button, Subtitle2 } from '@fluentui/react-components';
import { ArrowSync20Regular, ErrorCircleRegular } from '@fluentui/react-icons';
import { FC } from 'react';
import { COPY, refreshPage } from '../../assets/strings';
import { useSharedClasses } from '../../styles';

interface IErrorProps {
    text: string;
    /** Show a refresh button below the error message */
    showRefresh?: boolean;
}

export const Error: FC<IErrorProps> = ({ text, showRefresh = true }) => {
    const classes = useSharedClasses();
    return (
        <div className={classes.informativeView}>
            <ErrorCircleRegular fontSize={36} color="red" />
            <Subtitle2>{text}</Subtitle2>
            {showRefresh && (
                <Button
                    appearance="primary"
                    icon={<ArrowSync20Regular />}
                    onClick={refreshPage}
                    style={{ marginTop: '16px' }}
                >
                    {COPY.REFRESH_BUTTON_TEXT}
                </Button>
            )}
        </div>
    );
};
