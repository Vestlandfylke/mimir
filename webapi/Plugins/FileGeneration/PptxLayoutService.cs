// Copyright (c) Microsoft. All rights reserved.

using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using D = DocumentFormat.OpenXml.Drawing;
using P = DocumentFormat.OpenXml.Presentation;

namespace CopilotChat.WebApi.Plugins.FileGeneration;

/// <summary>
/// Service for dynamically creating PowerPoint slides from the slide layouts
/// defined in the Vestland Presentasjon.pptx template.
/// </summary>
internal static class PptxLayoutService
{
    /// <summary>
    /// Maps user-friendly slide type names to their layout names in the Vestland template.
    /// </summary>
    private static readonly Dictionary<string, string> LayoutNameMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["forside"] = "Forside",
        ["innhald"] = "Tittel og innhald",
        ["innhald_m_undertittel"] = "Tittel, undertittel og innhald",
        ["kapittel"] = "Kapittelside_1",
        ["avslutting"] = "Avsluttingsside - takk for meg"
    };

    /// <summary>
    /// Maps slide types to the placeholder indices for title, subtitle, and content shapes.
    /// </summary>
    private static readonly Dictionary<string, PlaceholderMapping> PlaceholderMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["forside"] = new(TitleIdx: 13, SubtitleIdx: 16, ContentIdx: null, DateIdx: 15),
        ["innhald"] = new(TitleIdx: 13, SubtitleIdx: null, ContentIdx: 16, DateIdx: null),
        ["innhald_m_undertittel"] = new(TitleIdx: 13, SubtitleIdx: 1, ContentIdx: 16, DateIdx: null),
        ["kapittel"] = new(TitleIdx: 13, SubtitleIdx: null, ContentIdx: null, DateIdx: null),
        ["avslutting"] = new(TitleIdx: null, SubtitleIdx: 1, ContentIdx: null, DateIdx: null)
    };

    private record PlaceholderMapping(uint? TitleIdx, uint? SubtitleIdx, uint? ContentIdx, uint? DateIdx);

    /// <summary>
    /// Removes all existing slides from the presentation (the example slides in the template).
    /// </summary>
    public static void RemoveAllSlides(PresentationPart presentationPart)
    {
        var slideIdList = presentationPart.Presentation?.SlideIdList;
        if (slideIdList == null)
        {
            return;
        }

        var slideIds = slideIdList.Elements<P.SlideId>().ToList();
        foreach (var slideId in slideIds)
        {
            var relationshipId = slideId.RelationshipId?.Value;
            if (relationshipId != null)
            {
                var slidePart = (SlidePart)presentationPart.GetPartById(relationshipId);
                presentationPart.DeletePart(slidePart);
            }
            slideId.Remove();
        }
    }

    /// <summary>
    /// Finds a slide layout by matching its name attribute against the layout name map.
    /// Searches across all slide masters in the presentation.
    /// </summary>
    public static SlideLayoutPart? FindLayout(PresentationPart presentationPart, string slideType)
    {
        if (!LayoutNameMap.TryGetValue(slideType, out var layoutName))
        {
            layoutName = "Tittel og innhald"; // Default fallback
        }

        foreach (var masterPart in presentationPart.SlideMasterParts)
        {
            foreach (var layoutPart in masterPart.SlideLayoutParts)
            {
                var layout = layoutPart.SlideLayout;
                var cSld = layout?.CommonSlideData;
                if (cSld?.Name != null &&
                    cSld.Name.Value != null &&
                    cSld.Name.Value.Equals(layoutName, StringComparison.OrdinalIgnoreCase))
                {
                    return layoutPart;
                }
            }
        }

        // Fallback: search for partial match
        foreach (var masterPart in presentationPart.SlideMasterParts)
        {
            foreach (var layoutPart in masterPart.SlideLayoutParts)
            {
                var name = layoutPart.SlideLayout?.CommonSlideData?.Name?.Value;
                if (name != null && name.Contains(layoutName, StringComparison.OrdinalIgnoreCase))
                {
                    return layoutPart;
                }
            }
        }

        return null;
    }

    /// <summary>
    /// Creates a new slide from the specified layout and fills in the placeholder shapes
    /// with the provided title, subtitle, and content.
    /// </summary>
    public static SlidePart CreateSlideFromLayout(
        PresentationPart presentationPart,
        SlideLayoutPart layoutPart,
        string slideType,
        string? title,
        string? subtitle,
        string? content)
    {
        var slidePart = presentationPart.AddNewPart<SlidePart>();

        // Create a new slide with an empty shape tree, then clone shapes from the layout
        var slide = new P.Slide(
            new P.CommonSlideData(
                new P.ShapeTree(
                    new P.NonVisualGroupShapeProperties(
                        new P.NonVisualDrawingProperties { Id = 1U, Name = "" },
                        new P.NonVisualGroupShapeDrawingProperties(),
                        new P.ApplicationNonVisualDrawingProperties()),
                    new P.GroupShapeProperties(new D.TransformGroup()))));

        // Clone placeholder shapes from the layout into the slide
        var layoutShapes = layoutPart.SlideLayout?.CommonSlideData?.ShapeTree;
        if (layoutShapes != null)
        {
            foreach (var shape in layoutShapes.Elements<P.Shape>())
            {
                var clonedShape = (P.Shape)shape.CloneNode(true);
                slide.CommonSlideData!.ShapeTree!.AppendChild(clonedShape);
            }
        }

        slidePart.Slide = slide;

        // Link the slide to the layout
        slidePart.AddPart(layoutPart);

        // Fill placeholder shapes with content
        if (PlaceholderMap.TryGetValue(slideType, out var mapping))
        {
            if (mapping.TitleIdx.HasValue && !string.IsNullOrWhiteSpace(title))
            {
                SetPlaceholderText(slidePart, mapping.TitleIdx.Value, title);
            }

            if (mapping.SubtitleIdx.HasValue && !string.IsNullOrWhiteSpace(subtitle))
            {
                SetPlaceholderText(slidePart, mapping.SubtitleIdx.Value, subtitle);
            }

            if (mapping.ContentIdx.HasValue && !string.IsNullOrWhiteSpace(content))
            {
                SetPlaceholderContent(slidePart, mapping.ContentIdx.Value, content);
            }

            if (mapping.DateIdx.HasValue)
            {
                // For front page, set date if subtitle is not filling it
                // Date is auto-set to today if not explicitly provided
            }
        }

        // Add slide to the slide ID list
        var presentation = presentationPart.Presentation!;
        var slideIdList = presentation.SlideIdList ??
                          presentation.AppendChild(new P.SlideIdList());

        uint maxSlideId = slideIdList.Elements<P.SlideId>().Any()
            ? slideIdList.Elements<P.SlideId>().Max(s => s.Id?.Value ?? 255)
            : 255;

        slideIdList.AppendChild(new P.SlideId
        {
            Id = maxSlideId + 1,
            RelationshipId = presentationPart.GetIdOfPart(slidePart)
        });

        return slidePart;
    }

    /// <summary>
    /// Sets plain text in a placeholder shape identified by its index.
    /// </summary>
    private static void SetPlaceholderText(SlidePart slidePart, uint placeholderIndex, string text)
    {
        var shape = FindPlaceholderShape(slidePart, placeholderIndex);
        if (shape == null)
        {
            return;
        }

        var textBody = shape.TextBody;
        if (textBody == null)
        {
            return;
        }

        // Remove existing paragraphs except the first (to preserve formatting)
        var existingParagraphs = textBody.Elements<D.Paragraph>().ToList();

        if (existingParagraphs.Count > 0)
        {
            // Use the first paragraph as a style template
            var templateParagraph = existingParagraphs[0];
            var templateRunProps = templateParagraph.Elements<D.Run>().FirstOrDefault()?.RunProperties;

            // Clear all existing paragraphs
            foreach (var p in existingParagraphs)
            {
                p.Remove();
            }

            // Create new paragraph with the text, preserving template formatting
            var newParagraph = new D.Paragraph();
            var pPr = templateParagraph.ParagraphProperties;
            if (pPr != null)
            {
                newParagraph.Append((D.ParagraphProperties)pPr.CloneNode(true));
            }

            var run = new D.Run();
            if (templateRunProps != null)
            {
                run.Append((D.RunProperties)templateRunProps.CloneNode(true));
            }
            run.Append(new D.Text(text));
            newParagraph.Append(run);

            textBody.Append(newParagraph);
        }
        else
        {
            // No existing paragraphs, just add a new one
            textBody.Append(new D.Paragraph(
                new D.Run(
                    new D.RunProperties { Language = "nn-NO" },
                    new D.Text(text))));
        }
    }

    /// <summary>
    /// Sets multi-line content in a placeholder, splitting by newlines.
    /// Supports bullet points (lines starting with "- ").
    /// </summary>
    private static void SetPlaceholderContent(SlidePart slidePart, uint placeholderIndex, string content)
    {
        var shape = FindPlaceholderShape(slidePart, placeholderIndex);
        if (shape == null)
        {
            return;
        }

        var textBody = shape.TextBody;
        if (textBody == null)
        {
            return;
        }

        // Get template formatting from first existing paragraph/run
        var templateParagraphs = textBody.Elements<D.Paragraph>().ToList();
        D.ParagraphProperties? templateParagraphProps = null;
        D.RunProperties? templateRunProps = null;

        if (templateParagraphs.Count > 0)
        {
            templateParagraphProps = templateParagraphs[0].ParagraphProperties;
            templateRunProps = templateParagraphs[0].Elements<D.Run>().FirstOrDefault()?.RunProperties;
        }

        // Clear existing content
        foreach (var p in templateParagraphs)
        {
            p.Remove();
        }

        // Parse content: split by newlines, detect bullets
        var lines = content.Replace("\r\n", "\n", StringComparison.Ordinal).Replace("\r", "\n", StringComparison.Ordinal).Split('\n');

        foreach (var line in lines)
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                textBody.Append(new D.Paragraph(new D.EndParagraphRunProperties { Language = "nn-NO" }));
                continue;
            }

            var newParagraph = new D.Paragraph();

            // Detect bullet points
            var trimmedLine = line.TrimStart();
            var isBullet = trimmedLine.StartsWith("- ", StringComparison.Ordinal) || trimmedLine.StartsWith("* ", StringComparison.Ordinal);
            var lineText = isBullet ? trimmedLine[2..] : line;

            if (templateParagraphProps != null)
            {
                var clonedProps = (D.ParagraphProperties)templateParagraphProps.CloneNode(true);

                if (isBullet)
                {
                    // Add bullet formatting
                    clonedProps.RemoveAllChildren<D.NoBullet>();
                    if (!clonedProps.Elements<D.CharacterBullet>().Any() &&
                        !clonedProps.Elements<D.AutoNumberedBullet>().Any())
                    {
                        clonedProps.Append(new D.CharacterBullet { Char = "\u2022" }); // bullet char
                    }
                }

                newParagraph.Append(clonedProps);
            }
            else if (isBullet)
            {
                newParagraph.Append(new D.ParagraphProperties(
                    new D.CharacterBullet { Char = "\u2022" }));
            }

            var run = new D.Run();
            if (templateRunProps != null)
            {
                run.Append((D.RunProperties)templateRunProps.CloneNode(true));
            }
            else
            {
                run.Append(new D.RunProperties { Language = "nn-NO" });
            }
            run.Append(new D.Text(lineText));
            newParagraph.Append(run);

            textBody.Append(newParagraph);
        }
    }

    /// <summary>
    /// Finds a placeholder shape by its placeholder index within the slide.
    /// </summary>
    private static P.Shape? FindPlaceholderShape(SlidePart slidePart, uint placeholderIndex)
    {
        var shapes = slidePart.Slide?.CommonSlideData?.ShapeTree?.Elements<P.Shape>();
        if (shapes == null)
        {
            return null;
        }

        foreach (var shape in shapes)
        {
            var nvSpPr = shape.NonVisualShapeProperties;
            var appNvPr = nvSpPr?.ApplicationNonVisualDrawingProperties;
            var ph = appNvPr?.GetFirstChild<P.PlaceholderShape>();

            if (ph != null)
            {
                var idx = ph.Index?.Value;
                if (idx == placeholderIndex)
                {
                    return shape;
                }
            }
        }

        return null;
    }

    /// <summary>
    /// Returns the list of supported slide type names.
    /// </summary>
    public static IReadOnlyCollection<string> SupportedSlideTypes => LayoutNameMap.Keys;
}
