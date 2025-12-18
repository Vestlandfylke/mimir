// Copyright (c) Microsoft. All rights reserved.

using System.ComponentModel;
using System.Text;
using System.Text.Json;
using CopilotChat.WebApi.Auth;
using CopilotChat.WebApi.Models.Storage;
using CopilotChat.WebApi.Storage;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using Microsoft.AspNetCore.Http;
using Microsoft.SemanticKernel;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

using QuestPDF.Fluent;

// Namespace aliases to avoid type conflicts between OpenXML and QuestPDF
using W = DocumentFormat.OpenXml.Wordprocessing;
using S = DocumentFormat.OpenXml.Spreadsheet;
using P = DocumentFormat.OpenXml.Presentation;
using D = DocumentFormat.OpenXml.Drawing;
using QuestDoc = QuestPDF.Fluent.Document;

namespace CopilotChat.WebApi.Plugins.FileGeneration;

/// <summary>
/// Plugin for generating downloadable files from AI responses.
/// </summary>
public class FileGenerationPlugin
{
  private readonly GeneratedFileRepository _fileRepository;
  private readonly ILogger<FileGenerationPlugin> _logger;
  private readonly IHttpContextAccessor _httpContextAccessor;
  private readonly IAuthInfo _authInfo;

  public FileGenerationPlugin(
      GeneratedFileRepository fileRepository,
      ILogger<FileGenerationPlugin> logger,
      IHttpContextAccessor httpContextAccessor,
      IAuthInfo authInfo)
  {
    this._fileRepository = fileRepository;
    this._logger = logger;
    this._httpContextAccessor = httpContextAccessor;
    this._authInfo = authInfo;
  }

  /// <summary>
  /// Creates a downloadable text file (markdown, plain text, etc.).
  /// </summary>
  /// <param name="fileName">The name of the file (e.g., "dokument.md")</param>
  /// <param name="content">The text content of the file</param>
  /// <param name="chatId">The chat ID</param>
  /// <returns>A download URL for the file</returns>
  [KernelFunction, Description("Lag ei nedlastbar tekstfil (markdown, txt, osv.) som brukaren kan laste ned")]
  public async Task<string> CreateTextFile(
      [Description("Filnamn (t.d. 'dokument.md', 'rapport.txt')")] string fileName,
      [Description("Innhaldet i fila")] string content,
      [Description("Chat ID")] string chatId)
  {
    try
    {
      EnsureTextFileExtension(fileName);
      var fileId = Guid.NewGuid().ToString();
      var contentType = GetContentType(fileName);

      var file = new GeneratedFile
      {
        Id = fileId,
        ChatId = chatId,
        // Always use the authenticated user id from the request context (stable id),
        // instead of trusting the LLM to supply the correct value.
        UserId = this._authInfo.UserId,
        FileName = fileName,
        ContentType = contentType,
        Content = content,
        Size = Encoding.UTF8.GetByteCount(content),
        CreatedOn = DateTimeOffset.UtcNow,
        ExpiresOn = DateTimeOffset.UtcNow.AddDays(7) // Expire after 7 days
      };

      await this._fileRepository.CreateAsync(file);

      var downloadUrl = this.GetDownloadUrl(fileId);
      this._logger.LogInformation("Created downloadable file {FileName} with ID {FileId}", fileName, fileId);

      return downloadUrl;
    }
    catch (Exception ex)
    {
      this._logger.LogError(ex, "Error creating downloadable file {FileName}", fileName);
      throw;
    }
  }

  /// <summary>
  /// Creates a downloadable Word document (.docx) from plain text content.
  /// The server generates a valid .docx so the model doesn't need to produce base64.
  /// </summary>
  [KernelFunction, Description("Lag ei ekte Word-fil (.docx) som brukaren kan laste ned. Innhald er vanleg tekst; serveren byggjer ei gyldig .docx.")]
  public async Task<string> CreateWordFile(
      [Description("Filnamn (t.d. 'rapport.docx')")] string fileName,
      [Description("Tekstinnhald som skal inn i Word-dokumentet")] string content,
      [Description("Chat ID")] string chatId)
  {
    try
    {
      fileName = EnsureExtension(fileName, ".docx");
      var bytes = BuildDocxFromPlainText(content);
      var contentBase64 = Convert.ToBase64String(bytes);
      return await this.CreateBinaryFile(fileName, contentBase64, chatId);
    }
    catch (Exception ex)
    {
      this._logger.LogError(ex, "Error creating Word file {FileName}", fileName);
      throw;
    }
  }

