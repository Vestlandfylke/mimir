// Copyright (c) Microsoft. All rights reserved.

using System.ComponentModel;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Azure;
using Azure.Search.Documents;
using Azure.Search.Documents.Models;
using CopilotChat.WebApi.Options;
using CopilotChat.WebApi.Services;
using Microsoft.SemanticKernel;

namespace CopilotChat.WebApi.Plugins.Chat;

/// <summary>
/// Semantic Kernel plugin for providing strategic context and organizational documents to the Leader assistant.
/// Uses Azure AI Search to retrieve relevant documents based on the conversation context.
/// This plugin is only registered for the "leader" chat template.
/// </summary>
public sealed class LeiarKontekstPlugin
{
    private readonly ILogger _logger;
    private readonly LeiarKontekstPluginOptions _options;
    private readonly SearchClient _searchClient;
    private readonly LeiarKontekstCitationService? _citationService;

    public LeiarKontekstPlugin(
        LeiarKontekstPluginOptions options,
        ILogger logger,
        LeiarKontekstCitationService? citationService = null)
    {
        this._options = options ?? throw new ArgumentNullException(nameof(options));
        this._logger = logger ?? throw new ArgumentNullException(nameof(logger));
        this._citationService = citationService;

        // Initialize Azure AI Search client
        var credential = new AzureKeyCredential(options.ApiKey!);
        this._searchClient = new SearchClient(
            new Uri(options.Endpoint!),
            options.IndexName,
            credential);
    }

    /// <summary>
    /// Searches for relevant strategic documents and organizational context based on the query.
    /// </summary>
    [KernelFunction, Description("Søk i strategiske dokument og organisatorisk kontekst for leiarar. Bruk dette for å finne relevant informasjon om strategiar, retningslinjer, planar og andre viktige dokument for leiing i Vestland fylkeskommune.")]
    public async Task<string> SearchStrategicDocumentsAsync(
        [Description("Søkeord eller spørsmål for å finne relevante dokument")] string query,
        [Description("Maksimalt antal resultat (standard: 5)")] int maxResults = 5,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return "Ver venleg og oppgje eit søkeord eller spørsmål.";
        }

        this._logger.LogInformation("LeiarKontekst: Searching for documents with query '{Query}'", query);

