// Copyright (c) Microsoft. All rights reserved.

namespace CopilotChat.WebApi.Services;

/// <summary>
/// Service that analyzes user messages and provides hints about which plugins should be used.
/// This helps the LLM make better decisions about when to use tools proactively.
/// 
/// Supports both global plugins (MimirKnowledge) and template-specific plugins (LeiarKontekst).
/// </summary>
public sealed class PluginHintService
{
    private readonly ILogger<PluginHintService> _logger;

    // Keywords that should trigger Mimir Knowledge plugin (GLOBAL - available to all users)
    private static readonly string[] MimirKeywords = new[]
    {
        // Direct mentions
        "mimir", "chatbot", "assistenten", "ki-assistent",
        // Questions about self
        "kva er du", "kven er du", "fortel om deg", "om deg sjølv", "kva veit du om deg",
        // What can you do / capabilities
        "kva kan du", "kva du kan",
        // History/development
        "historia", "historie", "tidslinje", "tidslinja", "copilot", "utvikl",
        "korleis vart", "korleis blei", "oppstart", "bakgrunn",
        // Features
        "funksjon", "evne", "moglegheit", "dokument du har",
        // UI
        "grensesnitt", "brukargrensesnitt", "knapp", "meny", "innstilling",
        // Policy
        "ki-policy", "personvern", "kva er lov", "lov å bruke",
        "kan eg bruke", "trygt å", "sensitive",
        // Tips
        "betre svar", "gode spørsmål", "prompt", "tips",
        // Troubleshooting
        "virkar ikkje", "feil", "problem", "bug",
        // Vestland fylkeskommune info
        "fylkeskommune", "vestland", "fylkesdirektør", "direktør",
        "besøksadresse", "postadresse", "opningstid", "kontor",
        "tenester", "tannhelse", "fylkesveg", "kollektivtransport",
        // FAQ and comparison
        "botolf", "chatgpt", "forskjell", "lagring", "data lagra",
        // KI courses
        "ki-kurs", "kurs i ki", "skriv klart", "klarare med ki",
        // Strategy and organizational
        "organisasjonsstrategi", "ambisjon", "prinsipp", "verdiar",
        "samfunnsoppdrag", "visjon", "nyskapande", "berekraftig",
        "kompetent open modig", "læringskultur", "mangfald", "tillit"
    };

    // Keywords that should trigger LeiarKontekst plugin (ONLY for leader template)
    // These are leadership/HR/organizational topics covered by the knowledge base
    private static readonly string[] LeiarKontekstKeywords = new[]
    {
        // HR and Personnel
        "hr", "personal", "tilsett", "rekruttering", "tilsetting", "oppseiing", "permisjon",
        "sjukemelding", "sjukefråvær", "fråvær", "åtvaring", "advarsel",
        // Policies and Guidelines
        "retningslinje", "reglement", "arbeidsreglement", "rutine", "prosedyre",
        // Tariff and Salary
        "tariff", "hovudtariffavtalen", "hta", "lønn", "stillingskode", "lønnsforhandling",
        // Employee Conversations
        "medarbeidarsamtale", "medarbeidarsamtalen", "samtalemal", "støttedokument",
        // Strategy
        "strategi", "organisasjonsstrategi", "kompetansestrategi", "digitalstrategi",
        "kompetanseplan", "kompetanseutvikling",
        // Ethics and Compliance
        "etisk", "etiske retningslinjer", "integritet", "gåver", "gåve", "korrupsjon",
        // Work Environment
        "arbeidsmiljø", "hms", "konflikt", "konflikthåndtering", "konflikthandtering",
        "varsling", "varslingsrutine", "varslar",
        // Work Arrangements
        "heimekontor", "fjernarbeid", "heimekontorordning",
        // Equality and Diversity
        "likestilling", "mangfald", "diskriminering",
        // Communication
        "kommunikasjonsstrategi", "språkprofil", "klarspråk", "nynorsk", "språkbruk",
        "innhaldsstrategi", "rettleiar",
        // Projects and Portfolio
        "portefølje", "porteføljekontor", "porteføljekontoret", "prosjektinnmelding",
        "prosjektstyring", "porteføljestyring", "innmelding", "pmo",
        "forbetringsforslag", "forbetring", "systemeigar", "systemforvaltar",
        "gevinst", "gevinstar", "gevinstrealisering", "gevinstplan", "gevinstansvarleg",
        "interessent", "interessentar", "finansiering", "prosjektportal",
        // Political Cases and Document Handling
        "politisk sak", "sakshandsaming", "saksdokument", "saksframlegg",
        "vedtak", "vedtakstekst", "tilråding", "elements", "arkiv",
        // Organizational
        "organisasjon", "avdeling", "seksjon", "stillingsomtale",
        // Trust Reform and Leadership
        "tillit", "tillitsreform", "tillitsreformen", "tillitsbasert", "tillitsarbeid",
        "selvleiing", "selvledelse", "autonomi", "medarbeidarskap",
        // Training and Courses
        "kurs", "opplæring", "e-læring",
        // Specific document triggers
        "handbok", "overordna plan", "handlingsplan"
    };

