// Copyright (c) Microsoft. All rights reserved.

using System.ComponentModel;
using System.Text;
using Azure;
using Azure.Search.Documents;
using Azure.Search.Documents.Models;
using CopilotChat.WebApi.Options;
using CopilotChat.WebApi.Services;
using Microsoft.SemanticKernel;

namespace CopilotChat.WebApi.Plugins.Chat;

/// <summary>
/// Semantic Kernel plugin for providing self-knowledge about Mimir.
/// Allows Mimir to answer questions about itself - its history, features, UI, and best practices.
/// Uses Azure AI Search to retrieve relevant documentation based on user queries.
/// This plugin is registered globally for all chat templates.
/// </summary>
public sealed class MimirKnowledgePlugin
{
    private readonly ILogger _logger;
    private readonly MimirKnowledgePluginOptions _options;
    private readonly SearchClient _searchClient;
    private readonly PiiSanitizationService? _piiSanitizationService;

    public MimirKnowledgePlugin(
        MimirKnowledgePluginOptions options,
        ILogger logger,
        PiiSanitizationService? piiSanitizationService = null)
    {
        this._options = options ?? throw new ArgumentNullException(nameof(options));
        this._logger = logger ?? throw new ArgumentNullException(nameof(logger));
        this._piiSanitizationService = piiSanitizationService;

        // Initialize Azure AI Search client
        var credential = new AzureKeyCredential(options.ApiKey!);
        this._searchClient = new SearchClient(
            new Uri(options.Endpoint!),
            options.IndexName,
            credential);
    }

    /// <summary>
    /// Searches for information about Mimir based on the user's query.
    /// Use this when users ask about Mimir itself - how to use it, its features, history, or best practices.
    /// </summary>
    [KernelFunction, Description("Søk i Mimir sin kunnskapsbase. Bruk dette når brukaren spør om Mimir, Vestland fylkeskommune, fylkesdirektøren, direktørar, besøksadresser, tenester, opningstid, forskjellen mellom Mimir og Botolf, personvern og lagring i Mimir, KI-kurs, eller tips for å skrive gode spørsmål. Kunnskapsbasen inneheld både informasjon om Mimir (funksjonar, historie, brukargrensesnitt) og viktig informasjon om Vestland fylkeskommune (leiing, kontor, tenester). Døme: 'Kven er fylkesdirektøren?', 'Kva er adressa til fylkeskommunen?', 'Kva tenester tilbyr fylkeskommunen?', 'Kva er forskjellen på Mimir og Botolf?', 'Korleis deler eg ein samtale?', 'Kva modellar kan eg velje?'")]
    public async Task<string> SearchMimirKnowledgeAsync(
        [Description("Søkeord eller spørsmål om Mimir eller Vestland fylkeskommune")] string query,
        [Description("Kategori å søke i: 'ui' (brukargrensesnitt), 'features' (funksjonar), 'history' (historie og tidslinje), 'prompting' (skrivetips), 'troubleshooting' (feilsøking), 'policy' (KI-retningslinjer), 'info' (informasjon om Vestland fylkeskommune), 'faq' (spørsmål og svar om Mimir). La stå tom for å søke i alle.")] string? category = null,
        [Description("Maksimalt antal resultat (standard: 3)")] int maxResults = 3,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return "Ver venleg og oppgje eit spørsmål om Mimir.";
        }

        this._logger.LogInformation("MimirKnowledge: Searching for '{Query}' in category '{Category}'", query, category ?? "all");

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
            searchOptions.Select.Add(this._options.CategoryFieldName);

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

            // Apply category filter if specified
            if (!string.IsNullOrWhiteSpace(category))
            {
                searchOptions.Filter = $"{this._options.CategoryFieldName} eq '{EscapeFilterValue(category)}'";
            }

            var searchResults = await this._searchClient.SearchAsync<SearchDocument>(query, searchOptions, cancellationToken);

            if (searchResults?.Value == null)
            {
                this._logger.LogWarning("MimirKnowledge: Search returned null for query '{Query}'", query);
                return "Fann ingen informasjon om dette. Prøv å omformulere spørsmålet ditt.";
            }

