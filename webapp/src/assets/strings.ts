export const COPY = {
    STEPWISE_RESULT_NOT_FOUND_REGEX:
        /(Resultat ikkje funne, sjå gjennom _stepsTaken for å sjå kva som hende\.)\s+(\[{.*}])/g,
    CHAT_DELETED_MESSAGE: (chatName?: string) =>
        `Chat ${
            chatName ? `{${chatName}} ` : ''
        }er fjerna av ein annan brukar. Du kan framleis få tilgang til den siste chattehistorikken for no. Alt innhald i chatten vil bli tømt når du oppdaterer eller går ut av applikasjonen.`,
    REFRESH_APP_ADVISORY: 'Vennlegst oppdater sida for å sikre at du har dei nyaste dataene.',

    // Consistent refresh-related messages
    REFRESH_BUTTON_TEXT: 'Oppdater sida',
    CONNECTION_LOST: 'Tilkoplinga vart avbroten.',
    CONNECTION_ERROR: 'Kunne ikkje kople til tenaren.',
    LOADING_ERROR_USER: 'Klarte ikkje å laste brukarinfo.',
    LOADING_ERROR_CHATS: 'Klarte ikkje å laste samtalar.',
    SEND_ERROR: 'Kunne ikkje sende meldinga.',

    // Leave chat messages
    CHAT_USER_LEFT_MESSAGE: (chatName?: string) =>
        `Ein brukar har forlate samtalen${chatName ? ` "${chatName}"` : ''}.`,

    // Trash / Archive messages
    CHAT_ARCHIVED_MESSAGE: (chatName?: string) =>
        `Samtale${chatName ? ` "${chatName}"` : ''} er flytta til papirkorga av ein annan brukar.`,
    CHAT_RESTORED_MESSAGE: 'Ein samtale er gjenoppretta frå papirkorga.',
    TRASH_EMPTY: 'Papirkorga er tom.',
    TRASH_LOADING: 'Lastar papirkorga...',
    TRASH_ERROR: 'Kunne ikkje laste papirkorga.',
    TRASH_RESTORE_SUCCESS: 'Samtalen er gjenoppretta.',
    TRASH_DELETE_CONFIRM: 'Er du sikker på at du vil slette denne samtalen permanent? Dette kan ikkje angrast.',
    TRASH_DELETE_SUCCESS: 'Samtalen er permanent sletta.',
    DAYS_UNTIL_DELETE: (days: number) => `${days} ${days === 1 ? 'dag' : 'dagar'} til sletting`,
};

/**
 * Refresh the page - useful for mobile users who may not know how to refresh
 */
export const refreshPage = () => {
    window.location.reload();
};
