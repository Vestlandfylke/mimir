// Copyright (c) Microsoft. All rights reserved.

namespace CopilotChat.WebApi.Services;

/// <summary>
/// Service that analyzes user messages and provides hints about which plugins should be used.
/// This helps the LLM make better decisions about when to use tools proactively.
/// 
/// NOTE: This service only provides hints for GLOBALLY available plugins.
/// Template-specific plugins (SharePoint, Lovdata) are handled by template-specific system prompts.
/// </summary>
public sealed class PluginHintService
{
    private readonly ILogger<PluginHintService> _logger;

    // Keywords that should trigger Mimir Knowledge plugin (GLOBAL - available to all users)
    private static readonly string[] MimirKeywords = new[]
    {
        // Direct mentions
        "mimir", "chatbot", "assistenten", "ki-assistent", "kunnskapsbase", "kunnskapsbasen",
        // Questions about self
        "kva er du", "kven er du", "fortel om deg", "om deg sjølv", "kva veit du om deg",
        // What can you do / capabilities
        "kva kan du", "kva kan eg", "kva du kan", "tilgang til", "har du tilgang",
        // History/development
        "historia", "historie", "tidslinje", "tidslinja", "prosjekt", "copilot", "utvikl",
        "korleis vart", "korleis blei", "oppstart", "bakgrunn",
        // Features
        "funksjon", "evne", "moglegheit", "dokument du har",
        // UI
        "grensesnitt", "brukargrensesnitt", "knapp", "meny", "innstilling",
        "korleis brukar", "korleis gjer", "korleis finn", "kor finn",
        // Policy
        "ki-policy", "policy", "retningslinje", "personvern", "kva er lov", "lov å bruke",
        "kan eg bruke", "trygt å", "sensitive",
        // Tips
        "betre svar", "gode spørsmål", "prompt", "tips",
        // Troubleshooting
        "virkar ikkje", "feil", "problem", "bug"
    };

    // NOTE: SharePoint and Lovdata plugins are ONLY available in the leader template.
    // Hints for those plugins are NOT generated here - they are handled by the 
    // leader template's specific system prompt in appsettings.json.

    public PluginHintService(ILogger<PluginHintService> logger)
    {
        this._logger = logger;
    }

    /// <summary>
    /// Analyzes the user message and returns hints about which GLOBAL plugins should be used.
    /// Only hints for globally available plugins (MimirKnowledge) are generated.
    /// Template-specific plugins (SharePoint, Lovdata) are handled by their template's system prompt.
    /// </summary>
    /// <param name="userMessage">The user's message</param>
    /// <returns>A hint string to prepend to context, or null if no hint needed</returns>
    public string? GetPluginHint(string userMessage)
    {
        if (string.IsNullOrWhiteSpace(userMessage))
        {
            return null;
        }

        var lowerMessage = userMessage.ToLowerInvariant();

        // Check for Mimir Knowledge triggers (GLOBAL plugin - available to all)
        var mimirScore = CountKeywordMatches(lowerMessage, MimirKeywords);
        if (mimirScore > 0)
        {
            this._logger.LogDebug("PluginHint: Detected Mimir-related query (score: {Score})", mimirScore);
            
            // Determine which specific function to recommend
            var function = DetermineMimirFunction(lowerMessage);
            var hint = $"[VERKTØY-HINT: Dette spørsmålet handlar om Mimir. BRUK {function} for å hente korrekt informasjon FØR du svarar.]";
            
            this._logger.LogInformation("PluginHint: Generated hint for query: {Hint}", hint);
            return hint;
        }

        return null;
    }

    /// <summary>
    /// Determines which Mimir Knowledge function is most appropriate for the query.
    /// </summary>
    private static string DetermineMimirFunction(string lowerMessage)
    {
        // List documents / what's available
        if (ContainsAny(lowerMessage, "dokument", "kunnskapsbase", "tilgang til", "har du tilgang", "kva har du", "kva finst", "kva veit du"))
        {
            return "ListAllDocumentsAsync";
        }

        // History/Timeline
        if (ContainsAny(lowerMessage, "histori", "tidslinje", "tidslinja", "prosjekt", "copilot", "utvikl", "oppstart", "bakgrunn", "korleis vart", "korleis blei"))
        {
            return "GetMimirHistoryAsync";
        }

        // Features
        if (ContainsAny(lowerMessage, "funksjon", "evne", "kva kan du", "kva kan eg gjere"))
        {
            return "GetMimirFeaturesAsync";
        }

        // UI
        if (ContainsAny(lowerMessage, "grensesnitt", "brukargrensesnitt", "knapp", "meny", "innstilling", "korleis brukar", "korleis gjer", "korleis finn", "kor finn"))
        {
            return "GetUIGuideAsync";
        }

        // Policy
        if (ContainsAny(lowerMessage, "policy", "retningslinje", "personvern", "kva er lov", "lov å bruke", "kan eg bruke", "trygt", "sensitive"))
        {
            return "GetAIPolicyAsync";
        }

        // Tips
        if (ContainsAny(lowerMessage, "betre svar", "gode spørsmål", "prompt", "tips"))
        {
            return "GetPromptingTipsAsync";
        }

        // Default to search
        return "SearchMimirKnowledgeAsync";
    }

    private static int CountKeywordMatches(string text, string[] keywords)
    {
        int count = 0;
        foreach (var keyword in keywords)
        {
            if (text.Contains(keyword, StringComparison.OrdinalIgnoreCase))
            {
                count++;
            }
        }
        return count;
    }

    private static bool ContainsAny(string text, params string[] keywords)
    {
        return keywords.Any(k => text.Contains(k, StringComparison.OrdinalIgnoreCase));
    }
}
