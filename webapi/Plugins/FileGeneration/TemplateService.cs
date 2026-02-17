// Copyright (c) Microsoft. All rights reserved.

using System.Text;
using System.Text.Json;
using System.Globalization;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using Microsoft.Extensions.Options;
using W = DocumentFormat.OpenXml.Wordprocessing;

namespace CopilotChat.WebApi.Plugins.FileGeneration;

/// <summary>
/// Options for the file generation template system.
/// </summary>
internal sealed class FileGenerationOptions
{
    public const string SectionName = "FileGeneration";

    /// <summary>
    /// Path to the directory containing document templates, relative to the application root.
    /// </summary>
    public string TemplatePath { get; set; } = "docs/doc-templates";

    /// <summary>
    /// Filename of the Word template within the template directory.
    /// </summary>
    public string WordTemplate { get; set; } = "word_template.docx";

    /// <summary>
    /// Filename of the PowerPoint template within the template directory.
    /// </summary>
    public string PowerPointTemplate { get; set; } = "Presentasjon.pptx";
}

/// <summary>
/// Represents a slide definition from the LLM for dynamic PowerPoint generation.
/// </summary>
internal sealed class SlideDefinition
{
    public string Type { get; set; } = "innhald";
    public string? Title { get; set; }
    public string? Subtitle { get; set; }
    public string? Content { get; set; }
}

/// <summary>
/// Service that generates Word and PowerPoint documents from Vestland fylkeskommune templates.
/// Word: Opens the template, replaces placeholder tags, and inserts Markdown-formatted content.
/// PowerPoint: Opens the template, removes example slides, and creates new slides from layouts.
/// </summary>
internal sealed class TemplateService
{
    private static readonly JsonSerializerOptions s_jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly string _wordTemplatePath;
    private readonly string _pptxTemplatePath;
    private readonly ILogger<TemplateService> _logger;

    public TemplateService(IOptions<FileGenerationOptions> options, ILogger<TemplateService> logger, IWebHostEnvironment env)
    {
        this._logger = logger;

        var templateDir = options.Value.TemplatePath;
        var wordFile = options.Value.WordTemplate;
        var pptxFile = options.Value.PowerPointTemplate;

        // Try multiple base paths: configured path from content root, then fallback to output directory
        string[] candidateBases =
        [
            Path.Combine(env.ContentRootPath, templateDir),
            Path.Combine(AppContext.BaseDirectory, templateDir),
            Path.Combine(AppContext.BaseDirectory, "templates")
        ];

        this._wordTemplatePath = ResolveTemplatePath(candidateBases, wordFile);
        this._pptxTemplatePath = ResolveTemplatePath(candidateBases, pptxFile);

        if (!File.Exists(this._wordTemplatePath))
        {
            this._logger.LogWarning("Word template not found. Searched in: {Paths}",
                string.Join(", ", candidateBases.Select(b => Path.Combine(b, wordFile))));
        }
        else
        {
            this._logger.LogInformation("Word template loaded from {Path}", this._wordTemplatePath);
        }

        if (!File.Exists(this._pptxTemplatePath))
        {
            this._logger.LogWarning("PowerPoint template not found. Searched in: {Paths}",
                string.Join(", ", candidateBases.Select(b => Path.Combine(b, pptxFile))));
        }
        else
        {
            this._logger.LogInformation("PowerPoint template loaded from {Path}", this._pptxTemplatePath);
        }
    }

    private static string ResolveTemplatePath(string[] basePaths, string fileName)
    {
        foreach (var basePath in basePaths)
        {
            var fullPath = Path.Combine(basePath, fileName);
            if (File.Exists(fullPath))
            {
                return fullPath;
            }
        }

        // Return the first candidate as default (will be caught by File.Exists checks later)
        return Path.Combine(basePaths[0], fileName);
    }

