// Copyright (c) Microsoft. All rights reserved.

using System.ComponentModel.DataAnnotations;

namespace CopilotChat.Shared.Ocr.Tesseract;

/// <summary>
/// Configuration options for Tesseract OCR support.
/// </summary>
public sealed class TesseractConfig
{
<<<<<<<< HEAD:shared/Ocr/Tesseract/TesseractOptions.cs
    public const string SectionName = "Tesseract";

========
>>>>>>>> upstream/main:shared/Ocr/Tesseract/TesseractConfig.cs
    /// <summary>
    /// The file path where the Tesseract language file is stored (e.g. "./data")
    /// </summary>
    [Required]
    public string? FilePath { get; set; } = string.Empty;

    /// <summary>
    /// The language file prefix name (e.g. "eng")
    /// </summary>
    [Required]
    public string? Language { get; set; } = string.Empty;
}
