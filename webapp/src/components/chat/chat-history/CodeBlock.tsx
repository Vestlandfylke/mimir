import { Button, Tooltip, makeStyles, shorthands, tokens } from '@fluentui/react-components';
import { Clipboard20Regular, ClipboardTask20Regular } from '@fluentui/react-icons';
import React, { useMemo, useState } from 'react';
import { Highlight, type Language, themes } from 'prism-react-renderer';

const useClasses = makeStyles({
    root: {
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        overflowX: 'hidden',
        ...shorthands.padding(tokens.spacingVerticalS),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        backgroundColor: tokens.colorNeutralBackground2, // light grey
        ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    },
    pre: {
        margin: 0,
        maxWidth: '100%',
        minWidth: 0,
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: '"Roboto Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: tokens.fontSizeBase200,
        lineHeight: tokens.lineHeightBase300,
        color: tokens.colorNeutralForeground1,
    },
    scroll: {
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        // Make horizontal swipe-to-scroll reliable on mobile
        touchAction: 'pan-x',
        overscrollBehaviorX: 'contain',
    },
    table: {
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr)',
        alignItems: 'start',
        width: '100%',
        minWidth: 0,
    },
    lineNo: {
        userSelect: 'none',
        textAlign: 'right',
        paddingRight: tokens.spacingHorizontalS,
        paddingLeft: tokens.spacingHorizontalXS,
        color: tokens.colorNeutralForeground3,
        borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
        marginRight: tokens.spacingHorizontalS,
    },
    line: {
        // Make code content responsive: preserve whitespace but allow wrapping as the viewport changes
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        minWidth: 0,
    },
    copy: {
        position: 'absolute',
        top: tokens.spacingVerticalXS,
        right: tokens.spacingHorizontalXS,
        zIndex: 1,
    },
});

export interface CodeBlockProps {
    code: string;
    language?: string;
    isDark?: boolean;
}

const toPrismLanguage = (language?: string): Language => {
    const l = (language ?? '').toLowerCase();
    // Prism-react-renderer supports a subset of Prism languages by default.
    // We map common aliases and fall back to 'text'.
    switch (l) {
        case 'ts':
        case 'tsx':
        case 'typescript':
            return 'tsx';
        case 'js':
        case 'jsx':
        case 'javascript':
            return 'jsx';
        case 'json':
            return 'json';
        case 'css':
            return 'css';
        case 'html':
        case 'xml':
        case 'svg':
            return 'markup';
        case 'bash':
        case 'sh':
        case 'shell':
            return 'bash';
        case 'sql':
            return 'sql';
        case 'python':
        case 'py':
            return 'python';
        case 'yaml':
        case 'yml':
            return 'yaml';
        case 'markdown':
        case 'md':
            return 'markdown';
        default:
            return 'text';
    }
};

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, isDark = false }) => {
    const classes = useClasses();
    const [copied, setCopied] = useState(false);
    const trimmed = useMemo(() => code.replace(/\n$/, ''), [code]);
    const prismLang = useMemo(() => toPrismLanguage(language), [language]);
    const theme = isDark ? themes.vsDark : themes.github;

    const onCopy = async () => {
        await navigator.clipboard.writeText(trimmed);
        setCopied(true);
        window.setTimeout(() => {
            setCopied(false);
        }, 1500);
    };

    return (
        <div className={classes.root}>
            <div className={classes.copy}>
                <Tooltip content={copied ? 'Kopiert' : 'Kopier'} relationship="label">
                    <Button
                        size="small"
                        appearance="subtle"
                        icon={copied ? <ClipboardTask20Regular /> : <Clipboard20Regular />}
                        onClick={() => {
                            void onCopy();
                        }}
                        aria-label="Kopier kode"
                    />
                </Tooltip>
            </div>
            {/* Use a div instead of <pre> because <pre> only allows phrasing content (no nested divs). */}
            <div className={classes.pre}>
                <div className={classes.scroll}>
                    <Highlight theme={theme} code={trimmed} language={prismLang}>
                        {({ className, style, tokens, getLineProps, getTokenProps }) => (
                            <div className={className} style={style}>
                                <div className={classes.table}>
                                    {tokens.map((line, i) => {
                                        const { key: _lineKey, ...lineProps } = getLineProps({ line });
                                        return (
                                            <React.Fragment key={i}>
                                                <div className={classes.lineNo}>{i + 1}</div>
                                                <div {...lineProps} className={classes.line}>
                                                    {line.map((token, tokenIndex) => {
                                                        const { key: _tokenKey, ...tokenProps } = getTokenProps({
                                                            token,
                                                        });
                                                        return <span key={tokenIndex} {...tokenProps} />;
                                                    })}
                                                </div>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </Highlight>
                </div>
            </div>
        </div>
    );
};