    public PluginHintService(ILogger<PluginHintService> logger)
    {
        this._logger = logger;
    }

    /// <summary>
    /// Analyzes the user message and returns hints about which plugins should be used.
    /// Supports both global plugins (MimirKnowledge) and template-specific plugins (LeiarKontekst).
    /// </summary>
    /// <param name="userMessage">The user's message</param>
    /// <param name="template">Optional chat template (e.g., "leader") for template-specific hints</param>
    /// <returns>A hint string to prepend to context, or null if no hint needed</returns>
    public string? GetPluginHint(string userMessage, string? template = null)
    {
        if (string.IsNullOrWhiteSpace(userMessage))
        {
            return null;
        }

        var lowerMessage = userMessage.ToLowerInvariant();
        var hints = new List<string>();

        // Check for LeiarKontekst triggers (ONLY for leader template)
        if (string.Equals(template, "leader", StringComparison.OrdinalIgnoreCase))
        {
            var leiarScore = CountKeywordMatches(lowerMessage, LeiarKontekstKeywords);
            if (leiarScore > 0)
            {
                this._logger.LogDebug("PluginHint: Detected LeiarKontekst-related query (score: {Score})", leiarScore);

                var leiarHint = "[VERKTØY-HINT: Dette spørsmålet kan handla om leiar-relaterte emne. " +
                    "SØK I LEIAR-KUNNSKAPSBASEN FØRST med SearchStrategicDocumentsAsync før du svarar. " +
                    "Kunnskapsbasen inneheld strategiske dokument, retningslinjer, malar og prosedyrar for leiarar i Vestland fylkeskommune.]";
                hints.Add(leiarHint);

                this._logger.LogInformation("PluginHint: Generated LeiarKontekst hint for query");
            }
        }

        // Check for Mimir Knowledge triggers (GLOBAL plugin - available to all)
        var mimirScore = CountKeywordMatches(lowerMessage, MimirKeywords);
        if (mimirScore > 0)
        {
            this._logger.LogDebug("PluginHint: Detected Mimir-related query (score: {Score})", mimirScore);

            // Determine which specific function to recommend
            var function = DetermineMimirFunction(lowerMessage);
            var mimirHint = $"[VERKTØY-HINT: Dette spørsmålet handlar om Mimir. BRUK {function} for å hente korrekt informasjon FØR du svarar.]";
            hints.Add(mimirHint);

            this._logger.LogInformation("PluginHint: Generated Mimir hint for query");
        }

        if (hints.Count == 0)
        {
            return null;
        }

        return string.Join("\n", hints);
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

        // Vestland fylkeskommune info / FAQ
        if (ContainsAny(lowerMessage, "fylkeskommune", "vestland", "fylkesdirektør", "direktør",
            "besøksadresse", "postadresse", "opningstid", "kontor", "tenester",
            "botolf", "chatgpt", "forskjell", "lagring", "data lagra",
            "ki-kurs", "kurs i ki", "skriv klart", "klarare med ki"))
        {
            return "SearchMimirKnowledgeAsync";
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