    /// <summary>
    /// Generates a Word document from the Vestland template by replacing placeholder tags
    /// and inserting Markdown-formatted content.
    /// </summary>
    /// <param name="title">Document title (replaces {{TITTEL}})</param>
    /// <param name="markdownContent">Markdown content (replaces {{INNHALD}} with formatted paragraphs)</param>
    /// <param name="author">Author name (replaces {{FORFATTAR}})</param>
    /// <param name="date">Date string (replaces {{DATO}})</param>
    /// <param name="docType">Document type (replaces {{TYPE_DOKUMENT}})</param>
    /// <returns>The generated .docx as a byte array</returns>
    public byte[] GenerateFromWordTemplate(
        string title,
        string markdownContent,
        string? author = null,
        string? date = null,
        string? docType = null)
    {
        if (!File.Exists(this._wordTemplatePath))
        {
            this._logger.LogWarning("Word template not found, falling back to plain generation");
            return FallbackBuildDocx(markdownContent);
        }

        // Copy template to memory so we don't modify the original
        var templateBytes = File.ReadAllBytes(this._wordTemplatePath);
        using var ms = new MemoryStream();
        ms.Write(templateBytes, 0, templateBytes.Length);
        ms.Position = 0;

        using (var wordDoc = WordprocessingDocument.Open(ms, true))
        {
            // Replace simple tags in the main document body
            ReplaceTagsInMainDocument(wordDoc, title, author, date, docType);

            // Replace tags in headers and footers
            ReplaceTagsInHeadersAndFooters(wordDoc, title, author, date, docType);

            // Strip duplicate title: if the Markdown starts with a heading that matches
            // the document title, remove it to avoid showing the title twice
            // (once from the {{TITTEL}} tag and once from the Markdown heading).
            var contentForBody = StripDuplicateTitleHeading(markdownContent, title);

            // Handle the {{INNHALD}} tag: replace it with parsed Markdown content
            ReplaceContentTag(wordDoc, contentForBody);

            wordDoc.Save();
        }

        return ms.ToArray();
    }

    /// <summary>
    /// Generates a PowerPoint presentation from the Vestland template by
    /// creating slides dynamically from the template's slide layouts.
    /// </summary>
    /// <param name="slides">List of slide definitions specifying type and content</param>
    /// <returns>The generated .pptx as a byte array</returns>
    public byte[] GenerateFromPptxTemplate(List<SlideDefinition> slides)
    {
        if (!File.Exists(this._pptxTemplatePath))
        {
            this._logger.LogWarning("PowerPoint template not found, falling back to plain generation");
            return FallbackBuildPptx(slides);
        }

        // Copy template to memory
        var templateBytes = File.ReadAllBytes(this._pptxTemplatePath);
        using var ms = new MemoryStream();
        ms.Write(templateBytes, 0, templateBytes.Length);
        ms.Position = 0;

        using (var pptDoc = PresentationDocument.Open(ms, true))
        {
            var presentationPart = pptDoc.PresentationPart;
            if (presentationPart == null)
            {
                throw new InvalidOperationException("PowerPoint template has no presentation part");
            }

            // Remove the example slides that come with the template
            PptxLayoutService.RemoveAllSlides(presentationPart);

            // Create new slides from layouts based on definitions
            foreach (var slideDef in slides)
            {
                var layoutPart = PptxLayoutService.FindLayout(presentationPart, slideDef.Type);
                if (layoutPart == null)
                {
                    this._logger.LogWarning("Could not find layout for slide type '{Type}', using default", slideDef.Type);
                    layoutPart = PptxLayoutService.FindLayout(presentationPart, "innhald");
                    if (layoutPart == null)
                    {
                        this._logger.LogError("Could not find any suitable layout in the template");
                        continue;
                    }
                }

                PptxLayoutService.CreateSlideFromLayout(
                    presentationPart,
                    layoutPart,
                    slideDef.Type,
                    slideDef.Title,
                    slideDef.Subtitle,
                    slideDef.Content);
            }

            pptDoc.Save();
        }

        return ms.ToArray();
    }