        try
        {
            var searchOptions = new SearchOptions
            {
                Size = Math.Min(maxResults, this._options.MaxResults),
                IncludeTotalCount = true,
            };

            // Add fields to retrieve
            searchOptions.Select.Add(this._options.TitleFieldName);
            searchOptions.Select.Add(this._options.ContentFieldName);
            searchOptions.Select.Add(this._options.SourceFieldName);

            // Configure semantic search if available
            if (!string.IsNullOrEmpty(this._options.SemanticConfigurationName))
            {
                searchOptions.QueryType = SearchQueryType.Semantic;
                searchOptions.SemanticSearch = new SemanticSearchOptions
                {
                    SemanticConfigurationName = this._options.SemanticConfigurationName,
                    QueryCaption = new QueryCaption(QueryCaptionType.Extractive),
                    QueryAnswer = new QueryAnswer(QueryAnswerType.Extractive)
                };
            }

            // Apply category filter if configured
            if (this._options.Categories?.Any() == true)
            {
                var categoryFilter = string.Join(" or ", this._options.Categories.Select(c => $"category eq '{c}'"));
                searchOptions.Filter = categoryFilter;
            }

            var searchResults = await this._searchClient.SearchAsync<SearchDocument>(query, searchOptions, cancellationToken);

            if (searchResults?.Value == null)
            {
                return "Fann ingen dokument som svarar til søket ditt.";
            }

            var documents = new List<DocumentResult>();
            await foreach (var result in searchResults.Value.GetResultsAsync())
            {
                var doc = new DocumentResult
                {
                    Title = GetFieldValue(result.Document, this._options.TitleFieldName),
                    Source = GetFieldValue(result.Document, this._options.SourceFieldName),
                    Score = result.Score ?? 0
                };

                // Get content and truncate if necessary
                var content = GetFieldValue(result.Document, this._options.ContentFieldName);
                if (content.Length > this._options.MaxContentLength)
                {
                    content = content.Substring(0, this._options.MaxContentLength) + "\n\n[Innhaldet er forkorta...]";
                }
                doc.Content = content;

                // Include semantic captions if available
                if (result.SemanticSearch?.Captions?.Any() == true)
                {
                    doc.Highlights = result.SemanticSearch.Captions
                        .Select(c => c.Text)
                        .Where(t => !string.IsNullOrEmpty(t))
                        .ToList()!;
                }

                documents.Add(doc);

                // Register citation with the citation service for display in the UI
                if (this._citationService != null)
                {
                    var snippet = doc.Highlights?.Any() == true
                        ? string.Join(" ", doc.Highlights)
                        : (content.Length > 500 ? content.Substring(0, 500) + "..." : content);

                    this._citationService.AddCitation(
                        documentTitle: doc.Title,
                        source: doc.Source,
                        snippet: snippet,
                        relevanceScore: doc.Score
                    );
                }
            }

            if (!documents.Any())
            {
                return "Fann ingen dokument som svarar til søket ditt.";
            }

            this._logger.LogInformation("LeiarKontekst: Found {Count} documents for query '{Query}'", documents.Count, query);

            // Format results for the LLM with document names for citation
            var sb = new StringBuilder();
            sb.AppendLine($"Fann {documents.Count} relevante dokument frå leiar-kunnskapsbasen:\n");

            foreach (var doc in documents)
            {
                sb.AppendLine($"=== DOKUMENT: {doc.Title} ===");
                sb.AppendLine();

                if (doc.Highlights?.Any() == true)
                {
                    sb.AppendLine("Viktige utdrag:");
                    foreach (var highlight in doc.Highlights)
                    {
                        sb.AppendLine($"  • {highlight}");
                    }
                    sb.AppendLine();
                }

                sb.AppendLine("Innhald:");
                sb.AppendLine(doc.Content);
                sb.AppendLine($"\n=== SLUTT {doc.Title} ===\n");
            }

            sb.AppendLine("\n---");
            sb.AppendLine("VIKTIG: Når du brukar informasjon frå desse dokumenta, referer til dokumentnamnet.");
            sb.AppendLine("Døme: \"Ifølgje Kompetansestrategien skal vi...\" eller \"I Organisasjonsstrategien står det at...\"");

            return sb.ToString();
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error searching strategic documents");
            return $"Det oppstod ein feil ved søk: {ex.Message}";
        }
    }

    /// <summary>
    /// Gets a specific strategic document by title or identifier.
    /// </summary>
    [KernelFunction, Description("Hent eit spesifikt strategisk dokument basert på tittel. Bruk dette når du veit kva dokument du er ute etter.")]
    public async Task<string> GetDocumentByTitleAsync(
        [Description("Tittel eller del av tittelen på dokumentet")] string title,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return "Ver venleg og oppgje ein tittel.";
        }

        this._logger.LogInformation("LeiarKontekst: Getting document with title '{Title}'", title);

        try
        {
            var searchOptions = new SearchOptions
            {
                Size = 1,
                Filter = $"search.ismatch('{EscapeFilterValue(title)}', '{this._options.TitleFieldName}')"
            };

            searchOptions.Select.Add(this._options.TitleFieldName);
            searchOptions.Select.Add(this._options.ContentFieldName);
            searchOptions.Select.Add(this._options.SourceFieldName);

            var searchResults = await this._searchClient.SearchAsync<SearchDocument>(title, searchOptions, cancellationToken);

            await foreach (var result in searchResults.Value.GetResultsAsync())
            {
                var docTitle = GetFieldValue(result.Document, this._options.TitleFieldName);
                var content = GetFieldValue(result.Document, this._options.ContentFieldName);
                var source = GetFieldValue(result.Document, this._options.SourceFieldName);

                // Register citation with the citation service for display in the UI
                if (this._citationService != null)
                {
                    var snippet = content.Length > 500 ? content.Substring(0, 500) + "..." : content;
                    this._citationService.AddCitation(
                        documentTitle: docTitle,
                        source: source,
                        snippet: snippet,
                        relevanceScore: result.Score ?? 1.0
                    );
                }

                // Truncate if necessary
                if (content.Length > this._options.MaxContentLength)
                {
                    content = content.Substring(0, this._options.MaxContentLength) + "\n\n[Innhaldet er forkorta...]";
                }

                var sb = new StringBuilder();
                sb.AppendLine($"# {docTitle}");
                if (!string.IsNullOrEmpty(source))
                {
                    sb.AppendLine($"*Kjelde: {source}*\n");
                }
                sb.AppendLine(content);

                return sb.ToString();
            }

            return $"Fann ikkje dokumentet '{title}'. Prøv å søke med SearchStrategicDocumentsAsync for å finne relevante dokument.";
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error getting document by title");
            return $"Det oppstod ein feil: {ex.Message}";
        }
    }

    /// <summary>
    /// Lists available strategic document categories.
    /// </summary>
    [KernelFunction, Description("List tilgjengelege kategoriar av strategiske dokument. Nyttig for å forstå kva typar dokument som finst.")]
    public async Task<string> ListCategoriesAsync(CancellationToken cancellationToken = default)
    {
        this._logger.LogInformation("LeiarKontekst: Listing document categories");

        try
        {
            // Use faceted search to get categories
            var searchOptions = new SearchOptions
            {
                Size = 0, // We only want facets, not documents
                IncludeTotalCount = true
            };
            searchOptions.Facets.Add("category,count:50");

            var searchResults = await this._searchClient.SearchAsync<SearchDocument>("*", searchOptions, cancellationToken);

            if (searchResults?.Value?.Facets == null || !searchResults.Value.Facets.ContainsKey("category"))
            {
                // Fallback: return configured categories
                if (this._options.Categories?.Any() == true)
                {
                    return $"Tilgjengelege kategoriar:\n- {string.Join("\n- ", this._options.Categories)}";
                }
                return "Kunne ikkje hente kategoriar. Prøv å søke direkte med SearchStrategicDocumentsAsync.";
            }

            var categories = searchResults.Value.Facets["category"]
                .Select(f => $"- {f.Value} ({f.Count} dokument)")
                .ToList();

            var sb = new StringBuilder();
            sb.AppendLine($"Tilgjengelege kategoriar ({searchResults.Value.TotalCount} dokument totalt):\n");
            sb.AppendLine(string.Join("\n", categories));

            return sb.ToString();
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error listing categories");

            // Fallback: return configured categories
            if (this._options.Categories?.Any() == true)
            {
                return $"Tilgjengelege kategoriar:\n- {string.Join("\n- ", this._options.Categories)}";
            }

            return $"Det oppstod ein feil: {ex.Message}";
        }
    }

    private static string GetFieldValue(SearchDocument document, string fieldName)
    {
        if (document.TryGetValue(fieldName, out var value) && value != null)
        {
            return value.ToString() ?? string.Empty;
        }
        return string.Empty;
    }

    private static string EscapeFilterValue(string value)
    {
        // Escape single quotes for OData filter
        return value.Replace("'", "''");
    }

    private class DocumentResult
    {
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Source { get; set; } = string.Empty;
        public double Score { get; set; }
        public List<string>? Highlights { get; set; }
    }
}
