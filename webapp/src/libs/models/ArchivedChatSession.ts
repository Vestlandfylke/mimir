// Copyright (c) Microsoft. All rights reserved.

/**
 * Interface for an archived chat session summary with counts.
 */
export interface IArchivedChatSession {
    id: string;
    originalChatId: string;
    title: string;
    createdOn: string;
    deletedAt: string;
    deletedBy: string;
    systemDescription: string;
    memoryBalance: number;
    enabledPlugins: string[];
    version?: string;
    template?: string;
    modelId?: string;
    // Summary counts
    messageCount: number;
    documentCount: number;
    participantCount: number;
}

/**
 * Calculate days remaining until permanent deletion.
 */
export const getDaysUntilDeletion = (deletedAt: string, retentionDays = 180): number => {
    const deletedDate = new Date(deletedAt);
    const expirationDate = new Date(deletedDate.getTime() + retentionDays * 24 * 60 * 60 * 1000);
    const now = new Date();
    const msRemaining = expirationDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
};

/**
 * Format the deletion date for display.
 */
export const formatDeletedDate = (deletedAt: string): string => {
    const date = new Date(deletedAt);
    return date.toLocaleDateString('nb-NO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};
