// Copyright (c) Microsoft. All rights reserved.
// Helper utilities for detecting and handling embedded app contexts (Teams, SharePoint, iframes, etc.)

/**
 * Detects if the app is running inside an iframe
 * This covers Teams, SharePoint, Power Apps, and any other embedded scenario
 */
export const isInIframe = (): boolean => {
    try {
        return window.self !== window.top;
    } catch (e) {
        // If we can't access window.top due to cross-origin restrictions,
        // we're definitely in an iframe
        return true;
    }
};

/**
 * Detects if the app is running inside Microsoft Teams specifically
 * Requires @microsoft/teams-js to be installed
 */
export const isInTeams = (): boolean => {
    // Check for Teams-specific indicators
    const url = window.location.href.toLowerCase();
    const hasTeamsParam = url.includes('teams') || url.includes('context=teams');

    // Check if running in Teams iframe
    const hasTeamsUserAgent = navigator.userAgent.toLowerCase().includes('teams');

    // Check for Teams context in sessionStorage (set by Teams when loading)
    const hasTeamsContext = sessionStorage.getItem('teamsContext') !== null;

    return hasTeamsParam || hasTeamsUserAgent || hasTeamsContext;
};

/**
 * Detects if the app is running inside SharePoint
 */
export const isInSharePoint = (): boolean => {
    const url = window.location.href.toLowerCase();
    return url.includes('sharepoint.com') || url.includes('_layouts');
};

/**
 * Gets the recommended authentication method based on the context
 * - 'popup': For iframe/embedded contexts (Teams, SharePoint, etc.)
 * - 'redirect': For normal browser contexts (better UX, more reliable)
 */
export const getRecommendedAuthMethod = (): 'popup' | 'redirect' => {
    // Use popup in any iframe context to avoid navigation issues
    if (isInIframe()) {
        console.log('Embedded context detected - using popup authentication');
        return 'popup';
    }

    // Use redirect in normal browser context (better UX)
    console.log('Browser context detected - using redirect authentication');
    return 'redirect';
};

/**
 * Gets the context name for logging/debugging
 */
export const getAppContext = (): string => {
    if (isInTeams()) return 'Microsoft Teams';
    if (isInSharePoint()) return 'SharePoint';
    if (isInIframe()) return 'Embedded (iframe)';
    return 'Browser';
};

export const EmbeddedAppHelper = {
    isInIframe,
    isInTeams,
    isInSharePoint,
    getRecommendedAuthMethod,
    getAppContext,
};