    /// <summary>
    /// Parses a JSON string of slide definitions from the LLM.
    /// Handles common LLM formatting issues:
    ///   - Trailing/leading junk characters (extra braces, markdown fences, explanatory text)
    ///   - Literal newlines inside JSON string values (invalid per JSON spec but common from LLMs)
    /// </summary>
    public static List<SlideDefinition> ParseSlideDefinitions(string slidesJson)
    {
        var trimmed = (slidesJson ?? string.Empty).Trim();

        // Extract the JSON array from the input: find the first '[' and its matching ']'.
        // This strips markdown fences, trailing braces, explanatory text, etc.
        var arrayJson = ExtractJsonArray(trimmed);

        if (!string.IsNullOrEmpty(arrayJson))
        {
            // First attempt: parse as-is (valid JSON)
            var parsed = TryDeserializeSlides(arrayJson);
            if (parsed != null)
            {
                return parsed;
            }

            // Second attempt: sanitize literal newlines inside JSON string values.
            // LLMs often produce "content":"- line1\n- line2" with actual newline chars.
            var sanitized = SanitizeJsonNewlines(arrayJson);
            parsed = TryDeserializeSlides(sanitized);
            if (parsed != null)
            {
                return parsed;
            }
        }

        // Fallback: treat as single content slide
        return new List<SlideDefinition>
        {
            new() { Type = "forside", Title = "Presentasjon" },
            new() { Type = "innhald", Title = "Innhald", Content = trimmed }
        };
    }

    /// <summary>
    /// Extracts a JSON array from a string by finding the first '[' and its
    /// matching ']', accounting for nested brackets and JSON string values.
    /// Returns null if no valid array structure is found.
    /// </summary>
    private static string? ExtractJsonArray(string input)
    {
        int start = input.IndexOf('[');
        if (start < 0)
        {
            return null;
        }

        int depth = 0;
        bool inString = false;
        bool escaped = false;

        for (int i = start; i < input.Length; i++)
        {
            char c = input[i];

            if (escaped)
            {
                escaped = false;
                continue;
            }

            if (c == '\\' && inString)
            {
                escaped = true;
                continue;
            }

            if (c == '"')
            {
                inString = !inString;
                continue;
            }

            if (!inString)
            {
                if (c == '[')
                {
                    depth++;
                }
                else if (c == ']')
                {
                    depth--;
                    if (depth == 0)
                    {
                        return input[start..(i + 1)];
                    }
                }
            }
        }

        // Unbalanced brackets -- return from '[' to end as best effort
        return input[start..];
    }

