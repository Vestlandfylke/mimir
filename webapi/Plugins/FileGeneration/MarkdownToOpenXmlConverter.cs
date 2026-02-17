// Copyright (c) Microsoft. All rights reserved.

using Markdig;
using Markdig.Syntax;
using Markdig.Syntax.Inlines;
using DocumentFormat.OpenXml;
using W = DocumentFormat.OpenXml.Wordprocessing;

namespace CopilotChat.WebApi.Plugins.FileGeneration;

/// <summary>
/// Converts Markdown text to OpenXML paragraphs that reference styles
/// defined in the Vestland Word template (Overskrift1-4, Punktliste, Normal).
/// </summary>
internal static class MarkdownToOpenXmlConverter
{
    // Style IDs from the Vestland word_template.docx
    private const string StyleHeading1 = "Overskrift1";
    private const string StyleHeading2 = "Overskrift2";
    private const string StyleHeading3 = "Overskrift3";
    private const string StyleHeading4 = "Overskrift4";
    private const string StyleBulletList = "Punktliste";
    private const string StyleNormal = "Normal";

    private static readonly MarkdownPipeline Pipeline = new MarkdownPipelineBuilder()
        .UseAdvancedExtensions()
        .Build();

    /// <summary>
    /// Parses a Markdown string and returns a list of OpenXML paragraphs
    /// with style references matching the Vestland template.
    /// </summary>
    public static List<W.Paragraph> Convert(string markdown)
    {
        var paragraphs = new List<W.Paragraph>();

        if (string.IsNullOrWhiteSpace(markdown))
        {
            return paragraphs;
        }

        var document = Markdown.Parse(markdown, Pipeline);

        foreach (var block in document)
        {
            ConvertBlock(block, paragraphs);
        }

        return paragraphs;
    }

    private static void ConvertBlock(Block block, List<W.Paragraph> paragraphs)
    {
        switch (block)
        {
            case HeadingBlock heading:
                paragraphs.Add(CreateHeadingParagraph(heading));
                break;

            case ParagraphBlock paragraphBlock:
                paragraphs.Add(CreateNormalParagraph(paragraphBlock));
                break;

            case ListBlock listBlock:
                ConvertList(listBlock, paragraphs);
                break;

            case ThematicBreakBlock:
                paragraphs.Add(CreateThematicBreak());
                break;

            case FencedCodeBlock codeBlock:
                paragraphs.Add(CreateCodeParagraph(codeBlock));
                break;

            case QuoteBlock quoteBlock:
                foreach (var child in quoteBlock)
                {
                    ConvertBlock(child, paragraphs);
                }
                break;

            default:
                // For unsupported block types, try to extract text
                if (block is LeafBlock leaf && leaf.Inline != null)
                {
                    paragraphs.Add(CreateParagraphFromInlines(leaf.Inline, StyleNormal));
                }
                break;
        }
    }

    private static W.Paragraph CreateHeadingParagraph(HeadingBlock heading)
    {
        var styleId = heading.Level switch
        {
            1 => StyleHeading1,
            2 => StyleHeading2,
            3 => StyleHeading3,
            4 => StyleHeading4,
            _ => StyleHeading4 // Level 5+ falls back to Heading 4
        };

        if (heading.Inline != null)
        {
            return CreateParagraphFromInlines(heading.Inline, styleId);
        }

        return CreateStyledParagraph(styleId, string.Empty);
    }

    private static W.Paragraph CreateNormalParagraph(ParagraphBlock paragraphBlock)
    {
        if (paragraphBlock.Inline != null)
        {
            return CreateParagraphFromInlines(paragraphBlock.Inline, StyleNormal);
        }

        return CreateStyledParagraph(StyleNormal, string.Empty);
    }

    private static void ConvertList(ListBlock listBlock, List<W.Paragraph> paragraphs)
    {
        foreach (var item in listBlock)
        {
            if (item is ListItemBlock listItem)
            {
                foreach (var child in listItem)
                {
                    if (child is ParagraphBlock pb && pb.Inline != null)
                    {
                        paragraphs.Add(CreateParagraphFromInlines(pb.Inline, StyleBulletList));
                    }
                    else if (child is ListBlock nestedList)
                    {
                        ConvertList(nestedList, paragraphs);
                    }
                    else
                    {
                        ConvertBlock(child, paragraphs);
                    }
                }
            }
        }
    }

    private static W.Paragraph CreateThematicBreak()
    {
        var p = new W.Paragraph();
        var pPr = new W.ParagraphProperties(
            new W.ParagraphBorders(
                new W.BottomBorder
                {
                    Val = W.BorderValues.Single,
                    Size = 6,
                    Space = 1,
                    Color = "999999"
                }));
        p.Append(pPr);
        return p;
    }

