// Copyright (c) Microsoft. All rights reserved.

import { Constants } from '../../../Constants';
import GithubIcon from '../../../assets/plugin-icons/github.png';
import JiraIcon from '../../../assets/plugin-icons/jira.png';
import GraphIcon from '../../../assets/plugin-icons/ms-graph.png';

/*
 * For each OpenAPI Spec you're supporting in the Kernel,
 * add all the relevant information here.
 */
export const enum BuiltInPlugins {
    MsGraph = 'Microsoft Graph',
    Jira = 'Jira',
    GitHub = 'GitHub',
    MsGraphObo = 'Microsoft Graph OBO',
}

export const enum AuthHeaderTags {
    MsGraph = 'graph',
    Jira = 'jira',
    GitHub = 'github',
    MsGraphObo = 'msgraphobo',
}

export interface PluginAuthRequirements {
    username?: boolean;
    email?: boolean;
    password?: boolean;
    personalAccessToken?: boolean;
    OAuth?: boolean;
    Msal?: boolean;
    scopes?: string[];
    helpLink?: string;
}

// Additional information required to enable OpenAPI functions, i.e., server-url
// Key should be the property name and in kebab case (valid format for request header),
// make sure it matches exactly with the property name the API requires
export type AdditionalApiProperties = Record<
    string,
    {
        required: boolean;
        helpLink?: string;
        value?: string;
        description?: string;
    }
>;

export interface Plugin {
    name: BuiltInPlugins | string;
    nameForModel?: string;
    publisher: string;
    description: string;
    enabled: boolean;
    authRequirements: PluginAuthRequirements;
    headerTag: AuthHeaderTags | string;
    icon: string; // Can be imported as shown above or direct URL
    authData?: string; // token or encoded auth header value
    apiProperties?: AdditionalApiProperties;
    manifestDomain?: string; // Website domain hosting the OpenAI Plugin Manifest file for custom plugins
}

export interface PluginsState {
    plugins: Plugins;
}

export type Plugins = Record<string, Plugin>;

export const initialState: PluginsState = {
    plugins: {
        [BuiltInPlugins.MsGraph]: {
            name: BuiltInPlugins.MsGraph,
            publisher: 'Microsoft',
            description: 'Bruk din Microsoft-konto for å få tilgang til din personlege Graph-informasjon og Microsoft-tenester.',
            enabled: false,
            authRequirements: {
                Msal: true,
                scopes: Constants.plugins.msGraphScopes,
            },
            headerTag: AuthHeaderTags.MsGraph,
            icon: GraphIcon,
        },
        [BuiltInPlugins.MsGraphObo]: {
            name: BuiltInPlugins.MsGraphObo,
            publisher: 'Microsoft',
            description: 'Use your Microsoft Account to access Graph API using OBO flow.',
            enabled: false,
            authRequirements: {
                Msal: true,
                scopes: Constants.plugins.msGraphOboScopes,
            },
            headerTag: AuthHeaderTags.MsGraphObo,
            icon: GraphIcon,
        },
        [BuiltInPlugins.Jira]: {
            name: BuiltInPlugins.Jira,
            publisher: 'Atlassian',
            description:
                'Autoriser Chat Copilot for å lenke med Jira og hente spesifikke saker ved å oppgi saksnøkkelen.',
            enabled: false,
            authRequirements: {
                email: true,
                personalAccessToken: true,
                helpLink: 'https://developer.atlassian.com/cloud/confluence/basic-auth-for-rest-apis/',
            },
            icon: JiraIcon,
            headerTag: AuthHeaderTags.Jira,
            apiProperties: {
                'jira-server-url': {
                    description: 'server-url, t.d. "https://<ditt-domene>.atlassian.net/rest/api/latest/"',
                    required: true,
                    helpLink:
                        'https://confluence.atlassian.com/adminjiraserver/configuring-the-base-url-938847830.html',
                },
            },
        },
        [BuiltInPlugins.GitHub]: {
            name: BuiltInPlugins.GitHub,
            publisher: 'Microsoft',
            description:
                'Integrer Github med Chat Copilot, t.d., la Chat CopilotBot liste aktive Pull Requests for deg.',
            enabled: false,
            authRequirements: {
                personalAccessToken: true,
                scopes: ['Les- og skrivetilgang til pull-førespurnader'],
                helpLink:
                    'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token',
            },
            icon: GithubIcon,
            headerTag: AuthHeaderTags.GitHub,
            apiProperties: {
                owner: {
                    required: false,
                    description: 'kontoeigar av repositoriet. t.d., "microsoft"',
                },
                repo: {
                    required: false,
                    description: 'namn på repositoriet. t.d., "semantic-kernel"',
                    helpLink: 'https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28#list-pull-requests',
                },
            },
        },
    },
};

export interface EnablePluginPayload {
    plugin: string;
    username?: string;
    email?: string;
    password?: string;
    accessToken?: string;
    apiProperties?: AdditionalApiProperties;
}