    private static List<SlideDefinition>? TryDeserializeSlides(string json)
    {
        try
        {
            var slides = JsonSerializer.Deserialize<List<SlideDefinition>>(json, s_jsonOptions);
            return slides != null && slides.Count > 0 ? slides : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>
    /// Escapes literal newline characters (\r, \n) that appear inside JSON string values.
    /// Characters outside of string values (between tokens) are left untouched.
    /// </summary>
    private static string SanitizeJsonNewlines(string json)
    {
        var sb = new StringBuilder(json.Length);
        bool inString = false;
        bool escaped = false;

        foreach (char c in json)
        {
            if (escaped)
            {
                sb.Append(c);
                escaped = false;
                continue;
            }

            if (c == '\\' && inString)
            {
                sb.Append(c);
                escaped = true;
                continue;
            }

            if (c == '"')
            {
                inString = !inString;
                sb.Append(c);
                continue;
            }

            if (inString)
            {
                if (c == '\n')
                {
                    sb.Append("\\n");
                    continue;
                }

                if (c == '\r')
                {
                    // Skip \r; the following \n will be converted to \\n
                    continue;
                }
            }

            sb.Append(c);
        }

        return sb.ToString();
    }

    /// <summary>
    /// If the first line of the Markdown content is a heading (# ...) that matches the
    /// document title, strip it so the title isn't shown twice in the final document.
    /// </summary>
    private static string StripDuplicateTitleHeading(string markdown, string title)
    {
        if (string.IsNullOrWhiteSpace(markdown) || string.IsNullOrWhiteSpace(title))
        {
            return markdown;
        }

        // Normalize line endings and get the first non-empty line
        var lines = markdown.Replace("\r\n", "\n", StringComparison.Ordinal)
                            .Replace("\r", "\n", StringComparison.Ordinal)
                            .Split('\n');

        // Find the first non-empty line
        int firstLineIdx = -1;
        for (int i = 0; i < lines.Length; i++)
        {
            if (!string.IsNullOrWhiteSpace(lines[i]))
            {
                firstLineIdx = i;
                break;
            }
        }

        if (firstLineIdx < 0)
        {
            return markdown;
        }

        var firstLine = lines[firstLineIdx].TrimStart();

        // Check if it's a Markdown heading (# ...)
        if (!firstLine.StartsWith('#'))
        {
            return markdown;
        }

        // Extract heading text (strip # prefix and whitespace)
        var headingText = firstLine.TrimStart('#').Trim();

        // Compare with title (case-insensitive)
        if (headingText.Equals(title.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            // Remove the heading line and any immediately following blank lines
            var remaining = lines.Skip(firstLineIdx + 1)
                                 .SkipWhile(l => string.IsNullOrWhiteSpace(l));
            return string.Join('\n', remaining);
        }

        return markdown;
    }

    #region Word tag replacement

    private static void ReplaceTagsInMainDocument(
        WordprocessingDocument wordDoc,
        string title, string? author, string? date, string? docType)
    {
        var body = wordDoc.MainDocumentPart?.Document?.Body;
        if (body == null)
        {
            return;
        }

        // Replace simple text tags (not {{INNHALD}} -- that's handled separately)
        ReplaceTagInElement(body, "{{TITTEL}}", title);
        ReplaceTagInElement(body, "{{FORFATTAR}}", author ?? string.Empty);
        ReplaceTagInElement(body, "{{DATO}}", date ?? DateTime.Now.ToString("dd.MM.yyyy", CultureInfo.InvariantCulture));
        ReplaceTagInElement(body, "{{TYPE_DOKUMENT}}", docType ?? string.Empty);
    }

    private static void ReplaceTagsInHeadersAndFooters(
        WordprocessingDocument wordDoc,
        string title, string? author, string? date, string? docType)
    {
        var mainPart = wordDoc.MainDocumentPart;
        if (mainPart == null)
        {
            return;
        }

        var dateStr = date ?? DateTime.Now.ToString("dd.MM.yyyy", CultureInfo.InvariantCulture);

        // Process all header parts
        foreach (var headerPart in mainPart.HeaderParts)
        {
            if (headerPart.Header is { } header)
            {
                ReplaceTagInElement(header, "{{TITTEL}}", title);
                ReplaceTagInElement(header, "{{FORFATTAR}}", author ?? string.Empty);
                ReplaceTagInElement(header, "{{DATO}}", dateStr);
                ReplaceTagInElement(header, "{{TYPE_DOKUMENT}}", docType ?? string.Empty);
            }
        }

        // Process all footer parts
        foreach (var footerPart in mainPart.FooterParts)
        {
            if (footerPart.Footer is { } footer)
            {
                ReplaceTagInElement(footer, "{{TITTEL}}", title);
                ReplaceTagInElement(footer, "{{FORFATTAR}}", author ?? string.Empty);
                ReplaceTagInElement(footer, "{{DATO}}", dateStr);
                ReplaceTagInElement(footer, "{{TYPE_DOKUMENT}}", docType ?? string.Empty);
            }
        }
    }

    /// <summary>
    /// Replaces a tag within an OpenXML element. Tags may be split across multiple runs
    /// in Word, so we need to handle that case by concatenating run text and rebuilding.
    /// </summary>
    private static void ReplaceTagInElement(OpenXmlElement element, string tag, string replacement)
    {
        // First, try simple replacement within individual Text elements
        foreach (var text in element.Descendants<W.Text>())
        {
            if (text.Text.Contains(tag, StringComparison.Ordinal))
            {
                text.Text = text.Text.Replace(tag, replacement, StringComparison.Ordinal);
            }
        }

        // Handle split tags: Word may split "{{TITTEL}}" across multiple runs
        // e.g., Run1="{{TIT", Run2="TEL}}" -- we need to merge and replace
        foreach (var paragraph in element.Descendants<W.Paragraph>())
        {
            var fullText = string.Concat(paragraph.Descendants<W.Text>().Select(t => t.Text));
            if (!fullText.Contains(tag, StringComparison.Ordinal))
            {
                continue;
            }

            // Rebuild the paragraph's runs with the replacement
            var runs = paragraph.Elements<W.Run>().ToList();
            var concatenated = new System.Text.StringBuilder();
            foreach (var run in runs)
            {
                foreach (var text in run.Elements<W.Text>())
                {
                    concatenated.Append(text.Text);
                }
            }

            var newText = concatenated.ToString().Replace(tag, replacement, StringComparison.Ordinal);

            // Clear all runs except the first, and set the first run's text
            if (runs.Count > 0)
            {
                var firstRun = runs[0];
                var firstText = firstRun.GetFirstChild<W.Text>();

                if (firstText != null)
                {
                    firstText.Text = newText;
                    firstText.Space = SpaceProcessingModeValues.Preserve;
                }
                else
                {
                    firstRun.Append(new W.Text(newText) { Space = SpaceProcessingModeValues.Preserve });
                }

                // Remove subsequent runs that were part of the split tag
                for (int i = 1; i < runs.Count; i++)
                {
                    // Only remove runs that contained part of the tag text
                    var runText = string.Concat(runs[i].Elements<W.Text>().Select(t => t.Text));
                    if (!string.IsNullOrEmpty(runText))
                    {
                        foreach (var text in runs[i].Elements<W.Text>().ToList())
                        {
                            text.Text = string.Empty;
                        }
                    }
                }
            }
        }
    }

    /// <summary>
    /// Finds the paragraph containing {{INNHALD}} and replaces it with
    /// Markdown-parsed OpenXML paragraphs.
    /// </summary>
    private static void ReplaceContentTag(WordprocessingDocument wordDoc, string markdownContent)
    {
        var body = wordDoc.MainDocumentPart?.Document?.Body;
        if (body == null)
        {
            return;
        }

        const string contentTag = "{{INNHALD}}";

        // Find the paragraph containing the content tag
        W.Paragraph? targetParagraph = null;
        foreach (var paragraph in body.Elements<W.Paragraph>())
        {
            var fullText = string.Concat(paragraph.Descendants<W.Text>().Select(t => t.Text));
            if (fullText.Contains(contentTag, StringComparison.Ordinal))
            {
                targetParagraph = paragraph;
                break;
            }
        }

        if (targetParagraph == null)
        {
            return;
        }

        // Parse Markdown to OpenXML paragraphs
        var parsedParagraphs = MarkdownToOpenXmlConverter.Convert(markdownContent);

        if (parsedParagraphs.Count == 0)
        {
            // Just remove the tag text
            targetParagraph.Remove();
            return;
        }

        // Insert parsed paragraphs before the tag paragraph, then remove the tag
        var parent = targetParagraph.Parent;
        if (parent == null)
        {
            return;
        }

        foreach (var newParagraph in parsedParagraphs)
        {
            parent.InsertBefore(newParagraph, targetParagraph);
        }

        targetParagraph.Remove();
    }

    #endregion

    #region Fallbacks for when templates are not found

    private static byte[] FallbackBuildDocx(string content)
    {
        using var ms = new MemoryStream();
        using (var wordDoc = WordprocessingDocument.Create(ms, WordprocessingDocumentType.Document, true))
        {
            var mainPart = wordDoc.AddMainDocumentPart();
            mainPart.Document = new W.Document(new W.Body());
            var body = mainPart.Document.Body!;

            var lines = (content ?? string.Empty).Replace("\r\n", "\n", StringComparison.Ordinal).Replace("\r", "\n", StringComparison.Ordinal).Split('\n');
            foreach (var line in lines)
            {
                var p = new W.Paragraph();
                var r = new W.Run();
                var t = new W.Text(line) { Space = SpaceProcessingModeValues.Preserve };
                r.Append(t);
                p.Append(r);
                body.Append(p);
            }

            mainPart.Document.Save();
        }
        return ms.ToArray();
    }

    private static byte[] FallbackBuildPptx(List<SlideDefinition> slides)
    {
        // Minimal PPTX generation without a template (same as old BuildPptxFromSlides)
        using var ms = new MemoryStream();
        using (var pptDoc = PresentationDocument.Create(ms, PresentationDocumentType.Presentation, true))
        {
            var presentationPart = pptDoc.AddPresentationPart();
            presentationPart.Presentation = new DocumentFormat.OpenXml.Presentation.Presentation();

            var slideMasterPart = presentationPart.AddNewPart<SlideMasterPart>();
            slideMasterPart.SlideMaster = new DocumentFormat.OpenXml.Presentation.SlideMaster(
                new DocumentFormat.OpenXml.Presentation.CommonSlideData(
                    new DocumentFormat.OpenXml.Presentation.ShapeTree(
                        new DocumentFormat.OpenXml.Presentation.NonVisualGroupShapeProperties(
                            new DocumentFormat.OpenXml.Presentation.NonVisualDrawingProperties { Id = 1U, Name = "" },
                            new DocumentFormat.OpenXml.Presentation.NonVisualGroupShapeDrawingProperties(),
                            new DocumentFormat.OpenXml.Presentation.ApplicationNonVisualDrawingProperties()),
                        new DocumentFormat.OpenXml.Presentation.GroupShapeProperties(
                            new DocumentFormat.OpenXml.Drawing.TransformGroup()))),
                new DocumentFormat.OpenXml.Presentation.ColorMap
                {
                    Background1 = DocumentFormat.OpenXml.Drawing.ColorSchemeIndexValues.Light1,
                    Text1 = DocumentFormat.OpenXml.Drawing.ColorSchemeIndexValues.Dark1,
                    Background2 = DocumentFormat.OpenXml.Drawing.ColorSchemeIndexValues.Light2,
                    Text2 = DocumentFormat.OpenXml.Drawing.ColorSchemeIndexValues.Dark2,
                    Accent1 = DocumentFormat.OpenXml.Drawing.ColorSchemeIndexValues.Accent1,
                    Accent2 = DocumentFormat.OpenXml.Drawing.ColorSchemeIndexValues.Accent2,
                    Accent3 = DocumentFormat.OpenXml.Drawing.ColorSchemeIndexValues.Accent3,
                    Accent4 = DocumentFormat.OpenXml.Drawing.ColorSchemeIndexValues.Accent4,
                    Accent5 = DocumentFormat.OpenXml.Drawing.ColorSchemeIndexValues.Accent5,
                    Accent6 = DocumentFormat.OpenXml.Drawing.ColorSchemeIndexValues.Accent6,
                    Hyperlink = DocumentFormat.OpenXml.Drawing.ColorSchemeIndexValues.Hyperlink,
                    FollowedHyperlink = DocumentFormat.OpenXml.Drawing.ColorSchemeIndexValues.FollowedHyperlink
                });

            var slideLayoutPart = slideMasterPart.AddNewPart<SlideLayoutPart>();
            slideLayoutPart.SlideLayout = new DocumentFormat.OpenXml.Presentation.SlideLayout(
                new DocumentFormat.OpenXml.Presentation.CommonSlideData(
                    new DocumentFormat.OpenXml.Presentation.ShapeTree(
                        new DocumentFormat.OpenXml.Presentation.NonVisualGroupShapeProperties(
                            new DocumentFormat.OpenXml.Presentation.NonVisualDrawingProperties { Id = 1U, Name = "" },
                            new DocumentFormat.OpenXml.Presentation.NonVisualGroupShapeDrawingProperties(),
                            new DocumentFormat.OpenXml.Presentation.ApplicationNonVisualDrawingProperties()),
                        new DocumentFormat.OpenXml.Presentation.GroupShapeProperties(
                            new DocumentFormat.OpenXml.Drawing.TransformGroup()))));

            slideMasterPart.SlideMaster.AppendChild(
                new DocumentFormat.OpenXml.Presentation.SlideLayoutIdList(
                    new DocumentFormat.OpenXml.Presentation.SlideLayoutId
                    {
                        Id = 2147483649U,
                        RelationshipId = slideMasterPart.GetIdOfPart(slideLayoutPart)
                    }));

            presentationPart.Presentation.AppendChild(
                new DocumentFormat.OpenXml.Presentation.SlideMasterIdList(
                    new DocumentFormat.OpenXml.Presentation.SlideMasterId
                    {
                        Id = 2147483648U,
                        RelationshipId = presentationPart.GetIdOfPart(slideMasterPart)
                    }));

            presentationPart.Presentation.AppendChild(
                new DocumentFormat.OpenXml.Presentation.SlideSize { Cx = 12192000, Cy = 6858000 });
            presentationPart.Presentation.AppendChild(
                new DocumentFormat.OpenXml.Presentation.NotesSize { Cx = 6858000, Cy = 9144000 });

            var slideIdList = presentationPart.Presentation.AppendChild(
                new DocumentFormat.OpenXml.Presentation.SlideIdList());

            uint slideId = 256;
            foreach (var slideDef in slides)
            {
                var slidePart = presentationPart.AddNewPart<SlidePart>();
                slidePart.Slide = CreateFallbackSlide(slideDef.Title ?? "", slideDef.Content ?? "");
                slidePart.AddPart(slideLayoutPart);

                slideIdList.AppendChild(new DocumentFormat.OpenXml.Presentation.SlideId
                {
                    Id = slideId++,
                    RelationshipId = presentationPart.GetIdOfPart(slidePart)
                });
            }

            presentationPart.Presentation.Save();
        }
        return ms.ToArray();
    }

    private static DocumentFormat.OpenXml.Presentation.Slide CreateFallbackSlide(string title, string content)
    {
        var slide = new DocumentFormat.OpenXml.Presentation.Slide(
            new DocumentFormat.OpenXml.Presentation.CommonSlideData(
                new DocumentFormat.OpenXml.Presentation.ShapeTree(
                    new DocumentFormat.OpenXml.Presentation.NonVisualGroupShapeProperties(
                        new DocumentFormat.OpenXml.Presentation.NonVisualDrawingProperties { Id = 1U, Name = "" },
                        new DocumentFormat.OpenXml.Presentation.NonVisualGroupShapeDrawingProperties(),
                        new DocumentFormat.OpenXml.Presentation.ApplicationNonVisualDrawingProperties()),
                    new DocumentFormat.OpenXml.Presentation.GroupShapeProperties(
                        new DocumentFormat.OpenXml.Drawing.TransformGroup()))));

        var shapeTree = slide.CommonSlideData!.ShapeTree!;
        uint shapeId = 2;

        if (!string.IsNullOrWhiteSpace(title))
        {
            shapeTree.AppendChild(CreateFallbackTextShape(shapeId++, title, 457200, 274638, 8229600, 1143000, 4400, true));
        }

        if (!string.IsNullOrWhiteSpace(content))
        {
            var topOffset = string.IsNullOrWhiteSpace(title) ? 274638 : 1600200;
            shapeTree.AppendChild(CreateFallbackTextShape(shapeId, content, 457200, topOffset, 8229600, 4525963, 2400, false));
        }

        return slide;
    }

    private static DocumentFormat.OpenXml.Presentation.Shape CreateFallbackTextShape(
        uint id, string text, int x, int y, int cx, int cy, int fontSize, bool bold)
    {
        return new DocumentFormat.OpenXml.Presentation.Shape(
            new DocumentFormat.OpenXml.Presentation.NonVisualShapeProperties(
                new DocumentFormat.OpenXml.Presentation.NonVisualDrawingProperties { Id = id, Name = $"Shape{id}" },
                new DocumentFormat.OpenXml.Presentation.NonVisualShapeDrawingProperties(),
                new DocumentFormat.OpenXml.Presentation.ApplicationNonVisualDrawingProperties()),
            new DocumentFormat.OpenXml.Presentation.ShapeProperties(
                new DocumentFormat.OpenXml.Drawing.Transform2D(
                    new DocumentFormat.OpenXml.Drawing.Offset { X = x, Y = y },
                    new DocumentFormat.OpenXml.Drawing.Extents { Cx = cx, Cy = cy }),
                new DocumentFormat.OpenXml.Drawing.PresetGeometry(new DocumentFormat.OpenXml.Drawing.AdjustValueList())
                {
                    Preset = DocumentFormat.OpenXml.Drawing.ShapeTypeValues.Rectangle
                }),
            new DocumentFormat.OpenXml.Presentation.TextBody(
                new DocumentFormat.OpenXml.Drawing.BodyProperties(),
                new DocumentFormat.OpenXml.Drawing.ListStyle(),
                new DocumentFormat.OpenXml.Drawing.Paragraph(
                    new DocumentFormat.OpenXml.Drawing.Run(
                        new DocumentFormat.OpenXml.Drawing.RunProperties { FontSize = fontSize, Bold = bold, Language = "nn-NO" },
                        new DocumentFormat.OpenXml.Drawing.Text(text)))));
    }

    #endregion
}
