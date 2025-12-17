// Copyright (c) Microsoft. All rights reserved.

import { makeStyles } from '@fluentui/react-components';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { useMsal } from '@azure/msal-react';
import { IChatMessage } from '../../../libs/models/ChatMessage';
import * as utils from './../../utils/TextUtils';
import { AuthHelper } from '../../../libs/auth/AuthHelper';
import { useAppDispatch } from '../../../redux/app/hooks';
import { addAlert } from '../../../redux/features/app/appSlice';
import { AlertType } from '../../../libs/models/AlertType';

// Import KaTeX CSS
import 'katex/dist/katex.min.css';

const useClasses = makeStyles({
    content: {
        wordBreak: 'break-word',
        // KaTeX: prevent horizontal overflow on small screens by allowing horizontal scrolling
        // for display equations (block math). Inline math will still wrap with surrounding text.
        '& .katex-display': {
            maxWidth: '100%',
            overflowX: 'auto',
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch',
        },
        '& .katex': {
            maxWidth: '100%',
        },
        '& .katex-display > .katex': {
            // Ensure the rendered equation can scroll instead of forcing the parent wider.
            display: 'inline-block',
            maxWidth: '100%',
        },
    },
});

interface ChatHistoryTextContentProps {
    message: IChatMessage;
}

export const ChatHistoryTextContent: React.FC<ChatHistoryTextContentProps> = ({ message }) => {
    const classes = useClasses();
    const dispatch = useAppDispatch();
    const { instance, inProgress } = useMsal();
    const content = utils.replaceCitationLinksWithIndices(utils.formatChatTextContent(message.content), message);

    const downloadBlob = (blob: Blob, filename: string) => {
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const tryGetFilenameFromContentDisposition = (value: string | null): string | null => {
        if (!value) return null;

        // Examples:
        // - attachment; filename="report.docx"
        // - attachment; filename=report.docx
        // - attachment; filename*=UTF-8''rapport%20v1.docx
        const filenameStarMatch = value.match(/filename\*\s*=\s*([^;]+)/i);
        if (filenameStarMatch?.[1]) {
            const raw = filenameStarMatch[1].trim();
            const parts = raw.split("''", 2);
            const encoded = parts.length === 2 ? parts[1] : raw;
            try {
                return decodeURIComponent(encoded.replace(/^"+|"+$/g, ''));
            } catch {
                return encoded.replace(/^"+|"+$/g, '');
            }
        }

        const filenameMatch = value.match(/filename\s*=\s*([^;]+)/i);
        if (filenameMatch?.[1]) {
            return filenameMatch[1].trim().replace(/^"+|"+$/g, '');
        }

        return null;
    };

    const isFilesEndpointLink = (href: string): boolean => {
        try {
            const url = new URL(href, window.location.origin);
            return url.pathname.startsWith('/files/');
        } catch {
            return href.startsWith('/files/');
        }
    };

    const handleFilesLinkClick = async (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        // If auth is disabled, a normal navigation is fine (PassThrough backend).
        if (!AuthHelper.isAuthAAD()) {
            return;
        }

        e.preventDefault();

        try {
            const accessToken = await AuthHelper.getSKaaSAccessToken(instance, inProgress);
            const url = new URL(href, window.location.origin);

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`${response.status}: ${response.statusText} ${errorText}`);
            }

            const contentDisposition = response.headers.get('content-disposition');
            const filename =
                tryGetFilenameFromContentDisposition(contentDisposition) ?? url.pathname.split('/').pop() ?? 'download';
            const blob = await response.blob();
            downloadBlob(blob, filename);
        } catch (err) {
            const error = err as Error;
            dispatch(
                addAlert({
                    message: `Feil ved nedlasting av fil: ${error.message || 'Ukjent feil'}`,
                    type: AlertType.Error,
                }),
            );
        }
    };

    return (
        <div className={classes.content}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    a: ({ href, children, ...props }) => {
                        const safeHref = href ?? '';
                        if (safeHref && isFilesEndpointLink(safeHref)) {
                            return (
                                <a
                                    {...props}
                                    href={safeHref}
                                    onClick={(e) => void handleFilesLinkClick(e, safeHref)}
                                >
                                    {children}
                                </a>
                            );
                        }

                        return (
                            <a {...props} href={safeHref} target="_blank" rel="noreferrer">
                                {children}
                            </a>
                        );
                    },
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};
