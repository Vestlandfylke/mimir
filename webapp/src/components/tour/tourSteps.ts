// Copyright (c) Microsoft. All rights reserved.

import { Step } from 'react-joyride';

/**
 * Tour steps for the Mimir application introduction.
 * Each step highlights a part of the UI and explains its function.
 *
 * Note: Targets use CSS selectors. Make sure the elements have the corresponding
 * data-tour attributes or IDs.
 *
 * The first step (welcome) uses a custom React component - see AppTour.tsx
 */
export const tourSteps: Step[] = [
    // Welcome - content is replaced with custom component in AppTour.tsx
    {
        target: 'body',
        content: '', // Replaced with WelcomeContent component
        placement: 'center',
        disableBeacon: true,
    },

    // Chat list / sidebar
    {
        target: '[data-tour="chat-list"]',
        content:
            'Her finn du alle samtalane dine. Du kan opprette nye samtalar, søke i eksisterande, og organisere dei.',
        placement: 'right',
        disableBeacon: true,
    },

    // New chat button
    {
        target: '[data-tour="new-chat-button"]',
        content:
            'Klikk her for å starte ein ny samtale. Du kan velje mellom ulike assistentar avhengig av kva du treng hjelp med.\n\nDu kan også bli med i delte samtaleøkter.',
        placement: 'right',
        disableBeacon: true,
    },

    // Message actions (info and copy buttons)
    {
        target: '[data-tour="message-actions"]',
        content:
            'På kvar melding frå Mimir finn du handlingsknappane: Info-knappen viser detaljar om svaret, og kopier-knappen let deg kopiere teksten eller ta skjermbilete.',
        placement: 'bottom',
        disableBeacon: true,
    },

    // Input field
    {
        target: '[data-tour="chat-input"]',
        content: 'Skriv spørsmåla og meldingane dine her. Trykk Enter eller klikk på send-knappen for å sende.',
        placement: 'top',
        disableBeacon: true,
    },

    // Attachment button
    {
        target: '[data-tour="attachment-button"]',
        content:
            'Last opp filer som Mimir kan analysere og svare på spørsmål om.\n\nStøtta filtypar:\n• Office: Word, Excel, PowerPoint, PDF\n• Tekst: TXT, HTML, Markdown, CSV, JSON\n• Bilete: JPG, PNG, GIF, WEBP, TIFF',
        placement: 'top',
        disableBeacon: true,
    },

    // Diagram button
    {
        target: '[data-tour="diagram-button"]',
        content: 'Lag diagram og visualiseringar. Vel diagramtype og beskriv kva du vil ha - Mimir lagar det for deg.',
        placement: 'top',
        disableBeacon: true,
    },

    // Share button
    {
        target: '[data-tour="share-button"]',
        content:
            'Del samtalen med kollegaer! Her kan du:\n\n• Invitere andre til å delta i samtalen i sanntid\n• Laste ned heile samtalehistorikken',
        placement: 'bottom',
        disableBeacon: true,
    },

    // Tabs overview
    {
        target: '[data-tour="tab-view"]',
        content:
            'Her kan du bytte mellom faner for denne samtalen.\n\nMerk: Dokument og tilpassingar du legg til her gjeld berre for denne samtalen – ikkje dei andre samtalane dine.',
        placement: 'bottom',
        disableBeacon: true,
    },

    // Documents tab - click to navigate
    {
        target: '[data-tour="tab-documents"]',
        content: 'Klikk på Dokument-fana for å administrere filer i samtalen.',
        placement: 'bottom',
        disableBeacon: true,
        data: { navigateToTab: 'documents' },
    },

    // Documents upload button
    {
        target: '[data-tour="documents-upload"]',
        content:
            'Her kan du laste opp filer som Mimir kan analysere.\n\nStøtta filtypar: Word, Excel, PowerPoint, PDF, TXT, HTML, Markdown, CSV, JSON, og bilete (JPG, PNG, GIF, m.m.)',
        placement: 'bottom',
        disableBeacon: true,
        data: { activeTab: 'documents' },
    },

    // Documents table - explain pin and delete
    {
        target: '[data-tour="documents-table"]',
        content:
            'Opplasta dokument blir vist her. For kvart dokument kan du:\n\n• Feste til kontekst - Dokumentet blir alltid inkludert når Mimir svarar\n• Løyse frå kontekst - Dokumentet er tilgjengeleg, men ikkje alltid inkludert\n• Slette - Fjernar dokumentet frå samtalen',
        placement: 'left',
        disableBeacon: true,
        data: { activeTab: 'documents' },
    },

    // Persona tab - click to navigate
    {
        target: '[data-tour="tab-persona"]',
        content: 'Klikk på Tilpassing-fana for å justere korleis Mimir svarar deg.',
        placement: 'bottom',
        disableBeacon: true,
        data: { navigateToTab: 'persona' },
    },

    // Persona model selector
    {
        target: '[data-tour="persona-model"]',
        content:
            'Her vel du kva KI-modell Mimir skal bruke:\n• GPT-5.2 Chat - Kraftig modell for dei fleste oppgåver\n• GPT-5.2 Reasoning - For kompleks analyse med tankeprosess\n• GPT-5 Mini - Rask og kostnadseffektiv',
        placement: 'right',
        disableBeacon: true,
        data: { activeTab: 'persona' },
    },

    // Persona custom instructions
    {
        target: '[data-tour="persona-instructions"]',
        content:
            'Skriv eigne instruksjonar til Mimir her. T.d. "Svar alltid på bokmål" eller "Forklar ting enkelt". Hugs å klikke Lagre!',
        placement: 'right',
        disableBeacon: true,
        data: { activeTab: 'persona' },
    },

    // Back to chat tab
    {
        target: '[data-tour="tab-chat"]',
        content: 'Klikk på Chat-fana for å gå tilbake til samtalen.',
        placement: 'bottom',
        disableBeacon: true,
        data: { navigateToTab: 'chat' },
    },

    // User menu
    {
        target: '[data-testid="userSettingsButton"]',
        content:
            'Din brukarmeny. Her finn du:\n• Innstillingar (mørk modus, fargetema)\n• Administrer samtalar\n• Start denne introduksjonen på nytt\n• Logg ut',
        placement: 'bottom-end',
        disableBeacon: true,
    },

    // Final step - content is replaced with custom component in AppTour.tsx
    {
        target: 'body',
        content: '', // Replaced with FinalContent component
        placement: 'center',
        disableBeacon: true,
    },
];

/**
 * Simplified tour for mobile/small screens
 */
export const mobileTourSteps: Step[] = [
    // Welcome - content is replaced with custom component in AppTour.tsx
    {
        target: 'body',
        content: '', // Replaced with WelcomeContent component
        placement: 'center',
        disableBeacon: true,
    },
    {
        target: '[data-tour="chat-input"]',
        content: 'Skriv spørsmåla dine her og trykk send.',
        placement: 'top',
        disableBeacon: true,
    },
    // Final step - content is replaced with custom component in AppTour.tsx
    {
        target: 'body',
        content: '', // Replaced with FinalContent component
        placement: 'center',
        disableBeacon: true,
    },
];
