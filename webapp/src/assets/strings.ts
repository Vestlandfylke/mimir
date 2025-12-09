export const COPY = {
    STEPWISE_RESULT_NOT_FOUND_REGEX:
        /(Resultat ikkje funne, sjå gjennom _stepsTaken for å sjå kva som hende\.)\s+(\[{.*}])/g,
    CHAT_DELETED_MESSAGE: (chatName?: string) =>
        `Chat ${
            chatName ? `{${chatName}} ` : ''
        }er fjerna av ein annan brukar. Du kan framleis få tilgang til den siste chattehistorikken for no. Alt innhald i chatten vil bli tømt når du oppdaterer eller går ut av applikasjonen.`,
    REFRESH_APP_ADVISORY: 'Vennlegst oppdater sida for å sikre at du har dei nyaste dataene.',
};
