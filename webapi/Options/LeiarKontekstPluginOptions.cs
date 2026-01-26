// Copyright (c) Microsoft. All rights reserved.

namespace CopilotChat.WebApi.Options;

/// <summary>
/// Configuration options for the Leiar Kontekst plugin.
/// Provides strategic documents and organizational context specifically for the Leader assistant.
/// Uses Azure AI Search for semantic search over pre-indexed documents.
/// </summary>
public class LeiarKontekstPluginOptions
{
    public const string PropertyName = "LeiarKontekst";

    /// <summary>
    /// Whether the Leiar Kontekst plugin is enabled.
    /// </summary>
    public bool Enabled { get; set; } = false;

    /// <summary>
    /// The Azure AI Search service endpoint.
    /// Example: https://your-search-service.search.windows.net
    /// </summary>
    public string? Endpoint { get; set; }

    /// <summary>
    /// The Azure AI Search API key.
    /// Should be set via user-secrets: dotnet user-secrets set "LeiarKontekst:ApiKey" "YOUR_KEY"
    /// </summary>
    public string? ApiKey { get; set; }

    /// <summary>
    /// The name of the search index containing the strategic documents.
    /// </summary>
    public string IndexName { get; set; } = "leiar-dokumenter";

    /// <summary>
    /// The name of the semantic configuration to use for semantic search.
    /// If not set, regular vector/keyword search will be used.
    /// </summary>
    public string? SemanticConfigurationName { get; set; }

    /// <summary>
    /// Maximum number of search results to return per query.
    /// </summary>
    public int MaxResults { get; set; } = 5;

    /// <summary>
    /// Maximum content length (in characters) to return from each document.
    /// Helps prevent token limit issues with large documents.
    /// Default: 30000 characters (~7,500 tokens)
    /// </summary>
    public int MaxContentLength { get; set; } = 30000;

    /// <summary>
    /// The field name in the search index that contains the document content.
    /// </summary>
    public string ContentFieldName { get; set; } = "content";

    /// <summary>
    /// The field name in the search index that contains the document title.
    /// </summary>
    public string TitleFieldName { get; set; } = "title";

    /// <summary>
    /// The field name in the search index that contains the document source/URL.
    /// </summary>
    public string SourceFieldName { get; set; } = "source";

    /// <summary>
    /// The field name for the vector embedding (if using vector search).
    /// </summary>
    public string? VectorFieldName { get; set; }

    /// <summary>
    /// Categories or document types to include in search.
    /// If empty, all documents in the index will be searchable.
    /// Example: ["strategi", "retningslinjer", "policy"]
    /// </summary>
    public List<string>? Categories { get; set; }

    /// <summary>
    /// Whether to require user approval before executing LeiarKontekst operations.
    /// When true, the system will show a plan with the proposed operations and wait for user approval.
    /// Default: true (operations require approval to show users what documents are being searched).
    /// </summary>
    public bool RequireApproval { get; set; } = true;

    /// <summary>
    /// The plugin name used when registering with Semantic Kernel.
    /// </summary>
    public const string PluginName = "leiarKontekst";

    /// <summary>
    /// Validates that all required configuration is present.
    /// </summary>
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Endpoint) &&
        !string.IsNullOrWhiteSpace(ApiKey) &&
        !string.IsNullOrWhiteSpace(IndexName);
}