            // Log total count
            var totalCount = searchResults.Value.TotalCount;
            this._logger.LogInformation("MimirKnowledge: Search returned {TotalCount} total matches", totalCount);

            var documents = new List<DocumentResult>();
            await foreach (var result in searchResults.Value.GetResultsAsync())
            {
                var doc = new DocumentResult
                {
                    Title = GetFieldValue(result.Document, this._options.TitleFieldName),
                    Source = GetFieldValue(result.Document, this._options.SourceFieldName),
                    Category = GetFieldValue(result.Document, this._options.CategoryFieldName),
                    Score = result.Score ?? 0
                };

                this._logger.LogDebug("MimirKnowledge: Found document '{Title}' (category: {Category}, score: {Score})",
                    doc.Title, doc.Category, doc.Score);

                // Get content - for history category, don't truncate to preserve timeline
                var content = GetFieldValue(result.Document, this._options.ContentFieldName);

                // Sanitize PII from retrieved content
                if (this._piiSanitizationService != null)
                {
                    var sanitizeResult = this._piiSanitizationService.Sanitize(content);
                    if (sanitizeResult.ContainsPii)
                    {
                        content = sanitizeResult.SanitizedText;
                        this._logger.LogWarning(
                            "PII detected and masked in MimirKnowledge document '{Title}'. Types: {PiiTypes}",
                            doc.Title, string.Join(", ", sanitizeResult.Warnings));
                    }
                }

                if (doc.Category != "history" && content.Length > this._options.MaxContentLength)
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
            }

            if (!documents.Any())
            {
                this._logger.LogWarning("MimirKnowledge: No documents returned for query '{Query}'", query);
                return "Fann ingen informasjon om dette i dokumentasjonen. Prøv å omformulere spørsmålet ditt, eller spør meg direkte om det du lurer på.";
            }

            this._logger.LogInformation("MimirKnowledge: Returning {Count} documents for query '{Query}'", documents.Count, query);

            // Format results for the LLM
            var sb = new StringBuilder();
            sb.AppendLine($"Fann {documents.Count} relevante artiklar om Mimir:\n");

            foreach (var doc in documents)
            {
                sb.AppendLine($"=== {doc.Title} ===");
                if (!string.IsNullOrEmpty(doc.Category))
                {
                    sb.AppendLine($"[Kategori: {doc.Category}]");
                }
                sb.AppendLine();

                if (doc.Highlights?.Any() == true)
                {
                    sb.AppendLine("Relevante utdrag:");
                    foreach (var highlight in doc.Highlights)
                    {
                        sb.AppendLine($"  • {highlight}");
                    }
                    sb.AppendLine();
                }

                sb.AppendLine(doc.Content);
                sb.AppendLine($"\n=== SLUTT ===\n");
            }

            sb.AppendLine("\n---");
            sb.AppendLine("Bruk informasjonen over til å svare brukaren. Ver konkret og hjelpsam. Gi detaljerte svar basert på innhaldet.");