  /// <summary>
  /// Creates a downloadable Excel file (.xlsx) from tabular data.
  /// Accepts either CSV-formatted text or JSON array of objects.
  /// </summary>
  [KernelFunction, Description("Lag ei ekte Excel-fil (.xlsx) frå tabelldata. Send inn data som CSV (semikolon- eller kommaseparert) eller JSON array.")]
  public async Task<string> CreateExcelFile(
      [Description("Filnamn (t.d. 'data.xlsx')")] string fileName,
      [Description("Tabelldata som CSV (rad per linje, kolonnar med ; eller ,) eller JSON array [{\"kolonne1\": \"verdi1\", ...}, ...]")] string tableData,
      [Description("Chat ID")] string chatId)
  {
    try
    {
      fileName = EnsureExtension(fileName, ".xlsx");
      var bytes = BuildXlsxFromData(tableData);
      var contentBase64 = Convert.ToBase64String(bytes);
      return await this.CreateBinaryFile(fileName, contentBase64, chatId);
    }
    catch (Exception ex)
    {
      this._logger.LogError(ex, "Error creating Excel file {FileName}", fileName);
      throw;
    }
  }

  /// <summary>
  /// Creates a downloadable PowerPoint file (.pptx) from slide content.
  /// </summary>
  [KernelFunction, Description("Lag ei ekte PowerPoint-fil (.pptx). Send inn lysbilete som JSON array med tittel og innhald for kvart lysbilde.")]
  public async Task<string> CreatePowerPointFile(
      [Description("Filnamn (t.d. 'presentasjon.pptx')")] string fileName,
      [Description("Lysbilete som JSON array: [{\"title\": \"Tittel\", \"content\": \"Punktliste eller tekst\"}, ...]")] string slidesJson,
      [Description("Chat ID")] string chatId)
  {
    try
    {
      fileName = EnsureExtension(fileName, ".pptx");
      var bytes = BuildPptxFromSlides(slidesJson);
      var contentBase64 = Convert.ToBase64String(bytes);
      return await this.CreateBinaryFile(fileName, contentBase64, chatId);
    }
    catch (Exception ex)
    {
      this._logger.LogError(ex, "Error creating PowerPoint file {FileName}", fileName);
      throw;
    }
  }

  /// <summary>
  /// Creates a downloadable PDF file from text content.
  /// </summary>
  [KernelFunction, Description("Lag ei ekte PDF-fil frå tekstinnhald. Serveren byggjer ei gyldig .pdf med god formatering.")]
  public async Task<string> CreatePdfFile(
      [Description("Filnamn (t.d. 'dokument.pdf')")] string fileName,
      [Description("Tekstinnhald som skal inn i PDF-dokumentet")] string content,
      [Description("Valfri tittel for dokumentet")] string? title,
      [Description("Chat ID")] string chatId)
  {
    try
    {
      fileName = EnsureExtension(fileName, ".pdf");
      var bytes = BuildPdfFromText(content, title);
      var contentBase64 = Convert.ToBase64String(bytes);
      return await this.CreateBinaryFile(fileName, contentBase64, chatId);
    }
    catch (Exception ex)
    {
      this._logger.LogError(ex, "Error creating PDF file {FileName}", fileName);
      throw;
    }
  }

