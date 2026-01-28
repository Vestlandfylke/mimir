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
 * Uses multiple detection methods for reliability
 */
export const isInTeams = (): boolean => {
    // Method 1: Check URL parameters
    const url = window.location.href.toLowerCase();
    const hasTeamsParam = url.includes('teams') || url.includes('context=teams');

    // Method 2: Check user agent
    const userAgent = navigator.userAgent.toLowerCase();
    const hasTeamsUserAgent = userAgent.includes('teams');

    // Method 3: Check for Teams context in sessionStorage
    const hasTeamsContext = sessionStorage.getItem('teamsContext') !== null;

    // Method 4: Check for Teams-specific hostnames
    const hasTeamsHost =
        url.includes('teams.microsoft.com') ||
        url.includes('teams.cloud.microsoft') ||
        url.includes('.sharepoint.com/_layouts/15/teamslogon.aspx');

    const result = hasTeamsParam || hasTeamsUserAgent || hasTeamsContext || hasTeamsHost;

    // Store result for future use
    if (result) {
        sessionStorage.setItem('teamsContext', 'true');
    }

    return result;
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
        return 'popup';
    }

    // Use redirect in normal browser context (better UX)
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
