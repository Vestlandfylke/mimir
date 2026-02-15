// Copyright (c) Microsoft. All rights reserved.

using System.ComponentModel;
using System.Text;
using CopilotChat.WebApi.Extensions;
using CopilotChat.WebApi.Models.Storage;
using CopilotChat.WebApi.Options;
using CopilotChat.WebApi.Plugins.Utils;
using CopilotChat.WebApi.Services;
using CopilotChat.WebApi.Storage;
using Microsoft.Extensions.Options;
using Microsoft.KernelMemory;

namespace CopilotChat.WebApi.Plugins.Chat;

/// <summary>
/// This class provides the functions to query kernel memory.
/// </summary>
internal sealed class KernelMemoryRetriever
{
    private readonly PromptsOptions _promptOptions;

    private readonly ChatSessionRepository _chatSessionRepository;

    private readonly ChatMemorySourceRepository _sourceRepository;

    private readonly IKernelMemory _memoryClient;

    private readonly List<string> _memoryNames;

    /// <summary>
    /// PII sanitization service for masking sensitive data in retrieved document content.
    /// </summary>
    private readonly PiiSanitizationService? _piiSanitizationService;

    /// <summary>
    /// High level logger.
    /// </summary>
    private readonly ILogger _logger;

    /// <summary>
    /// Create a new instance of KernelMemoryRetriever.
    /// </summary>
    public KernelMemoryRetriever(
        IOptions<PromptsOptions> promptOptions,
        ChatSessionRepository chatSessionRepository,
        ChatMemorySourceRepository sourceRepository,
        IKernelMemory memoryClient,
        ILogger logger,
        PiiSanitizationService? piiSanitizationService = null)
    {
        this._promptOptions = promptOptions.Value;
        this._chatSessionRepository = chatSessionRepository;
        this._sourceRepository = sourceRepository;
        this._memoryClient = memoryClient;
        this._logger = logger;
        this._piiSanitizationService = piiSanitizationService;

        // NOTE: LongTermMemory and WorkingMemory have been removed from the search.
        // These were a workaround for GPT-3.5's 4K context window, where conversation had to be
        // compressed into memory snippets. With GPT-5.2's 128K context, raw chat history
        // provides better context than extracted memory fragments.
        // Only DocumentMemory (user-uploaded + global documents) is searched.
        this._memoryNames = new List<string>
        {
            this._promptOptions.DocumentMemoryName
        };
    }