  /// <summary>
  /// Creates a downloadable binary file (e.g., PDF, Word document).
  /// </summary>
  /// <param name="fileName">The name of the file</param>
  /// <param name="contentBase64">The base64-encoded content of the file</param>
  /// <param name="chatId">The chat ID</param>
  /// <returns>A download URL for the file</returns>
  [KernelFunction, Description("Lag ei nedlastbar binærfil (PDF, Word, osv.) som brukaren kan laste ned")]
  public async Task<string> CreateBinaryFile(
      [Description("Filnamn (t.d. 'dokument.pdf', 'rapport.docx')")] string fileName,
      [Description("Base64-enkoda innhald")] string contentBase64,
      [Description("Chat ID")] string chatId)
  {
    try
    {
      var fileId = Guid.NewGuid().ToString();
      var contentType = GetContentType(fileName);

      // Decode base64 to get actual size
      byte[] bytes = Convert.FromBase64String(contentBase64);

      var file = new GeneratedFile
      {
        Id = fileId,
        ChatId = chatId,
        // Always use the authenticated user id from the request context (stable id),
        // instead of trusting the LLM to supply the correct value.
        UserId = this._authInfo.UserId,
        FileName = fileName,
        ContentType = contentType,
        Content = contentBase64,
        Size = bytes.Length,
        CreatedOn = DateTimeOffset.UtcNow,
        ExpiresOn = DateTimeOffset.UtcNow.AddDays(7)
      };

      await this._fileRepository.CreateAsync(file);

      var downloadUrl = this.GetDownloadUrl(fileId);
      this._logger.LogInformation("Created binary file {FileName} with ID {FileId}", fileName, fileId);

      return downloadUrl;
    }
    catch (Exception ex)
    {
      this._logger.LogError(ex, "Error creating binary file {FileName}", fileName);
      throw;
    }
  }

  private static string GetContentType(string fileName)
  {
    var extension = Path.GetExtension(fileName).ToLowerInvariant();
    return extension switch
    {
      ".md" => "text/markdown",
      ".txt" => "text/plain",
      ".html" => "text/html",
      ".json" => "application/json",
      ".xml" => "application/xml",
      ".pdf" => "application/pdf",
      ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".doc" => "application/msword",
      ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".xls" => "application/vnd.ms-excel",
      ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".ppt" => "application/vnd.ms-powerpoint",
      ".csv" => "text/csv",
      ".zip" => "application/zip",
      _ => "application/octet-stream"
    };
  }

  private static string EnsureExtension(string fileName, string requiredExtension)
  {
    if (string.IsNullOrWhiteSpace(fileName))
    {
      return $"dokument{requiredExtension}";
    }

    var ext = Path.GetExtension(fileName);
    if (string.Equals(ext, requiredExtension, StringComparison.OrdinalIgnoreCase))
    {
      return fileName;
    }

    // If user provided a different extension, replace it.
    var baseName = string.IsNullOrWhiteSpace(ext) ? fileName : Path.GetFileNameWithoutExtension(fileName);
    return $"{baseName}{requiredExtension}";
  }

  private static void EnsureTextFileExtension(string fileName)
  {
    var ext = Path.GetExtension(fileName).ToLowerInvariant();
    // Allow-list text-friendly formats. Anything else should use CreateBinaryFile or CreateWordFile.
    var ok = ext is ".md" or ".txt" or ".html" or ".json" or ".xml" or ".csv";
    if (!ok)
    {
      throw new ArgumentException(
          $"CreateTextFile støttar berre tekstformat: .md, .txt, .html, .json, .xml, .csv. Du prøvde: '{ext}'. " +
          "Bruk CreateWordFile for .docx, eller CreateBinaryFile for andre binærformat.");
    }
  }

  private static byte[] BuildDocxFromPlainText(string content)
  {
    using var ms = new MemoryStream();
    using (var wordDoc = WordprocessingDocument.Create(ms, WordprocessingDocumentType.Document, true))
    {
      var mainPart = wordDoc.AddMainDocumentPart();
      mainPart.Document = new W.Document(new W.Body());

      var body = mainPart.Document.Body ?? new W.Body();
      mainPart.Document.Body = body;

      // Normalize newlines, keep empty lines as blank paragraphs.
      var lines = (content ?? string.Empty).Replace("\r\n", "\n").Replace("\r", "\n").Split('\n');
      foreach (var line in lines)
      {
        var p = new W.Paragraph();
        var r = new W.Run();
        var t = new W.Text(line ?? string.Empty) { Space = SpaceProcessingModeValues.Preserve };
        r.Append(t);
        p.Append(r);
        body.Append(p);
      }

      mainPart.Document.Save();
    }
    return ms.ToArray();
  }

