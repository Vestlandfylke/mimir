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
 * Function to replace citation links with indices matching the citation list.
 */
export function replaceCitationLinksWithIndices(formattedMessageContent: string, message: IChatMessage) {
    const citations = message.citations;
    if (citations) {
        citations.forEach((citation, index) => {
            const citationLink = citation.link;
            formattedMessageContent = formattedMessageContent.replaceAll(citationLink, (index + 1).toString());
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
