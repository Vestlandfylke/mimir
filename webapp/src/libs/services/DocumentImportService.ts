// Copyright (c) Microsoft. All rights reserved.

import { IChatMessage } from '../models/ChatMessage';
import { ServiceInfo } from '../models/ServiceInfo';
import { BaseService } from './BaseService';

export interface DocumentInfo {
    id: string;
    name: string;
    size: number;
    createdOn: string;
    type: string;
}

export class DocumentImportService extends BaseService {
    public importDocumentAsync = async (
        chatId: string,
        documents: File[],
        useContentSafety: boolean,
        accessToken: string,
        uploadToGlobal: boolean,
    ) => {
        const formData = new FormData();
        formData.append('useContentSafety', useContentSafety.toString());
        for (const document of documents) {
            formData.append('formFiles', document);
        }

        return await this.getResponseAsync<IChatMessage>(
            {
                commandPath: uploadToGlobal ? `documents` : `chats/${chatId}/documents`,
                method: 'POST',
                body: formData,
            },
            accessToken,
        );
    };

    public getDocumentsAsync = async (chatId: string, accessToken: string): Promise<DocumentInfo[]> => {
        return await this.getResponseAsync<DocumentInfo[]>(
            {
                commandPath: `chats/${chatId}/documents`,
                method: 'GET',
            },
            accessToken,
        );
    };

    public deleteDocumentAsync = async (
        chatId: string,
        documentId: string,
        accessToken: string,
    ): Promise<{ message: string; documentId: string }> => {
        return await this.getResponseAsync<{ message: string; documentId: string }>(
            {
                commandPath: `chats/${chatId}/documents/${documentId}`,
                method: 'DELETE',
            },
            accessToken,
        );
    };

    public getContentSafetyStatusAsync = async (accessToken: string): Promise<boolean> => {
        const serviceInfo = await this.getResponseAsync<ServiceInfo>(
            {
                commandPath: 'info',
                method: 'GET',
            },
            accessToken,
        );

        return serviceInfo.isContentSafetyEnabled;
    };

    public pinDocumentAsync = async (
        chatId: string,
        documentId: string,
        accessToken: string,
    ): Promise<{ message: string; isPinned: boolean }> => {
        return await this.getResponseAsync<{ message: string; isPinned: boolean }>(
            {
                commandPath: `chats/${chatId}/documents/${documentId}/pin`,
                method: 'POST',
            },
            accessToken,
        );
    };

    public unpinDocumentAsync = async (
        chatId: string,
        documentId: string,
        accessToken: string,
    ): Promise<{ message: string; isPinned: boolean }> => {
        return await this.getResponseAsync<{ message: string; isPinned: boolean }>(
            {
                commandPath: `chats/${chatId}/documents/${documentId}/unpin`,
                method: 'POST',
            },
            accessToken,
        );
    };
}
