// Copyright (c) Microsoft. All rights reserved.

namespace CopilotChat.WebApi.Options;

/// <summary>
/// Configuration options for the Mimir Knowledge plugin.
/// Provides self-knowledge about Mimir - its history, features, UI, and best practices.
/// Uses Azure AI Search for semantic search over indexed documentation.
/// This plugin is registered globally for all chat templates.
/// </summary>
public sealed class MimirKnowledgePluginOptions
{
    public const string PropertyName = "MimirKnowledge";

    /// <summary>
    /// Whether the Mimir Knowledge plugin is enabled.
    /// </summary>
    public bool Enabled { get; set; } = false;

    /// <summary>
    /// The Azure AI Search service endpoint.
    /// Example: https://your-search-service.search.windows.net
    /// </summary>
    public string? Endpoint { get; set; }

    /// <summary>
    /// The Azure AI Search API key.
    /// Should be set via user-secrets: dotnet user-secrets set "MimirKnowledge:ApiKey" "YOUR_KEY"
    /// </summary>
    public string? ApiKey { get; set; }

    /// <summary>
    /// The name of the search index containing the Mimir documentation.
    /// </summary>
    public string IndexName { get; set; } = "mimir-knowledge";

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
    /// Default: 15000 characters (~3,750 tokens)
    /// </summary>
    public int MaxContentLength { get; set; } = 15000;

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
    /// The field name in the search index that contains the category.
    /// Categories: "ui", "history", "features", "prompting", "troubleshooting"
    /// </summary>
    public string CategoryFieldName { get; set; } = "category";

    /// <summary>
    /// The field name for the vector embedding (if using vector search).
    /// </summary>
    public string? VectorFieldName { get; set; }

    /// <summary>
    /// Categories or document types available in the knowledge base.
    /// </summary>
    public List<string>? Categories { get; set; } = new()
    {
        "ui",           // UI navigation and features
        "history",      // How Mimir came to be
        "features",     // Feature documentation
        "prompting",    // Best practices for prompting
        "troubleshooting", // Common issues and solutions
        "policy"        // AI policy, guidelines, and data handling
    };

    /// <summary>
    /// Whether to require user approval before executing search operations.
    /// Default: false (searches happen automatically when user asks about Mimir).
    /// </summary>
    public bool RequireApproval { get; set; } = false;

    /// <summary>
    /// The plugin name used when registering with Semantic Kernel.
    /// </summary>
    public const string PluginName = "mimirKnowledge";

    /// <summary>
    /// Validates that all required configuration is present.
    /// </summary>
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(Endpoint) &&
        !string.IsNullOrWhiteSpace(ApiKey) &&
        !string.IsNullOrWhiteSpace(IndexName);
}
