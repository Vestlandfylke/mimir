import { Body1, tokens } from '@fluentui/react-components';
import { IChatMessage } from '../../libs/models/ChatMessage';

/*
 * Function to check if date is today.
 */
export function isToday(date: Date) {
    return date.toDateString() === new Date().toDateString();
}

/*
 * Function to render the date and/or time of a message.
 * Uses Norwegian locale (nb-NO) with 24-hour format.
 */
export function timestampToDateString(timestamp: number, alwaysShowTime = false) {
    const date = new Date(timestamp);
    // Norwegian date format: day.month
    const dateString = date.toLocaleDateString('nb-NO', {
        day: 'numeric',
        month: 'numeric',
    });
    // 24-hour time format without AM/PM
    const timeString = date.toLocaleTimeString('nb-NO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    return date.toDateString() !== new Date().toDateString()
        ? alwaysShowTime
            ? dateString + ' ' + timeString // if the date is not today and we are always showing the time, show the date and time
            : dateString // if the date is not today and we are not always showing the time, only show the date
        : timeString; // if the date is today, only show the time
}

/*
 * Function to create a command link
 */
export function createCommandLink(command: string) {
    const escapedCommand = encodeURIComponent(command);
    const createCommandLink = `<span style="text-decoration: underline; cursor: pointer" data-command="${escapedCommand}" onclick="(function(){ let chatInput = document.getElementById('chat-input'); chatInput.value = decodeURIComponent('${escapedCommand}'); chatInput.focus(); return false; })();return false;">${command}</span>`;
    return createCommandLink;
}

/*
 * Function to format chat text content to remove any html tags from it.
 */
export function formatChatTextContent(messageContent: string) {
    const contentAsString = messageContent
        .trim()
        .replace(/^sk:\/\/.*$/gm, (match: string) => createCommandLink(match))
        .replace(/^!sk:.*$/gm, (match: string) => createCommandLink(match));
    return contentAsString;
}

/*
 * Formats text containing `\n` or `\r` into paragraphs.
 */
export function formatParagraphTextContent(messageContent = '') {
    messageContent = messageContent.replaceAll('\r\n', '\n\r');

    return (
        <Body1>
            {messageContent.split('\n').map((paragraph, idx) => (
                <p
                    key={`paragraph-${idx}`}
                    style={
                        paragraph.includes('\r')
                            ? {
                                  display: 'flex',
                                  marginLeft: tokens.spacingHorizontalL,
                              }
                            : {
                                  overflowWrap: 'anywhere',
                              }
                    }
                >
                    {paragraph}
                </p>
            ))}
        </Body1>
    );
}

/*
 * Convert a number to Unicode superscript characters (e.g., 1 → ¹, 12 → ¹²).
 */
const superscriptDigits = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
function toSuperscript(num: number): string {
    return num
        .toString()
        .split('')
        .map((d) => superscriptDigits[parseInt(d)])
        .join('');
}

/*
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/*
 * Function to replace citation links with indices matching the citation list.
 *
 * The LLM is instructed to include document links in square brackets in its response,
 * which it often formats as markdown links: [Document Name](citation-link).
 * Previously, only the URL was replaced with a number, turning [text](url) into [text](1),
 * which ReactMarkdown rendered as a clickable link to the relative path /1 on the domain.
 *
 * Fix: Replace the ENTIRE markdown link construct with the document name as plain text
 * plus a superscript citation number (e.g., "Document Name ¹"). This prevents broken
 * links while preserving the document reference and matching it to the citation cards below.
 */
export function replaceCitationLinksWithIndices(formattedMessageContent: string, message: IChatMessage) {
    const citations = message.citations;
    if (citations) {
        citations.forEach((citation, index) => {
            const citationLink = citation.link;
            const citationRef = toSuperscript(index + 1);
            const escapedLink = escapeRegex(citationLink);

            // 1. Replace full markdown links: [text](citationLink) → text ¹
            //    This catches the most common pattern where the LLM wraps the doc name in a link.
            const markdownLinkPattern = new RegExp(`\\[([^\\]]*?)\\]\\(\\s*${escapedLink}\\s*\\)`, 'g');
            formattedMessageContent = formattedMessageContent.replace(markdownLinkPattern, `$1 ${citationRef}`);

            // 2. Replace bare citation links in square brackets: [citationLink] → [¹]
            //    This catches the pattern where the LLM just quotes the link as instructed.
            const bareLinkPattern = new RegExp(`\\[\\s*${escapedLink}\\s*\\]`, 'g');
            formattedMessageContent = formattedMessageContent.replace(bareLinkPattern, citationRef);

            // 3. Replace any remaining bare citation links (without brackets)
            formattedMessageContent = formattedMessageContent.replaceAll(citationLink, citationRef);
        });
    }

    return formattedMessageContent;
}

/**
 * Gets message of error
 */
export function getErrorDetails(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