  private static byte[] BuildXlsxFromData(string tableData)
  {
    var rows = ParseTableData(tableData);

    using var ms = new MemoryStream();
    using (var doc = SpreadsheetDocument.Create(ms, SpreadsheetDocumentType.Workbook, true))
    {
      var workbookPart = doc.AddWorkbookPart();
      workbookPart.Workbook = new S.Workbook();

      var worksheetPart = workbookPart.AddNewPart<WorksheetPart>();
      worksheetPart.Worksheet = new S.Worksheet(new S.SheetData());

      var sheets = workbookPart.Workbook.AppendChild(new S.Sheets());
      var sheet = new S.Sheet()
      {
        Id = workbookPart.GetIdOfPart(worksheetPart),
        SheetId = 1,
        Name = "Data"
      };
      sheets.Append(sheet);

      var sheetData = worksheetPart.Worksheet.GetFirstChild<S.SheetData>()!;

      uint rowIndex = 1;
      foreach (var rowData in rows)
      {
        var row = new S.Row { RowIndex = rowIndex };
        uint colIndex = 1;
        foreach (var cellValue in rowData)
        {
          var cellRef = GetCellReference(colIndex, rowIndex);
          var cell = new S.Cell
          {
            CellReference = cellRef,
            DataType = S.CellValues.String,
            CellValue = new S.CellValue(cellValue ?? string.Empty)
          };
          row.Append(cell);
          colIndex++;
        }
        sheetData.Append(row);
        rowIndex++;
      }

      workbookPart.Workbook.Save();
    }
    return ms.ToArray();
  }

  private static List<List<string>> ParseTableData(string tableData)
  {
    var result = new List<List<string>>();
    var trimmed = (tableData ?? string.Empty).Trim();

    // Try to parse as JSON array first
    if (trimmed.StartsWith('['))
    {
      try
      {
        using var jsonDoc = JsonDocument.Parse(trimmed);
        var array = jsonDoc.RootElement;

        // Get all unique keys for headers
        var headers = new HashSet<string>();
        foreach (var item in array.EnumerateArray())
        {
          if (item.ValueKind == JsonValueKind.Object)
          {
            foreach (var prop in item.EnumerateObject())
            {
              headers.Add(prop.Name);
            }
          }
        }

        var headerList = headers.ToList();
        if (headerList.Count > 0)
        {
          result.Add(headerList);
          foreach (var item in array.EnumerateArray())
          {
            var row = new List<string>();
            foreach (var header in headerList)
            {
              if (item.TryGetProperty(header, out var prop))
              {
                row.Add(prop.ValueKind == JsonValueKind.String ? prop.GetString() ?? "" : prop.ToString());
              }
              else
              {
                row.Add("");
              }
            }
            result.Add(row);
          }
        }
        return result;
      }
      catch
      {
        // Fall through to CSV parsing
      }
    }

    // Parse as CSV (semicolon or comma separated)
    var lines = trimmed.Replace("\r\n", "\n").Replace("\r", "\n").Split('\n');
    var delimiter = trimmed.Contains(';') ? ';' : ',';
    foreach (var line in lines)
    {
      if (string.IsNullOrWhiteSpace(line))
      {
        continue;
      }

      result.Add(line.Split(delimiter).Select(c => c.Trim()).ToList());
    }

    return result;
  }

  private static string GetCellReference(uint col, uint row)
  {
    var colName = "";
    while (col > 0)
    {
      col--;
      colName = (char)('A' + (col % 26)) + colName;
      col /= 26;
    }
    return $"{colName}{row}";
  }

