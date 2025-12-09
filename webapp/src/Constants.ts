import botIcon1 from './assets/bot-icons/bot-icon-1.png';
import { EmbeddedAppHelper } from './libs/utils/EmbeddedAppHelper';

export const Constants = {
    app: {
        name: 'Mimir',
        updateCheckIntervalSeconds: 60 * 5,
        CONNECTION_ALERT_ID: 'connection-alert',
        // Supported file types for document import
        // Text documents: .txt, .pdf, .docx, .doc, .md, .html, .htm, .json, .csv, .xml, .rtf
        // Office documents: .xlsx, .xls, .pptx, .ppt
        // Images (require OCR): .jpg, .jpeg, .png, .tif, .tiff, .bmp, .gif, .webp
        importTypes:
            '.txt,.pdf,.docx,.doc,.md,.html,.htm,.json,.csv,.xml,.rtf,.xlsx,.xls,.pptx,.ppt,.jpg,.jpeg,.png,.tif,.tiff,.bmp,.gif,.webp',
    },
    msal: {
        // DYNAMIC: Use popup in embedded contexts (Teams, SharePoint, iframes),
        // redirect in normal browser (better UX, more reliable)
        method: EmbeddedAppHelper.getRecommendedAuthMethod(),
        cache: {
            cacheLocation: 'localStorage',
            storeAuthStateInCookie: false,
        },
        semanticKernelScopes: ['openid', 'offline_access', 'profile'],
        // MS Graph scopes required for loading user information
        msGraphAppScopes: ['User.ReadBasic.All'],
    },
    bot: {
        profile: {
            id: 'bot',
            fullName: 'Mimir',
            emailAddress: '',
            photo: botIcon1,
        },
        fileExtension: 'skcb',
        typingIndicatorTimeoutMs: 5000,
    },
    debug: {
        root: 'sk-chatbot',
    },
    sk: {
        service: {
            defaultDefinition: 'int',
        },
        // Reserved context variable names
        reservedWords: ['server_url', 'server-url'],
        // Flag used to indicate that the variable is unknown in plan preview
        UNKNOWN_VARIABLE_FLAG: '$???',
    },
    adoScopes: ['vso.work'],
    BATCH_REQUEST_LIMIT: 20,
    plugins: {
        // For a list of Microsoft Graph permissions, see https://learn.microsoft.com/en-us/graph/permissions-reference.
        // Your application registration will need to be granted these permissions in Azure Active Directory.
        msGraphScopes: ['Calendars.Read', 'Mail.Read', 'Mail.Send', 'Tasks.ReadWrite', 'User.Read'],
        msGraphOboScopes: ['[INCLUDE THE SCOPE FOR THE WEBAPI APP REGISTRATION HERE]'],
    },
    KEYSTROKE_DEBOUNCE_TIME_MS: 250,
};
