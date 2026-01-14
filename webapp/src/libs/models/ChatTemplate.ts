// Copyright (c) Microsoft. All rights reserved.

/**
 * Represents a chat template available to the current user.
 */
export interface IAvailableTemplate {
    /** The template identifier (key in config). */
    id: string;
    /** Display name for the UI. */
    displayName: string;
    /** Description of what this assistant does. */
    description?: string;
    /** Icon identifier for the template. */
    icon?: string;
}
