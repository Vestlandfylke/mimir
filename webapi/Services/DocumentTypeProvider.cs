// Copyright (c) Microsoft. All rights reserved.

using Microsoft.KernelMemory.Pipeline;

namespace CopilotChat.WebApi.Services;

/// <summary>
/// Defines a service that provides supported document types for import.
/// </summary>
public class DocumentTypeProvider
{
    private readonly Dictionary<string, bool> _supportedTypes;

    /// <summary>
    /// Construct provider based on if images are supported, or not.
    /// </summary>
    /// <param name="allowImageOcr">Flag indicating if image ocr is supported</param>
    public DocumentTypeProvider(bool allowImageOcr)
    {
        this._supportedTypes =
            new(StringComparer.OrdinalIgnoreCase)
            {
                // Text documents
                { FileExtensions.MarkDown, false },
                { FileExtensions.MsWord, false },
                { FileExtensions.MsWordX, false },
                { FileExtensions.Pdf, false },
                { FileExtensions.PlainText, false },
                
                // Additional text/data formats
                { ".html", false },
                { ".htm", false },
                { ".json", false },
                { ".csv", false },
                { ".xml", false },
                { ".rtf", false },
                
                // Microsoft Office formats
                { ".xlsx", false },  // Excel
                { ".xls", false },   // Excel (legacy)
                { ".pptx", false },  // PowerPoint
                { ".ppt", false },   // PowerPoint (legacy)
                
                // Images (require OCR)
                { FileExtensions.ImageBmp, true },
                { FileExtensions.ImageGif, true },
                { FileExtensions.ImagePng, true },
                { FileExtensions.ImageJpg, true },
                { FileExtensions.ImageJpeg, true },
                { FileExtensions.ImageTiff, true },
                { ".webp", true },
            };
    }

    /// <summary>
    /// Returns true if the extension is supported for import.
    /// </summary>
    /// <param name="extension">The file extension</param>
    /// <param name="isSafetyTarget">Is the document a target for content safety, if enabled?</param>
    /// <returns></returns>
    public bool IsSupported(string extension, out bool isSafetyTarget)
    {
        return this._supportedTypes.TryGetValue(extension, out isSafetyTarget);
    }

    /// <summary>
    /// Gets all supported file extensions as a comma-separated string.
    /// Useful for frontend accept attribute.
    /// </summary>
    /// <returns>Comma-separated list of supported extensions</returns>
    public string GetSupportedExtensions()
    {
        return string.Join(",", this._supportedTypes.Keys);
    }

    /// <summary>
    /// Gets all supported file extensions as a list.
    /// </summary>
    /// <returns>List of supported extensions</returns>
    public IEnumerable<string> GetSupportedExtensionsList()
    {
        return this._supportedTypes.Keys;
    }
}