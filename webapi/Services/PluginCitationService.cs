// Copyright (c) Microsoft. All rights reserved.

using CopilotChat.WebApi.Models.Storage;

namespace CopilotChat.WebApi.Services;

/// <summary>
/// Scoped service to collect citations from plugins during a request.
/// This allows any plugin (LeiarKontekst, SharePoint, Lovdata, MimirKnowledge, etc.)
/// to register citations that will be displayed in the chat response.
/// </summary>
public sealed class PluginCitationService
{
    private readonly Dictionary<string, CitationSource> _citations = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Adds a citation from a plugin search/retrieval result.
    /// </summary>
    /// <param name="documentTitle">The title of the document.</param>
    /// <param name="source">The source/path/URL of the document.</param>
    /// <param name="snippet">A relevant snippet from the document.</param>
    /// <param name="relevanceScore">The relevance score from the search.</param>
    /// <param name="sourceType">The type of source (e.g., "Leiardokument", "SharePoint", "Lovdata", "Kunnskapsbase").</param>
    public void AddCitation(string documentTitle, string source, string snippet, double relevanceScore, string sourceType = "")
    {
        // Use document title as key to avoid duplicates
        var key = documentTitle;

        if (!_citations.ContainsKey(key))
        {
            _citations[key] = new CitationSource
            {
                Link = source,
                SourceContentType = GetContentType(source),
                SourceName = documentTitle,
                Snippet = TruncateSnippet(snippet, 1000),
                RelevanceScore = relevanceScore,
                SourceType = sourceType
            };
        }
    }

    /// <summary>
    /// Gets all collected citations.
    /// </summary>
    public IEnumerable<CitationSource> GetCitations()
    {
        return _citations.Values.OrderByDescending(c => c.RelevanceScore);
    }

    /// <summary>
    /// Checks if there are any citations.
    /// </summary>
    public bool HasCitations => _citations.Count > 0;

    /// <summary>
    /// Clears all collected citations.
    /// </summary>
    public void Clear()
    {
        _citations.Clear();
    }

    private static string GetContentType(string source)
    {
        if (string.IsNullOrEmpty(source))
        {
            return "text/plain";
        }

        var extension = Path.GetExtension(source).ToLowerInvariant();
        return extension switch
        {
            ".pdf" => "application/pdf",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".doc" => "application/msword",
            ".txt" => "text/plain",
            ".md" => "text/markdown",
            ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            _ => "text/plain"
        };
    }

    private static string TruncateSnippet(string snippet, int maxLength)
    {
        if (string.IsNullOrEmpty(snippet) || snippet.Length <= maxLength)
        {
            return snippet;
        }

        return snippet.Substring(0, maxLength) + "...";
    }
}