  private static byte[] BuildPptxFromSlides(string slidesJson)
  {
    var slides = ParseSlides(slidesJson);

    using var ms = new MemoryStream();
    using (var pptDoc = PresentationDocument.Create(ms, PresentationDocumentType.Presentation, true))
    {
      var presentationPart = pptDoc.AddPresentationPart();
      presentationPart.Presentation = new P.Presentation();

      // Create slide master and layout (minimal required structure)
      var slideMasterPart = presentationPart.AddNewPart<SlideMasterPart>();
      slideMasterPart.SlideMaster = CreateSlideMaster();

      var slideLayoutPart = slideMasterPart.AddNewPart<SlideLayoutPart>();
      slideLayoutPart.SlideLayout = CreateSlideLayout();

      // Link layout to master
      slideMasterPart.SlideMaster.AppendChild(new P.SlideLayoutIdList(
          new P.SlideLayoutId { Id = 2147483649U, RelationshipId = slideMasterPart.GetIdOfPart(slideLayoutPart) }));

      // Create slide ID list and slide master ID list in presentation
      presentationPart.Presentation.AppendChild(new P.SlideMasterIdList(
          new P.SlideMasterId { Id = 2147483648U, RelationshipId = presentationPart.GetIdOfPart(slideMasterPart) }));

      var slideIdList = presentationPart.Presentation.AppendChild(new P.SlideIdList());

      // Add presentation size
      presentationPart.Presentation.AppendChild(new P.SlideSize { Cx = 9144000, Cy = 6858000 }); // 10" x 7.5"
      presentationPart.Presentation.AppendChild(new P.NotesSize { Cx = 6858000, Cy = 9144000 });

      uint slideId = 256;
      foreach (var slideContent in slides)
      {
        var slidePart = presentationPart.AddNewPart<SlidePart>();
        slidePart.Slide = CreateSlide(slideContent.Title, slideContent.Content);

        // Add relationship to layout
        slidePart.AddPart(slideLayoutPart);

        slideIdList.AppendChild(new P.SlideId
        {
          Id = slideId++,
          RelationshipId = presentationPart.GetIdOfPart(slidePart)
        });
      }

      presentationPart.Presentation.Save();
    }
    return ms.ToArray();
  }

  private static List<(string Title, string Content)> ParseSlides(string slidesJson)
  {
    var result = new List<(string, string)>();
    var trimmed = (slidesJson ?? string.Empty).Trim();

    if (trimmed.StartsWith('['))
    {
      try
      {
        using var jsonDoc = JsonDocument.Parse(trimmed);
        foreach (var item in jsonDoc.RootElement.EnumerateArray())
        {
          var title = item.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
          var content = item.TryGetProperty("content", out var c) ? c.GetString() ?? "" : "";
          result.Add((title, content));
        }
      }
      catch
      {
        // Fallback: treat entire input as a single slide
        result.Add(("", trimmed));
      }
    }
    else
    {
      // Treat as single slide with content
      result.Add(("", trimmed));
    }

    // Ensure at least one slide
    if (result.Count == 0)
    {
      result.Add(("Presentasjon", ""));
    }

    return result;
  }

  private static P.SlideMaster CreateSlideMaster()
  {
    return new P.SlideMaster(
        new P.CommonSlideData(
            new P.ShapeTree(
                new P.NonVisualGroupShapeProperties(
                    new P.NonVisualDrawingProperties { Id = 1U, Name = "" },
                    new P.NonVisualGroupShapeDrawingProperties(),
                    new P.ApplicationNonVisualDrawingProperties()),
                new P.GroupShapeProperties(new D.TransformGroup()))),
        new P.ColorMap
        {
          Background1 = D.ColorSchemeIndexValues.Light1,
          Text1 = D.ColorSchemeIndexValues.Dark1,
          Background2 = D.ColorSchemeIndexValues.Light2,
          Text2 = D.ColorSchemeIndexValues.Dark2,
          Accent1 = D.ColorSchemeIndexValues.Accent1,
          Accent2 = D.ColorSchemeIndexValues.Accent2,
          Accent3 = D.ColorSchemeIndexValues.Accent3,
          Accent4 = D.ColorSchemeIndexValues.Accent4,
          Accent5 = D.ColorSchemeIndexValues.Accent5,
          Accent6 = D.ColorSchemeIndexValues.Accent6,
          Hyperlink = D.ColorSchemeIndexValues.Hyperlink,
          FollowedHyperlink = D.ColorSchemeIndexValues.FollowedHyperlink
        });
  }

  private static P.SlideLayout CreateSlideLayout()
  {
    return new P.SlideLayout(
        new P.CommonSlideData(
            new P.ShapeTree(
                new P.NonVisualGroupShapeProperties(
                    new P.NonVisualDrawingProperties { Id = 1U, Name = "" },
                    new P.NonVisualGroupShapeDrawingProperties(),
                    new P.ApplicationNonVisualDrawingProperties()),
                new P.GroupShapeProperties(new D.TransformGroup()))));
  }

