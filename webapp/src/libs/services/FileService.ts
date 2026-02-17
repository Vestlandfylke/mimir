// Copyright (c) Microsoft. All rights reserved.

import { BaseService } from './BaseService';

export interface IGeneratedFileInfo {
    id: string;
    fileName: string;
    contentType: string;
    size: number;
    createdOn: string;
    expiresOn: string | null;
    chatId: string;
    downloadUrl: string;
}

export class FileService extends BaseService {
    public getMyFilesAsync = async (accessToken: string): Promise<IGeneratedFileInfo[]> => {
        return await this.getResponseAsync<IGeneratedFileInfo[]>(
            { commandPath: 'files/my', method: 'GET' },
            accessToken,
        );
    };

    public deleteFileAsync = async (fileId: string, chatId: string, accessToken: string): Promise<object> => {
        return await this.getResponseAsync<object>(
            { commandPath: `files/${fileId}`, method: 'DELETE', query: new URLSearchParams({ chatId }) },
            accessToken,
        );
    };

    /**
     * Generate a short-lived download token for a file.
     * Used on mobile/Teams where blob downloads don't work.
     */
    public getDownloadTokenAsync = async (fileId: string, accessToken: string): Promise<string> => {
        const result = await this.getResponseAsync<{ token: string }>(
            { commandPath: `files/${fileId}/download-token`, method: 'POST' },
            accessToken,
        );
        return result.token;
    };
}