    private static W.Paragraph CreateCodeParagraph(FencedCodeBlock codeBlock)
    {
        var p = new W.Paragraph();
        var pPr = new W.ParagraphProperties(
            new W.ParagraphStyleId { Val = StyleNormal },
            new W.Shading
            {
                Val = W.ShadingPatternValues.Clear,
                Fill = "F2F2F2"
            });
        p.Append(pPr);

        var lines = codeBlock.Lines;
        for (int i = 0; i < lines.Count; i++)
        {
            var lineText = lines.Lines[i].Slice.ToString();
            var run = new W.Run();
            var rPr = new W.RunProperties(
                new W.RunFonts { Ascii = "Consolas", HighAnsi = "Consolas" },
                new W.FontSize { Val = "18" }); // 9pt
            run.Append(rPr);
            run.Append(new W.Text(lineText) { Space = SpaceProcessingModeValues.Preserve });
            p.Append(run);

            if (i < lines.Count - 1)
            {
                p.Append(new W.Run(new W.Break()));
            }
        }

        return p;
    }

    /// <summary>
    /// Creates a paragraph from Markdig inline elements, preserving bold, italic, and code formatting.
    /// </summary>
    private static W.Paragraph CreateParagraphFromInlines(ContainerInline container, string styleId)
    {
        var p = new W.Paragraph();
        var pPr = new W.ParagraphProperties(new W.ParagraphStyleId { Val = styleId });
        p.Append(pPr);

        ProcessInlines(container, p, bold: false, italic: false, code: false);

        return p;
    }

    private static void ProcessInlines(ContainerInline container, W.Paragraph paragraph, bool bold, bool italic, bool code)
    {
        foreach (var inline in container)
        {
            switch (inline)
            {
                case LiteralInline literal:
                    AddTextRun(paragraph, literal.Content.ToString(), bold, italic, code);
                    break;

                case EmphasisInline emphasis:
                    bool isBold = emphasis.DelimiterCount >= 2;
                    bool isItalic = emphasis.DelimiterCount == 1 || emphasis.DelimiterCount == 3;
                    ProcessInlines(emphasis, paragraph, bold || isBold, italic || isItalic, code);
                    break;

                case CodeInline codeInline:
                    AddTextRun(paragraph, codeInline.Content, bold, italic, code: true);
                    break;

                case LinkInline link:
                    // Render link text (without hyperlink for simplicity in docx)
                    if (link.FirstChild != null)
                    {
                        ProcessInlines(link, paragraph, bold, italic, code);
                    }
                    break;

                case LineBreakInline:
                    paragraph.Append(new W.Run(new W.Break()));
                    break;

                case ContainerInline nestedContainer:
                    ProcessInlines(nestedContainer, paragraph, bold, italic, code);
                    break;

                default:
                    // Try to get text content from other inline types
                    var text = inline.ToString();
                    if (!string.IsNullOrEmpty(text))
                    {
                        AddTextRun(paragraph, text, bold, italic, code);
                    }
                    break;
            }
        }
    }

    private static void AddTextRun(W.Paragraph paragraph, string text, bool bold, bool italic, bool code)
    {
        var run = new W.Run();
        var rPr = new W.RunProperties();
        bool hasProperties = false;

        if (bold)
        {
            rPr.Append(new W.Bold());
            hasProperties = true;
        }

        if (italic)
        {
            rPr.Append(new W.Italic());
            hasProperties = true;
        }

        if (code)
        {
            rPr.Append(new W.RunFonts { Ascii = "Consolas", HighAnsi = "Consolas" });
            rPr.Append(new W.Shading
            {
                Val = W.ShadingPatternValues.Clear,
                Fill = "F2F2F2"
            });
            hasProperties = true;
        }

        if (hasProperties)
        {
            run.Append(rPr);
        }

        run.Append(new W.Text(text) { Space = SpaceProcessingModeValues.Preserve });
        paragraph.Append(run);
    }

    private static W.Paragraph CreateStyledParagraph(string styleId, string text)
    {
        var p = new W.Paragraph();
        var pPr = new W.ParagraphProperties(new W.ParagraphStyleId { Val = styleId });
        p.Append(pPr);

        if (!string.IsNullOrEmpty(text))
        {
            var run = new W.Run();
            run.Append(new W.Text(text) { Space = SpaceProcessingModeValues.Preserve });
            p.Append(run);
        }

        return p;
    }
}