    /// <summary>
    /// Query relevant memories based on the query.
    /// </summary>
    /// <returns>A string containing the relevant memories.</returns>
    public async Task<(string, IDictionary<string, CitationSource>)> QueryMemoriesAsync(
        [Description("Query to match.")] string query,
        [Description("Chat ID to query history from")]
        string chatId,
        [Description("Maximum number of tokens")]
        int tokenLimit)
    {
        ChatSession? chatSession = null;
        if (!await this._chatSessionRepository.TryFindByIdAsync(chatId, callback: v => chatSession = v))
        {
            throw new ArgumentException($"Chat session {chatId} not found.");
        }

        var remainingToken = tokenLimit;

        // Search for relevant document memories only.
        // LongTermMemory and WorkingMemory searches have been removed — GPT-5.2's 128K context
        // handles conversation context directly via chat history inclusion.
        // Combined filter: (per-chat documents) OR (global documents) in a single embedding call.
        float docThreshold = this._promptOptions.DocumentMemoryMinRelevance;

        var filters = new List<MemoryFilter>
        {
            new MemoryFilter()
                .ByTag(MemoryTags.TagChatId, chatId)
                .ByTag(MemoryTags.TagMemory, this._promptOptions.DocumentMemoryName),
            new MemoryFilter()
                .ByTag(MemoryTags.TagChatId, DocumentMemoryOptions.GlobalDocumentChatId.ToString())
                .ByTag(MemoryTags.TagMemory, this._promptOptions.DocumentMemoryName)
        };

        var searchResult = await this._memoryClient.SearchAsync(
            query,
            this._promptOptions.MemoryIndexName,
            filter: null,
            filters: filters,
            minRelevance: docThreshold,
            limit: -1);

        List<(Citation Citation, Citation.Partition Memory)> relevantMemories = new();
        foreach (var citation in searchResult.Results)
        {
            foreach (var partition in citation.Partitions)
            {
                relevantMemories.Add((citation, partition));
            }
        }

        // ALWAYS include pinned documents (regardless of relevance search)
        await AddPinnedDocumentsAsync();

        var builderMemory = new StringBuilder();
        IDictionary<string, CitationSource> citationMap = new Dictionary<string, CitationSource>(StringComparer.OrdinalIgnoreCase);

        if (relevantMemories.Count > 0)
        {
            (var memoryMap, citationMap) = ProcessMemories();
            FormatMemories();
            FormatSnippets();

            // <summary>
            // Format long term and working memories.
            // </summary>
            void FormatMemories()
            {
                foreach (var memoryName in this._promptOptions.MemoryMap.Keys)
                {
                    if (memoryMap.TryGetValue(memoryName, out var memories))
                    {
                        foreach ((var memoryContent, _) in memories)
                        {
                            if (builderMemory.Length == 0)
                            {
                                builderMemory.Append("Past memories (format: [memory type] <label>: <details>):\n");
                            }

                            var memoryText = $"[{memoryName}] {memoryContent}\n";
                            builderMemory.Append(memoryText);
                        }
                    }
                }
            }

            // <summary>
            // Format document snippets.
            // </summary>
            void FormatSnippets()
            {
                if (!memoryMap.TryGetValue(this._promptOptions.DocumentMemoryName, out var memories) || memories.Count == 0)
                {
                    return;
                }

                builderMemory.Append(
                    "User has also shared some document snippets.\n" +
                    "Quote the document link in square brackets at the end of each sentence that refers to the snippet in your response.\n");

                foreach ((var memoryContent, var citation) in memories)
                {
                    var memoryText = $"Document name: {citation.SourceName}\nDocument link: {citation.Link}.\n[CONTENT START]\n{memoryContent}\n[CONTENT END]\n";
                    builderMemory.Append(memoryText);
                }
            }
        }

        return (builderMemory.Length == 0 ? string.Empty : builderMemory.ToString(), citationMap);

        // <summary>
        // Add pinned documents to relevant memories (always included regardless of search relevance).
        // OPTIMIZATION: Searches ONCE for all pinned documents instead of per-document,
        // saving (N-1) embedding generations for N pinned documents.
        // </summary>
        async Task AddPinnedDocumentsAsync()
        {
            try
            {
                // Get all memory sources for this chat
                var memorySources = await this._sourceRepository.FindByChatIdAsync(chatId);

                // Filter to only pinned documents
                var pinnedDocs = memorySources.Where(s => s.IsPinned).ToList();

                if (!pinnedDocs.Any())
                {
                    return; // No pinned documents
                }

                this._logger.LogInformation("Including {Count} pinned document(s) in context for chat {ChatId}",
                    pinnedDocs.Count, chatId);

                // Build a set of pinned document IDs for fast lookup
                var pinnedDocIds = new HashSet<string>(pinnedDocs.Select(d => d.Id), StringComparer.OrdinalIgnoreCase);

                // Search ONCE for all DocumentMemory results in this chat
                var pinnedSearchResult = await this._memoryClient.SearchMemoryAsync(
                    this._promptOptions.MemoryIndexName,
                    query,
                    this._promptOptions.DocumentMemoryMinRelevance,
                    chatId,
                    this._promptOptions.DocumentMemoryName);

                // Filter results to only include partitions from pinned documents
                foreach (var memory in pinnedSearchResult.Results)
                {
                    foreach (var partition in memory.Partitions)
                    {
                        // Check if this partition belongs to a pinned document
                        bool isPinned = partition.Tags.Any(t =>
                            t.Key == "__document_id" && t.Value.Any(v => pinnedDocIds.Contains(v)));

                        if (isPinned)
                        {
                            // Avoid adding duplicates (partition may already be in relevantMemories from main search)
                            if (!relevantMemories.Any(rm => rm.Memory.Text == partition.Text))
                            {
                                relevantMemories.Add((Citation: memory, Memory: partition));

                                int tokenCount = TokenUtils.TokenCount(partition.Text);
                                remainingToken -= tokenCount;

                                if (remainingToken <= 0)
                                {
                                    this._logger.LogWarning(
                                        "Pinned documents exceeded token budget. Some pinned content may be excluded.");
                                    return;
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                this._logger.LogError(ex, "Error retrieving pinned documents for chat {ChatId}", chatId);
            }
        }

        // <summary>
        // Process the relevant memories and return a map of memories with citations for each memory name.
        // </summary>
        // <returns>A map of memories for each memory name and a map of citations for documents.</returns>
        (IDictionary<string, List<(string, CitationSource)>>, IDictionary<string, CitationSource>) ProcessMemories()
        {
            var memoryMap = new Dictionary<string, List<(string, CitationSource)>>(StringComparer.OrdinalIgnoreCase);
            var citationMap = new Dictionary<string, CitationSource>(StringComparer.OrdinalIgnoreCase);

            foreach (var result in relevantMemories.OrderByDescending(m => m.Memory.Relevance))
            {
                // Sanitize PII from retrieved document/memory content before it reaches the AI model.
                var memoryText = result.Memory.Text;
                if (this._piiSanitizationService != null)
                {
                    var sanitizeResult = this._piiSanitizationService.Sanitize(memoryText);
                    if (sanitizeResult.ContainsPii)
                    {
                        memoryText = sanitizeResult.SanitizedText;
                        this._logger.LogWarning(
                            "PII detected and masked in retrieved memory content from source '{Source}'. Types: {PiiTypes}",
                            result.Citation.SourceName,
                            string.Join(", ", sanitizeResult.Warnings));
                    }
                }

                var tokenCount = TokenUtils.TokenCount(memoryText);
                if (remainingToken - tokenCount > 0)
                {
                    if (result.Memory.Tags.TryGetValue(MemoryTags.TagMemory, out var tag) && tag.Count > 0)
                    {
                        var memoryName = tag.Single()!;
                        var citationSource = CitationSource.FromKernelMemoryCitation(
                            result.Citation,
                            memoryText,
                            result.Memory.Relevance
                        );

                        if (this._memoryNames.Contains(memoryName))
                        {
                            if (!memoryMap.TryGetValue(memoryName, out var memories))
                            {
                                memories = new List<(string, CitationSource)>();
                                memoryMap.Add(memoryName, memories);
                            }

                            memories.Add((memoryText, citationSource));
                            remainingToken -= tokenCount;
                        }

                        // Only documents will have citations.
                        if (memoryName == this._promptOptions.DocumentMemoryName)
                        {
                            citationMap.TryAdd(result.Citation.Link, citationSource);
                        }
                    }
                }
                else
                {
                    break;
                }
            }

            return (memoryMap, citationMap);
        }
    }

    #region Private

    /// <summary>
    /// Calculates the relevance threshold for the memory.
    /// The relevance threshold is a function of the memory balance.
    /// The memory balance is a value between 0 and 1, where 0 means maximum focus on
    /// working term memory (by minimizing the relevance threshold for working memory
    /// and maximizing the relevance threshold for long term memory), and 1 means
    /// maximum focus on long term memory (by minimizing the relevance threshold for
    /// long term memory and maximizing the relevance threshold for working memory).
    /// The memory balance controls two 1st degree polynomials defined by the lower
    /// and upper bounds, one for long term memory and one for working memory.
    /// The relevance threshold is the value of the polynomial at the memory balance.
    /// </summary>
    /// <param name="memoryName">The name of the memory.</param>
    /// <param name="memoryBalance">The balance between long term memory and working term memory.</param>
    /// <returns></returns>
    /// <exception cref="ArgumentException">Thrown when the memory name is invalid.</exception>
    private float CalculateRelevanceThreshold(string memoryName, float memoryBalance)
    {
        var upper = this._promptOptions.KernelMemoryRelevanceUpper;
        var lower = this._promptOptions.KernelMemoryRelevanceLower;

        if (memoryBalance < 0.0 || memoryBalance > 1.0)
        {
            throw new ArgumentException($"Invalid memory balance: {memoryBalance}");
        }

        if (memoryName == this._promptOptions.LongTermMemoryName)
        {
            return (lower - upper) * memoryBalance + upper;
        }
        else if (memoryName == this._promptOptions.WorkingMemoryName)
        {
            return (upper - lower) * memoryBalance + lower;
        }
        else if (memoryName == this._promptOptions.DocumentMemoryName)
        {
            return this._promptOptions.DocumentMemoryMinRelevance;
        }
        else
        {
            throw new ArgumentException($"Invalid memory name: {memoryName}");
        }
    }

    # endregion
}
