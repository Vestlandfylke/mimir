// Copyright (c) Microsoft. All rights reserved.

import { makeStyles } from '@fluentui/react-components';
import React, { memo } from 'react';
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
import { MermaidBlock } from './MermaidBlock';
import { CodeBlock } from './CodeBlock';

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
    codeInline: {
        padding: '0 6px',
        borderRadius: '6px',
        backgroundColor: '#F3F4F6', // gray-100
        overflowWrap: 'anywhere',
    },
});

interface ChatHistoryTextContentProps {
    message: IChatMessage;
}

// Helper functions that don't depend on component state - defined outside to avoid recreation
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

// Stable plugin arrays - defined outside component to prevent recreation
const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

// Custom comparison function for memo - only re-render if message content or citations change
const arePropsEqual = (
    prevProps: ChatHistoryTextContentProps,
    nextProps: ChatHistoryTextContentProps,
): boolean => {
    // Only re-render if the actual content changed
    return (
        prevProps.message.content === nextProps.message.content &&
        prevProps.message.citations === nextProps.message.citations
    );
};

export const ChatHistoryTextContent: React.FC<ChatHistoryTextContentProps> = memo(({ message }) => {
    const classes = useClasses();
    const dispatch = useAppDispatch();
    const { instance, inProgress } = useMsal();
    const content = utils.replaceCitationLinksWithIndices(utils.formatChatTextContent(message.content), message);

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
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={{
                    // We fully render block code in the `code` renderer (CodeBlock / MermaidBlock),
                    // so `pre` should not introduce any extra wrapper.
                    pre: ({ children }) => <>{children}</>,
                    code: ({ className, children, ...props }) => {
                        const raw = String(children ?? '');
                        const text = raw.replace(/\n$/, '');
                        const match = /language-(\w+)/.exec(className ?? '');
                        const lang = match?.[1]?.toLowerCase();

                        // Render Mermaid fenced blocks: ```mermaid ... ```
                        if (lang === 'mermaid') {
                            return <MermaidBlock code={text} />;
                        }

                        // Inline vs block:
                        // - fenced/indented blocks often contain newlines
                        // - language-xxx className indicates fenced block with language
                        const isBlock = raw.includes('\n') || Boolean(className);
                        if (!isBlock) {
                            return (
                                <code {...props} className={classes.codeInline}>
                                    {children}
                                </code>
                            );
                        }

                        return <CodeBlock code={text} language={lang} />;
                    },
                    a: ({ href, children, ...props }) => {
                        const safeHref = href ?? '';
                        if (safeHref && isFilesEndpointLink(safeHref)) {
                            return (
                                <a {...props} href={safeHref} onClick={(e) => void handleFilesLinkClick(e, safeHref)}>
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
}, arePropsEqual);

ChatHistoryTextContent.displayName = 'ChatHistoryTextContent';