            return sb.ToString();
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error searching Mimir knowledge base for query '{Query}'", query);
            return $"Det oppstod ein feil ved søk i dokumentasjonen: {ex.Message}";
        }
    }

    /// <summary>
    /// Gets information about Mimir's available features and capabilities.
    /// </summary>
    [KernelFunction, Description("Hent oversikt over Mimir sine funksjonar og evner. Bruk dette når brukaren spør 'Kva kan du gjere?' eller 'Kva funksjonar har Mimir?'")]
    public async Task<string> GetMimirFeaturesAsync(CancellationToken cancellationToken = default)
    {
        this._logger.LogInformation("MimirKnowledge: Getting features overview");

        try
        {
            var searchOptions = new SearchOptions
            {
                Size = 5,
                Filter = $"{this._options.CategoryFieldName} eq 'features'"
            };

            searchOptions.Select.Add(this._options.TitleFieldName);
            searchOptions.Select.Add(this._options.ContentFieldName);

            // Configure semantic search if available
            if (!string.IsNullOrEmpty(this._options.SemanticConfigurationName))
            {
                searchOptions.QueryType = SearchQueryType.Semantic;
                searchOptions.SemanticSearch = new SemanticSearchOptions
                {
                    SemanticConfigurationName = this._options.SemanticConfigurationName
                };
            }

            var searchResults = await this._searchClient.SearchAsync<SearchDocument>("Mimir funksjonar oversikt", searchOptions, cancellationToken);

            var sb = new StringBuilder();
            sb.AppendLine("# Mimir sine funksjonar\n");

            await foreach (var result in searchResults.Value.GetResultsAsync())
            {
                var title = GetFieldValue(result.Document, this._options.TitleFieldName);
                var content = GetFieldValue(result.Document, this._options.ContentFieldName);

                if (content.Length > 3000)
                {
                    content = content.Substring(0, 3000) + "...";
                }

                sb.AppendLine($"## {title}\n");
                sb.AppendLine(content);
                sb.AppendLine();
            }

            if (sb.Length < 50)
            {
                return "Kunne ikkje hente funksjonsoversynet. Spør meg gjerne om spesifikke funksjonar du vil vite meir om.";
            }

            return sb.ToString();
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error getting Mimir features");
            return $"Det oppstod ein feil: {ex.Message}";
        }
    }

    /// <summary>
    /// Gets information about how to navigate and use Mimir's user interface.
    /// </summary>
    [KernelFunction, Description("Hent rettleiing om korleis ein brukar Mimir sitt brukargrensesnitt. Bruk dette når brukaren spør om korleis dei navigerer i Mimir, finn innstillingar, lastar opp filer, etc.")]
    public async Task<string> GetUIGuideAsync(
        [Description("Spesifikk del av grensesnittet å få hjelp med, t.d. 'dokument', 'tilpassing', 'deling', 'modelval'. La stå tom for generell oversikt.")] string? topic = null,
        CancellationToken cancellationToken = default)
    {
        this._logger.LogInformation("MimirKnowledge: Getting UI guide for topic '{Topic}'", topic ?? "general");

        try
        {
            var searchQuery = string.IsNullOrWhiteSpace(topic)
                ? "brukargrensesnitt navigering oversikt"
                : $"brukargrensesnitt {topic}";

            var searchOptions = new SearchOptions
            {
                Size = 3,
                Filter = $"{this._options.CategoryFieldName} eq 'ui'"
            };

            searchOptions.Select.Add(this._options.TitleFieldName);
            searchOptions.Select.Add(this._options.ContentFieldName);

            // Configure semantic search if available
            if (!string.IsNullOrEmpty(this._options.SemanticConfigurationName))
            {
                searchOptions.QueryType = SearchQueryType.Semantic;
                searchOptions.SemanticSearch = new SemanticSearchOptions
                {
                    SemanticConfigurationName = this._options.SemanticConfigurationName,
                    QueryCaption = new QueryCaption(QueryCaptionType.Extractive)
                };
            }

            var searchResults = await this._searchClient.SearchAsync<SearchDocument>(searchQuery, searchOptions, cancellationToken);

            var sb = new StringBuilder();
            sb.AppendLine("# Rettleiing for Mimir sitt grensesnitt\n");

            await foreach (var result in searchResults.Value.GetResultsAsync())
            {
                var title = GetFieldValue(result.Document, this._options.TitleFieldName);
                var content = GetFieldValue(result.Document, this._options.ContentFieldName);

                if (content.Length > this._options.MaxContentLength)
                {
                    content = content.Substring(0, this._options.MaxContentLength) + "...";
                }

                sb.AppendLine($"## {title}\n");
                sb.AppendLine(content);
                sb.AppendLine();
            }

            if (sb.Length < 50)
            {
                return "Kunne ikkje finne spesifikk rettleiing om dette. Prøv å spør meir konkret, t.d. 'Korleis lastar eg opp dokument?' eller 'Korleis endrar eg innstillingar?'";
            }

            return sb.ToString();
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error getting UI guide");
            return $"Det oppstod ein feil: {ex.Message}";
        }
    }

    /// <summary>
    /// Gets tips for writing effective prompts to get the best results from Mimir.
    /// </summary>
    [KernelFunction, Description("Hent tips for å skrive gode spørsmål og få betre svar frå Mimir. Bruk dette når brukaren spør om korleis dei kan formulere spørsmål betre, eller ønskjer tips for å bruke Mimir meir effektivt.")]
    public async Task<string> GetPromptingTipsAsync(CancellationToken cancellationToken = default)
    {
        this._logger.LogInformation("MimirKnowledge: Getting prompting tips");

        try
        {
            var searchOptions = new SearchOptions
            {
                Size = 3,
                Filter = $"{this._options.CategoryFieldName} eq 'prompting'"
            };

            searchOptions.Select.Add(this._options.TitleFieldName);
            searchOptions.Select.Add(this._options.ContentFieldName);

            // Configure semantic search if available
            if (!string.IsNullOrEmpty(this._options.SemanticConfigurationName))
            {
                searchOptions.QueryType = SearchQueryType.Semantic;
                searchOptions.SemanticSearch = new SemanticSearchOptions
                {
                    SemanticConfigurationName = this._options.SemanticConfigurationName
                };
            }

            var searchResults = await this._searchClient.SearchAsync<SearchDocument>("tips gode spørsmål prompt", searchOptions, cancellationToken);

            var sb = new StringBuilder();
            sb.AppendLine("# Tips for å få gode svar frå Mimir\n");

            await foreach (var result in searchResults.Value.GetResultsAsync())
            {
                var title = GetFieldValue(result.Document, this._options.TitleFieldName);
                var content = GetFieldValue(result.Document, this._options.ContentFieldName);

                if (content.Length > this._options.MaxContentLength)
                {
                    content = content.Substring(0, this._options.MaxContentLength) + "...";
                }

                sb.AppendLine($"## {title}\n");
                sb.AppendLine(content);
                sb.AppendLine();
            }

            if (sb.Length < 50)
            {
                return "Kunne ikkje hente skrivetips akkurat no. Generelt: Ver spesifikk, gi kontekst, og fortell kva du ønskjer å oppnå med svaret.";
            }

            return sb.ToString();
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error getting prompting tips");
            return $"Det oppstod ein feil: {ex.Message}";
        }
    }

    /// <summary>
    /// Gets information about Mimir's history and how it was developed.
    /// Returns the FULL history document to ensure all timeline and project details are included.
    /// </summary>
    [KernelFunction, Description("Hent informasjon om historia til Mimir - korleis systemet vart utvikla, tidslinje for prosjektet, og kva det er basert på. Bruk dette når brukaren spør 'Kva er Mimir?', 'Kven laga Mimir?', 'Korleis vart Mimir til?', 'Kva var tidslinja?', eller spørsmål om Copilot-prosjektet.")]
    public async Task<string> GetMimirHistoryAsync(CancellationToken cancellationToken = default)
    {
        this._logger.LogInformation("MimirKnowledge: Getting Mimir history (full document)");

        try
        {
            // Use wildcard search with filter to get ALL history documents (not semantic search)
            // This ensures we return the complete document with timeline details
            var searchOptions = new SearchOptions
            {
                Size = 5,
                Filter = $"{this._options.CategoryFieldName} eq 'history'",
                QueryType = SearchQueryType.Simple  // Use simple search for reliability
            };

            searchOptions.Select.Add(this._options.TitleFieldName);
            searchOptions.Select.Add(this._options.ContentFieldName);
            searchOptions.Select.Add(this._options.CategoryFieldName);

            // Use wildcard to match all documents in the category
            var searchResults = await this._searchClient.SearchAsync<SearchDocument>("*", searchOptions, cancellationToken);

            var sb = new StringBuilder();
            sb.AppendLine("# Historia til Mimir og Copilot-prosjektet\n");
            sb.AppendLine("Her er komplett informasjon om Mimir si historie, inkludert tidslinje:\n");

            var foundDocuments = false;
            await foreach (var result in searchResults.Value.GetResultsAsync())
            {
                foundDocuments = true;
                var title = GetFieldValue(result.Document, this._options.TitleFieldName);
                var content = GetFieldValue(result.Document, this._options.ContentFieldName);

                this._logger.LogInformation("MimirKnowledge: Found history document '{Title}' with {Length} characters", title, content.Length);

                // For history, we want the FULL content - don't truncate
                // The history document contains important timeline details throughout
                sb.AppendLine($"## {title}\n");
                sb.AppendLine(content);
                sb.AppendLine();
            }

            if (!foundDocuments)
            {
                this._logger.LogWarning("MimirKnowledge: No history documents found in index");
                return "Kunne ikkje hente historieinformasjon akkurat no. Indeksen kan vere under oppdatering.";
            }

            return sb.ToString();
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error getting Mimir history");
            return $"Det oppstod ein feil ved henting av historikk: {ex.Message}";
        }
    }

    /// <summary>
    /// Lists available knowledge categories about Mimir.
    /// </summary>
    [KernelFunction, Description("List tilgjengelege kategoriar av dokumentasjon om Mimir.")]
    public Task<string> ListKnowledgeCategoriesAsync()
    {
        var categories = new StringBuilder();
        categories.AppendLine("# Dokumentasjon om Mimir\n");
        categories.AppendLine("Du kan spørje meg om følgjande emne:\n");
        categories.AppendLine("- **Brukargrensesnitt (ui)**: Korleis navigere og bruke Mimir sitt grensesnitt");
        categories.AppendLine("- **Funksjonar (features)**: Kva Mimir kan gjere - modellar, filgenerering, diagram, etc.");
        categories.AppendLine("- **Historie (history)**: Korleis Mimir vart utvikla og kva det er basert på");
        categories.AppendLine("- **Skrivetips (prompting)**: Korleis skrive gode spørsmål for å få betre svar");
        categories.AppendLine("- **Feilsøking (troubleshooting)**: Løysingar på vanlege problem");
        categories.AppendLine("- **KI-policy (policy)**: Retningslinjer for bruk av KI, datahandtering og personvern");
        categories.AppendLine("- **Vestland fylkeskommune (info)**: Informasjon om leiing, kontor, tenester og KI-kurs");
        categories.AppendLine("- **Spørsmål og svar (faq)**: Ofte stilte spørsmål om Mimir, personvern og bruk");
        categories.AppendLine("- **Strategi (strategi)**: Organisasjonsstrategi, ambisjonar og prinsipp for VLFK");
        categories.AppendLine();
        categories.AppendLine("Spør meg gjerne om noko spesifikt!");

        return Task.FromResult(categories.ToString());
    }

    /// <summary>
    /// Lists all documents available in the Mimir knowledge base.
    /// Use this when users ask what documents are available or what you have access to.
    /// </summary>
    [KernelFunction, Description("List alle dokument i Mimir sin kunnskapsbase. Bruk dette når brukaren spør kva dokument du har tilgang til, kva som finst i kunnskapsbasen, eller kva informasjon du kan hente om deg sjølv.")]
    public async Task<string> ListAllDocumentsAsync(CancellationToken cancellationToken = default)
    {
        this._logger.LogInformation("MimirKnowledge: Listing all documents in knowledge base");

        try
        {
            var searchOptions = new SearchOptions
            {
                Size = 20, // Get all documents
                QueryType = SearchQueryType.Simple
            };

            searchOptions.Select.Add(this._options.TitleFieldName);
            searchOptions.Select.Add(this._options.CategoryFieldName);
            searchOptions.Select.Add(this._options.SourceFieldName);

            // Use wildcard to get all documents
            var searchResults = await this._searchClient.SearchAsync<SearchDocument>("*", searchOptions, cancellationToken);

            var sb = new StringBuilder();
            sb.AppendLine("# Dokument i Mimir sin kunnskapsbase\n");
            sb.AppendLine("Her er alle dokumenta eg har tilgang til om meg sjølv:\n");

            var documentsByCategory = new Dictionary<string, List<string>>();

            await foreach (var result in searchResults.Value.GetResultsAsync())
            {
                var title = GetFieldValue(result.Document, this._options.TitleFieldName);
                var category = GetFieldValue(result.Document, this._options.CategoryFieldName);

                if (!documentsByCategory.ContainsKey(category))
                {
                    documentsByCategory[category] = new List<string>();
                }
                documentsByCategory[category].Add(title);
            }

            if (documentsByCategory.Count == 0)
            {
                return "Kunne ikkje finne nokon dokument i kunnskapsbasen. Indeksen kan vere tom eller under oppdatering.";
            }

            // Category display names
            var categoryNames = new Dictionary<string, string>
            {
                { "ui", "🖥️ Brukargrensesnitt" },
                { "features", "⚡ Funksjonar og evner" },
                { "history", "📜 Historie og bakgrunn" },
                { "prompting", "💡 Tips for gode spørsmål" },
                { "policy", "📋 KI-policy og retningslinjer" },
                { "troubleshooting", "🔧 Feilsøking" },
                { "info", "🏛️ Vestland fylkeskommune" },
                { "faq", "❓ Spørsmål og svar" },
                { "strategi", "📊 Strategi og organisasjonsutvikling" }
            };

            foreach (var kvp in documentsByCategory.OrderBy(k => k.Key))
            {
                var displayName = categoryNames.TryGetValue(kvp.Key, out var name) ? name : kvp.Key;
                sb.AppendLine($"## {displayName}\n");
                foreach (var doc in kvp.Value)
                {
                    sb.AppendLine($"- {doc}");
                }
                sb.AppendLine();
            }

            sb.AppendLine("---");
            sb.AppendLine($"**Totalt:** {documentsByCategory.Values.Sum(v => v.Count)} dokument");
            sb.AppendLine("\nDu kan spørje meg om innhaldet i kvart av desse dokumenta!");

            this._logger.LogInformation("MimirKnowledge: Found {Count} documents in {Categories} categories",
                documentsByCategory.Values.Sum(v => v.Count), documentsByCategory.Count);

            return sb.ToString();
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error listing documents in Mimir knowledge base");
            return $"Det oppstod ein feil ved henting av dokumentliste: {ex.Message}";
        }
    }

    /// <summary>
    /// Gets information about AI/KI policy and guidelines for Vestland fylkeskommune.
    /// </summary>
    [KernelFunction, Description("Hent informasjon om KI-policy, retningslinjer og kva data du kan bruke i KI-tenester. Bruk dette når brukaren spør om kva dei kan og ikkje kan bruke KI til, kva data som er lov å leggje inn, eller retningslinjer for KI-bruk i Vestland fylkeskommune.")]
    public async Task<string> GetAIPolicyAsync(CancellationToken cancellationToken = default)
    {
        this._logger.LogInformation("MimirKnowledge: Getting AI policy information");

        try
        {
            var searchOptions = new SearchOptions
            {
                Size = 3,
                Filter = $"{this._options.CategoryFieldName} eq 'policy'"
            };

            searchOptions.Select.Add(this._options.TitleFieldName);
            searchOptions.Select.Add(this._options.ContentFieldName);

            // Configure semantic search if available
            if (!string.IsNullOrEmpty(this._options.SemanticConfigurationName))
            {
                searchOptions.QueryType = SearchQueryType.Semantic;
                searchOptions.SemanticSearch = new SemanticSearchOptions
                {
                    SemanticConfigurationName = this._options.SemanticConfigurationName
                };
            }

            var searchResults = await this._searchClient.SearchAsync<SearchDocument>("KI policy retningslinjer databruk", searchOptions, cancellationToken);

            var sb = new StringBuilder();
            sb.AppendLine("# KI-policy og retningslinjer\n");

            await foreach (var result in searchResults.Value.GetResultsAsync())
            {
                var title = GetFieldValue(result.Document, this._options.TitleFieldName);
                var content = GetFieldValue(result.Document, this._options.ContentFieldName);

                if (content.Length > this._options.MaxContentLength)
                {
                    content = content.Substring(0, this._options.MaxContentLength) + "...";
                }

                sb.AppendLine($"## {title}\n");
                sb.AppendLine(content);
                sb.AppendLine();
            }

            if (sb.Length < 50)
            {
                return "Kunne ikkje hente KI-policy akkurat no. Generelt: Bruk berre opne data i eksterne KI-tenester, og unngå personopplysningar.";
            }

            return sb.ToString();
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error getting AI policy");
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

    private sealed class DocumentResult
    {
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Source { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public double Score { get; set; }
        public List<string>? Highlights { get; set; }
    }
}
