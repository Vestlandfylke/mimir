// Copyright (c) Microsoft. All rights reserved.

using System.Text;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Wordprocessing;
using UglyToad.PdfPig;
using PdfPage = UglyToad.PdfPig.Content.Page;

namespace CopilotChat.WebApi.Services;

/// <summary>
/// Service for extracting text content from various document formats.
/// Supports PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), and plain text files.
/// </summary>
public class DocumentTextExtractor : IDocumentTextExtractor
{
    private readonly ILogger<DocumentTextExtractor> _logger;

    // File extensions that are treated as plain text
    private static readonly HashSet<string> TextExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".txt", ".md", ".json", ".xml", ".html", ".htm", ".css", ".js", ".ts",
        ".cs", ".py", ".java", ".cpp", ".c", ".h", ".yaml", ".yml", ".csv",
        ".log", ".ini", ".config", ".sh", ".ps1", ".bat", ".sql"
    };

    public DocumentTextExtractor(ILogger<DocumentTextExtractor> logger)
    {
        this._logger = logger;
    }

    /// <summary>
    /// Extracts text from a document stream based on its file extension.
    /// </summary>
    /// <param name="stream">The document stream.</param>
    /// <param name="fileName">The file name (used to determine format).</param>
    /// <param name="maxLength">Maximum characters to extract (0 = unlimited).</param>
    /// <returns>Extracted text content.</returns>
    public async Task<string> ExtractTextAsync(Stream stream, string fileName, int maxLength = 0)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();

        try
        {
            var text = extension switch
            {
                ".pdf" => this.ExtractFromPdf(stream),
                ".docx" => this.ExtractFromWord(stream),
                ".xlsx" => this.ExtractFromExcel(stream),
                ".pptx" => this.ExtractFromPowerPoint(stream),
                _ when TextExtensions.Contains(extension) => await this.ExtractFromTextFileAsync(stream),
                _ => $"[Unsupported file format: {extension}]"
            };

            // Truncate if needed
            if (maxLength > 0 && text.Length > maxLength)
            {
                text = text.Substring(0, maxLength) + "\n\n[Content truncated...]";
            }

            return text;
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error extracting text from {FileName}", fileName);
            return $"[Error extracting text from {fileName}: {ex.Message}]";
        }
    }

    /// <summary>
    /// Extracts text from a PDF document.
    /// </summary>
    private string ExtractFromPdf(Stream stream)
    {
        var sb = new StringBuilder();

        using var document = PdfDocument.Open(stream);
        foreach (PdfPage page in document.GetPages())
        {
            sb.AppendLine(page.Text);
            sb.AppendLine(); // Page separator
        }

        return sb.ToString().Trim();
    }

    /// <summary>
    /// Extracts text from a Word document (.docx).
    /// </summary>
    private string ExtractFromWord(Stream stream)
    {
        var sb = new StringBuilder();

        using var document = WordprocessingDocument.Open(stream, false);
        var body = document.MainDocumentPart?.Document.Body;

        if (body != null)
        {
            foreach (var element in body.Elements())
            {
                if (element is Paragraph paragraph)
                {
                    sb.AppendLine(paragraph.InnerText);
                }
                else if (element is DocumentFormat.OpenXml.Wordprocessing.Table table)
                {
                    foreach (var row in table.Elements<TableRow>())
                    {
                        var cells = row.Elements<TableCell>()
                            .Select(c => c.InnerText)
                            .ToList();
                        sb.AppendLine(string.Join(" | ", cells));
                    }
                    sb.AppendLine();
                }
            }
        }

        return sb.ToString().Trim();
    }

    /// <summary>
    /// Extracts text from an Excel spreadsheet (.xlsx).
    /// </summary>
    private string ExtractFromExcel(Stream stream)
    {
        var sb = new StringBuilder();

        using var document = SpreadsheetDocument.Open(stream, false);
        var workbookPart = document.WorkbookPart;

        if (workbookPart == null)
        {
            return "[Empty Excel file]";
        }

        var sheets = workbookPart.Workbook.Sheets?.Elements<Sheet>() ?? Enumerable.Empty<Sheet>();
        var sharedStrings = workbookPart.SharedStringTablePart?.SharedStringTable;

        foreach (var sheet in sheets)
        {
            if (sheet.Id?.Value == null)
            {
                continue;
            }

            var worksheetPart = (WorksheetPart)workbookPart.GetPartById(sheet.Id.Value);
            var sheetData = worksheetPart.Worksheet.Elements<SheetData>().FirstOrDefault();

            if (sheetData == null)
            {
                continue;
            }

            sb.AppendLine($"=== Sheet: {sheet.Name} ===");

            var rowCount = 0;
            foreach (var row in sheetData.Elements<Row>())
            {
                if (rowCount++ > 100) // Limit rows per sheet
                {
                    sb.AppendLine("[... more rows truncated ...]");
                    break;
                }

                var cellValues = new List<string>();
                foreach (var cell in row.Elements<Cell>())
                {
                    var value = GetCellValue(cell, sharedStrings);
                    cellValues.Add(value);
                }

                if (cellValues.Any(v => !string.IsNullOrWhiteSpace(v)))
                {
                    sb.AppendLine(string.Join(" | ", cellValues));
                }
            }

            sb.AppendLine();
        }

        return sb.ToString().Trim();
    }

    /// <summary>
    /// Gets the string value of an Excel cell.
    /// </summary>
    private static string GetCellValue(Cell cell, SharedStringTable? sharedStrings)
    {
        var value = cell.CellValue?.Text ?? string.Empty;

        if (cell.DataType?.Value == CellValues.SharedString && sharedStrings != null)
        {
            if (int.TryParse(value, out int index) && index < sharedStrings.Count())
            {
                value = sharedStrings.ElementAt(index).InnerText;
            }
        }

        return value;
    }

    /// <summary>
    /// Extracts text from a PowerPoint presentation (.pptx).
    /// </summary>
    private string ExtractFromPowerPoint(Stream stream)
    {
        var sb = new StringBuilder();

        using var document = PresentationDocument.Open(stream, false);
        var presentationPart = document.PresentationPart;

        if (presentationPart == null)
        {
            return "[Empty PowerPoint file]";
        }

        var slideIds = presentationPart.Presentation.SlideIdList?.Elements<DocumentFormat.OpenXml.Presentation.SlideId>() ?? Enumerable.Empty<DocumentFormat.OpenXml.Presentation.SlideId>();
        var slideNumber = 1;

        foreach (var slideId in slideIds)
        {
            if (slideId.RelationshipId?.Value == null)
            {
                continue;
            }

            var slidePart = (SlidePart)presentationPart.GetPartById(slideId.RelationshipId.Value);

            sb.AppendLine($"=== Slide {slideNumber++} ===");

            // Extract all text from the slide
            var texts = slidePart.Slide.Descendants<DocumentFormat.OpenXml.Drawing.Text>();
            foreach (var text in texts)
            {
                if (!string.IsNullOrWhiteSpace(text.Text))
                {
                    sb.AppendLine(text.Text);
                }
            }

            sb.AppendLine();
        }

        return sb.ToString().Trim();
    }

    /// <summary>
    /// Reads text from a plain text file.
    /// </summary>
    private async Task<string> ExtractFromTextFileAsync(Stream stream)
    {
        using var reader = new StreamReader(stream);
        return await reader.ReadToEndAsync();
    }

    /// <summary>
    /// Checks if a file extension is supported for text extraction.
    /// </summary>
    public bool IsSupported(string fileName)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        return extension is ".pdf" or ".docx" or ".xlsx" or ".pptx" || TextExtensions.Contains(extension);
    }
}

/// <summary>
/// Interface for document text extraction service.
/// </summary>
public interface IDocumentTextExtractor
{
    /// <summary>
    /// Extracts text from a document stream.
    /// </summary>
    Task<string> ExtractTextAsync(Stream stream, string fileName, int maxLength = 0);

    /// <summary>
    /// Checks if a file extension is supported.
    /// </summary>
    bool IsSupported(string fileName);
}