  private static P.Slide CreateSlide(string title, string content)
  {
    var slide = new P.Slide(
        new P.CommonSlideData(
            new P.ShapeTree(
                new P.NonVisualGroupShapeProperties(
                    new P.NonVisualDrawingProperties { Id = 1U, Name = "" },
                    new P.NonVisualGroupShapeDrawingProperties(),
                    new P.ApplicationNonVisualDrawingProperties()),
                new P.GroupShapeProperties(new D.TransformGroup()))));

    var shapeTree = slide.CommonSlideData!.ShapeTree!;
    uint shapeId = 2;

    // Add title shape
    if (!string.IsNullOrWhiteSpace(title))
    {
      shapeTree.AppendChild(CreateTextShape(shapeId++, "Title", title, 457200, 274638, 8229600, 1143000, 4400, true));
    }

    // Add content shape
    if (!string.IsNullOrWhiteSpace(content))
    {
      var topOffset = string.IsNullOrWhiteSpace(title) ? 274638 : 1600200;
      shapeTree.AppendChild(CreateTextShape(shapeId++, "Content", content, 457200, topOffset, 8229600, 4525963, 2400, false));
    }

    return slide;
  }

  private static P.Shape CreateTextShape(uint id, string name, string text, int x, int y, int cx, int cy, int fontSize, bool bold)
  {
    return new P.Shape(
        new P.NonVisualShapeProperties(
            new P.NonVisualDrawingProperties { Id = id, Name = name },
            new P.NonVisualShapeDrawingProperties(),
            new P.ApplicationNonVisualDrawingProperties()),
        new P.ShapeProperties(
            new D.Transform2D(
                new D.Offset { X = x, Y = y },
                new D.Extents { Cx = cx, Cy = cy }),
            new D.PresetGeometry(new D.AdjustValueList()) { Preset = D.ShapeTypeValues.Rectangle }),
        new P.TextBody(
            new D.BodyProperties(),
            new D.ListStyle(),
            new D.Paragraph(
                new D.Run(
                    new D.RunProperties { FontSize = fontSize, Bold = bold, Language = "nn-NO" },
                    new D.Text(text)))));
  }

  private static byte[] BuildPdfFromText(string content, string? title)
  {
    // Configure QuestPDF license (Community license for open source)
    QuestPDF.Settings.License = LicenseType.Community;

    var document = QuestDoc.Create(container =>
    {
      container.Page(page =>
      {
        page.Size(PageSizes.A4);
        page.Margin(2, Unit.Centimetre);
        page.DefaultTextStyle(x => x.FontSize(11).FontFamily("Arial"));

        // Header with title if provided
        if (!string.IsNullOrWhiteSpace(title))
        {
          page.Header()
              .PaddingBottom(0.5f, Unit.Centimetre)
              .Text(title)
              .FontSize(18)
              .Bold()
              .FontColor(Colors.Blue.Darken2);
        }

        // Content
        page.Content()
            .PaddingVertical(0.5f, Unit.Centimetre)
            .Column(column =>
            {
              var lines = (content ?? string.Empty).Replace("\r\n", "\n").Replace("\r", "\n").Split('\n');
              foreach (var line in lines)
              {
                if (string.IsNullOrWhiteSpace(line))
                {
                  column.Item().Height(0.5f, Unit.Centimetre); // Blank line spacing
                }
                else
                {
                  column.Item().Text(line);
                }
              }
            });

        // Footer with page numbers
        page.Footer()
            .AlignCenter()
            .Text(x =>
            {
              x.Span("Side ");
              x.CurrentPageNumber();
              x.Span(" av ");
              x.TotalPages();
            });
      });
    });

    return document.GeneratePdf();
  }

  /// <summary>
  /// Gets the full download URL for a file based on the current request context.
  /// </summary>
  private string GetDownloadUrl(string fileId)
  {
    var httpContext = this._httpContextAccessor.HttpContext;
    if (httpContext != null)
    {
      var request = httpContext.Request;
      var baseUrl = $"{request.Scheme}://{request.Host}{request.PathBase}";
      return $"{baseUrl}/files/{fileId}";
    }

    // Fallback to relative URL if HttpContext is not available
    return $"/files/{fileId}";
  }
}

