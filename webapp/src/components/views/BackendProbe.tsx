// Copyright (c) Microsoft. All rights reserved.

import { useMsal } from '@azure/msal-react';
import { Body1, makeStyles, Spinner, tokens } from '@fluentui/react-components';
import { FC, useEffect, useMemo, useState } from 'react';
import { renderApp } from '../../index';
import { AuthHelper } from '../../libs/auth/AuthHelper';
import { NetworkErrorMessage } from '../../libs/services/BaseService';
import { MaintenanceService, MaintenanceStatus } from '../../libs/services/MaintenanceService';
import { useAppDispatch, useAppSelector } from '../../redux/app/hooks';
import { RootState } from '../../redux/app/store';
import { setMaintenance } from '../../redux/features/app/appSlice';

const useClasses = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        background: `linear-gradient(135deg, ${tokens.colorNeutralBackground1} 0%, ${tokens.colorNeutralBackground3} 100%)`,
        position: 'relative',
        overflow: 'hidden',
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: '420px',
        textAlign: 'center',
        padding: tokens.spacingHorizontalXXL,
        gap: tokens.spacingVerticalL,
    },
    title: {
        fontSize: '20px',
        fontWeight: '600',
        color: tokens.colorNeutralForeground1,
    },
    message: {
        fontSize: '14px',
        color: tokens.colorNeutralForeground3,
        lineHeight: '1.5',
    },
    note: {
        fontSize: '13px',
        color: tokens.colorNeutralForeground2,
        fontWeight: '500',
    },
});

interface IData {
    onBackendFound: () => void;
}

export const BackendProbe: FC<IData> = ({ onBackendFound }) => {
    const classes = useClasses();
    const dispatch = useAppDispatch();
    const { isMaintenance } = useAppSelector((state: RootState) => state.app);
    const maintenanceService = useMemo(() => new MaintenanceService(), []);
    const { instance, inProgress } = useMsal();

    const [model, setModel] = useState<MaintenanceStatus | null>(null);

    useEffect(() => {
        const timer = setInterval(() => {
            const onBackendFoundWithAuthCheck = () => {
                if (!AuthHelper.getAuthConfig()) {
                    // if we don't have the auth config, re-render the app:
                    renderApp();
                } else {
                    // otherwise, we can load as normal
                    onBackendFound();
                }
            };

            AuthHelper.getSKaaSAccessToken(instance, inProgress)
                .then((token) =>
                    maintenanceService
                        .getMaintenanceStatus(token)
                        .then((data) => {
                            // Body has payload. This means the app is in maintenance
                            setModel(data);
                        })
                        .catch((e: any) => {
                            if (e instanceof Error && e.message.includes(NetworkErrorMessage)) {
                                // a network error was encountered, so we should probe until we find the backend:
                                return;
                            }

                            // JSON Exception since response has no body. This means app is not in maintenance.
                            dispatch(setMaintenance(false));
                            onBackendFoundWithAuthCheck();
                        }),
                )
                .catch(() => {
                    // Ignore - we'll retry on the next interval
                });
        }, 3000);

        return () => {
            clearInterval(timer);
        };
    }, [dispatch, maintenanceService, onBackendFound, instance, inProgress]);

    return (
        <div className={classes.container}>
            <div className={classes.content}>
                {isMaintenance ? (
                    <>
                        <h2 className={classes.title}>{model?.title ?? 'Vedlikehald pågår'}</h2>
                        <Spinner size="large" />
                        <Body1 className={classes.message}>
                            {model?.message ??
                                'Planlagt vedlikehald av nettstaden pågår. Vi beklagar for ulempene dette medfører.'}
                        </Body1>
                        <span className={classes.note}>
                            {model?.note ?? 'Om denne meldinga ikkje forsvinn, prøv å oppdatere sida.'}
                        </span>
                    </>
                ) : (
                    <>
                        <Spinner size="large" />
                        <span className={classes.message}>Koblar til Mimir...</span>
                    </>
                )}
            </div>
        </div>
    );
};
