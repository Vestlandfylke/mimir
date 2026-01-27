// Copyright (c) Microsoft. All rights reserved.

using System.ComponentModel;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using CopilotChat.WebApi.Options;
using Microsoft.SemanticKernel;

namespace CopilotChat.WebApi.Plugins.Chat;

/// <summary>
/// Semantic Kernel plugin for providing access to Norwegian laws and regulations via the Lovdata API.
/// This plugin is only registered for the "leader" chat template.
/// 
/// Endpoints used:
/// - /v1/structuredRules/list - List available legal sources
/// - /v1/structuredRules/list/{base} - List laws in a source
/// - /v1/structuredRules/get/{base}/{ruleFile} - Get law content
/// - /v1/structuredRules/get/{base}/{ruleFile}/{date} - Get law at specific date
/// 
/// Future authenticated endpoints:
/// - /v1/search - Full-text search
/// - /v1/ai/strategySearch - AI-powered search
/// </summary>
internal sealed class LovdataPlugin
{
    private readonly ILogger _logger;
    private readonly LovdataPluginOptions _options;
    private readonly HttpClient _httpClient;

    public LovdataPlugin(
        LovdataPluginOptions options,
        ILogger logger,
        IHttpClientFactory httpClientFactory)
    {
        this._options = options ?? throw new ArgumentNullException(nameof(options));
        this._logger = logger ?? throw new ArgumentNullException(nameof(logger));

        this._httpClient = httpClientFactory.CreateClient();
        this._httpClient.BaseAddress = new Uri(options.BaseUrl);
        this._httpClient.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);

        // Add required headers
        this._httpClient.DefaultRequestHeaders.Add("User-Agent", "Mimir-LeiarAssistent/1.0");
        this._httpClient.DefaultRequestHeaders.Add("Accept", "application/json, application/xml, text/html");

        // Add API key - required for Lovdata API access
        if (options.IsAuthenticated)
        {
            this._httpClient.DefaultRequestHeaders.Add("X-API-Key", options.ApiKey);
        }
    }

    /// <summary>
    /// Checks if the API is properly configured with an API key.
    /// </summary>
    private bool IsApiConfigured()
    {
        return this._options.IsAuthenticated;
    }

    /// <summary>
    /// Returns an error message when API key is not configured.
    /// </summary>
    private string GetApiNotConfiguredMessage()
    {
        return "⚠️ **Lovdata API-nøkkel manglar**\n\n" +
               "Denne funksjonen krev API-nøkkel frå Lovdata. Kontakt systemadministrator for å få sett opp tilgang.\n\n" +
               "**Alternativ som fungerer utan API-nøkkel:**\n" +
               "- `GetCommonLawReferencesAsync` - Oversikt over vanlege lover med direktelenkjer\n" +
               "- `ListPublicDataPackagesAsync` - List tilgjengelege offentlege datapakkar\n" +
               "- Søk direkte på lovdata.no: https://lovdata.no\n\n" +
               "**Direktelenkjer til vanlege lover:**\n" +
               "- Arbeidsmiljølova: https://lovdata.no/lov/2005-06-17-62\n" +
               "- Ferielova: https://lovdata.no/lov/1988-04-29-21\n" +
               "- Forvaltningslova: https://lovdata.no/lov/1967-02-10\n" +
               "- Offentleglova: https://lovdata.no/lov/2006-05-19-16";
    }

    /// <summary>
    /// Lists available legal sources (bases) in Lovdata.
    /// </summary>
    [KernelFunction, Description("List tilgjengelege lovkjelder i Lovdata (t.d. NL for gjeldande lover, SF for forskrifter). Bruk dette for å sjå kva kjelder som finst.")]
    public async Task<string> ListLegalSourcesAsync(CancellationToken cancellationToken = default)
    {
        this._logger.LogInformation("Lovdata: Listing legal sources");

        if (!IsApiConfigured())
        {
            this._logger.LogWarning("Lovdata API key not configured");
            return GetApiNotConfiguredMessage();
        }

        try
        {
            var response = await this._httpClient.GetAsync("/v1/structuredRules/list", cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                this._logger.LogWarning("Lovdata API returned {StatusCode}", response.StatusCode);
                if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    return "⚠️ Lovdata API nekta tilgang (Unauthorized). API-nøkkelen kan vere ugyldig eller utløpt. Kontakt systemadministrator.";
                }
                return $"Kunne ikkje hente lovkjelder. Statuskode: {response.StatusCode}";
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            var sources = JsonSerializer.Deserialize<List<LegalSourceInfo>>(content, JsonOptions);

            if (sources == null || sources.Count == 0)
            {
                return "Fann ingen lovkjelder.";
            }

            var sb = new StringBuilder();
            sb.AppendLine("Tilgjengelege lovkjelder i Lovdata:\n");

            foreach (var source in sources)
            {
                sb.AppendLine($"- **{source.Base}**: {source.Description ?? "Ingen skildring"}");
                if (!string.IsNullOrEmpty(source.DocumentCount))
                {
                    sb.AppendLine($"  Antal dokument: {source.DocumentCount}");
                }
            }

            sb.AppendLine("\n---");
            sb.AppendLine("Bruk ListLawsInSourceAsync med base-namnet for å sjå lover i ei kjelde.");
            sb.AppendLine("Viktige kjelder:");
            sb.AppendLine("- **NL**: Gjeldande lover (Norges Lover)");
            sb.AppendLine("- **SF**: Sentrale forskrifter");
            sb.AppendLine("- **NLE**: Engelske omsetjingar av lover");

            return sb.ToString();
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error listing legal sources from Lovdata");
            return $"Det oppstod ein feil ved henting av lovkjelder: {ex.Message}";
        }
    }

    /// <summary>
    /// Lists laws available in a specific legal source.
    /// </summary>
    [KernelFunction, Description("List lover i ei spesifikk lovkjelde. Bruk 'NL' for gjeldande lover, 'SF' for forskrifter. Kan filtrerast med søkeord.")]
    public async Task<string> ListLawsInSourceAsync(
        [Description("Lovkjelda (t.d. 'NL' for Norges Lover, 'SF' for sentrale forskrifter)")] string source,
        [Description("Valfritt søkeord for å filtrere (t.d. 'arbeidsmiljø', 'ferie')")] string? filter = null,
        [Description("Maksimalt antal resultat (standard: 20)")] int maxResults = 20,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(source))
        {
            return "Ver venleg og oppgje ei lovkjelde (t.d. 'NL' for Norges Lover).";
        }

        if (!IsApiConfigured())
        {
            this._logger.LogWarning("Lovdata API key not configured");
            return GetApiNotConfiguredMessage();
        }

        this._logger.LogInformation("Lovdata: Listing laws in source '{Source}' with filter '{Filter}'", source, filter);

        try
        {
            var response = await this._httpClient.GetAsync($"/v1/structuredRules/list/{Uri.EscapeDataString(source)}", cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                this._logger.LogWarning("Lovdata API returned {StatusCode}", response.StatusCode);
                if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    return "⚠️ Lovdata API nekta tilgang (Unauthorized). API-nøkkelen kan vere ugyldig eller utløpt.";
                }
                return $"Kunne ikkje hente lover frå kjelde '{source}'. Statuskode: {response.StatusCode}";
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            var laws = JsonSerializer.Deserialize<List<LawInfo>>(content, JsonOptions);

            if (laws == null || laws.Count == 0)
            {
                return $"Fann ingen lover i kjelde '{source}'.";
            }

            // Apply filter if provided
            if (!string.IsNullOrWhiteSpace(filter))
            {
                laws = laws
                    .Where(l =>
                        (l.Title?.Contains(filter, StringComparison.OrdinalIgnoreCase) ?? false) ||
                        (l.ShortTitle?.Contains(filter, StringComparison.OrdinalIgnoreCase) ?? false) ||
                        (l.RuleFile?.Contains(filter, StringComparison.OrdinalIgnoreCase) ?? false))
                    .ToList();
            }

            // Limit results
            var totalCount = laws.Count;
            laws = laws.Take(Math.Min(maxResults, this._options.MaxResults)).ToList();

            if (laws.Count == 0)
            {
                return $"Fann ingen lover som samsvarar med filteret '{filter}' i kjelde '{source}'.";
            }

            var sb = new StringBuilder();
            sb.AppendLine($"Lover i kjelde '{source}'" + (filter != null ? $" (filtrert på '{filter}')" : "") + ":\n");

            if (totalCount > laws.Count)
            {
                sb.AppendLine($"*Viser {laws.Count} av {totalCount} resultat*\n");
            }

            foreach (var law in laws)
            {
                var title = law.ShortTitle ?? law.Title ?? law.RuleFile ?? "Ukjend";
                sb.AppendLine($"- **{title}**");
                if (!string.IsNullOrEmpty(law.RuleFile))
                {
                    sb.AppendLine($"  Referanse: `{law.RuleFile}`");
                }
                if (!string.IsNullOrEmpty(law.Date))
                {
                    sb.AppendLine($"  Dato: {law.Date}");
                }
            }

            sb.AppendLine("\n---");
            sb.AppendLine("Bruk GetLawContentAsync med referansen (ruleFile) for å hente lovteksten.");
            sb.AppendLine("Døme: GetLawContentAsync(\"NL\", \"lov/2005-06-17-62\") for Arbeidsmiljøloven");

            return sb.ToString();
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error listing laws from Lovdata");
            return $"Det oppstod ein feil ved henting av lover: {ex.Message}";
        }
    }

    /// <summary>
    /// Gets the content of a specific law.
    /// </summary>
    [KernelFunction, Description("Hent innhaldet i ei spesifikk lov. Oppgje kjelde (t.d. 'NL') og lovreferanse (t.d. 'lov/2005-06-17-62' for Arbeidsmiljøloven).")]
    public async Task<string> GetLawContentAsync(
        [Description("Lovkjelda (t.d. 'NL' for Norges Lover)")] string source,
        [Description("Lovreferanse i format 'lov/YYYY-MM-DD-NN' (t.d. 'lov/2005-06-17-62' for Arbeidsmiljøloven)")] string lawReference,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(source) || string.IsNullOrWhiteSpace(lawReference))
        {
            return "Ver venleg og oppgje både lovkjelde og lovreferanse.";
        }

        if (!IsApiConfigured())
        {
            this._logger.LogWarning("Lovdata API key not configured");
            return GetApiNotConfiguredMessage() + $"\n\n**Direkte lenkje:** https://lovdata.no/dokument/{source}/{lawReference}";
        }

        this._logger.LogInformation("Lovdata: Getting law content for '{Source}/{LawReference}'", source, lawReference);

        try
        {
            var response = await this._httpClient.GetAsync(
                $"/v1/structuredRules/get/{Uri.EscapeDataString(source)}/{Uri.EscapeDataString(lawReference)}",
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                this._logger.LogWarning("Lovdata API returned {StatusCode}", response.StatusCode);
                if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    return $"⚠️ Lovdata API nekta tilgang (Unauthorized).\n\n**Direkte lenkje:** https://lovdata.no/dokument/{source}/{lawReference}";
                }
                return $"Kunne ikkje hente lova '{lawReference}'. Statuskode: {response.StatusCode}";
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);

            // The response is HTML/XML content - parse it to extract useful info
            var lawContent = ParseLawContent(content, lawReference);

            // Truncate if necessary
            if (lawContent.Length > this._options.MaxContentLength)
            {
                lawContent = lawContent.Substring(0, this._options.MaxContentLength) +
                    "\n\n[Innhaldet er forkorta på grunn av lengde. Be om spesifikke paragrafar om du treng meir detaljar.]";
            }

            var sb = new StringBuilder();
            sb.AppendLine($"# Lovtekst: {lawReference}");
            sb.AppendLine($"*Kjelde: Lovdata ({source})*\n");
            sb.AppendLine("---\n");
            sb.AppendLine(lawContent);
            sb.AppendLine("\n---");
            sb.AppendLine($"*Kjelde: https://lovdata.no/dokument/{source}/{lawReference}*");

            return sb.ToString();
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error getting law content from Lovdata");
            return $"Det oppstod ein feil ved henting av lovtekst: {ex.Message}";
        }
    }

    /// <summary>
    /// Gets the version of a law that was in force at a specific date.
    /// </summary>
    [KernelFunction, Description("Hent versjonen av ei lov som gjaldt på ein bestemt dato. Nyttig for å sjå historiske versjonar av lover.")]
    public async Task<string> GetLawAtDateAsync(
        [Description("Lovkjelda (t.d. 'NL' for Norges Lover)")] string source,
        [Description("Lovreferanse i format 'lov/YYYY-MM-DD-NN'")] string lawReference,
        [Description("Dato i format 'YYYY-MM-DD' (t.d. '2020-01-01')")] string date,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(source) || string.IsNullOrWhiteSpace(lawReference) || string.IsNullOrWhiteSpace(date))
        {
            return "Ver venleg og oppgje lovkjelde, lovreferanse og dato.";
        }

        if (!IsApiConfigured())
        {
            this._logger.LogWarning("Lovdata API key not configured");
            return GetApiNotConfiguredMessage();
        }

        this._logger.LogInformation("Lovdata: Getting law content for '{Source}/{LawReference}' at date '{Date}'", source, lawReference, date);

        try
        {
            var response = await this._httpClient.GetAsync(
                $"/v1/structuredRules/get/{Uri.EscapeDataString(source)}/{Uri.EscapeDataString(lawReference)}/{Uri.EscapeDataString(date)}",
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                this._logger.LogWarning("Lovdata API returned {StatusCode}", response.StatusCode);
                if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    return "⚠️ Lovdata API nekta tilgang (Unauthorized). API-nøkkelen kan vere ugyldig eller utløpt.";
                }
                return $"Kunne ikkje hente lova '{lawReference}' per {date}. Statuskode: {response.StatusCode}";
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            var lawContent = ParseLawContent(content, lawReference);

            // Truncate if necessary
            if (lawContent.Length > this._options.MaxContentLength)
            {
                lawContent = lawContent.Substring(0, this._options.MaxContentLength) +
                    "\n\n[Innhaldet er forkorta på grunn av lengde.]";
            }

            var sb = new StringBuilder();
            sb.AppendLine($"# Lovtekst: {lawReference} (per {date})");
            sb.AppendLine($"*Historisk versjon frå Lovdata ({source})*\n");
            sb.AppendLine("---\n");
            sb.AppendLine(lawContent);
            sb.AppendLine("\n---");
            sb.AppendLine($"*Kjelde: Lovdata - historisk versjon per {date}*");

            return sb.ToString();
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error getting historical law content from Lovdata");
            return $"Det oppstod ein feil ved henting av historisk lovtekst: {ex.Message}";
        }
    }

    /// <summary>
    /// Gets the timeline of changes for a specific law.
    /// </summary>
    [KernelFunction, Description("Sjå endringshistorikken for ei lov - alle versjonar og når dei vart endra.")]
    public async Task<string> GetLawTimelineAsync(
        [Description("Lovkjelda (t.d. 'NL' for Norges Lover)")] string source,
        [Description("Lovreferanse i format 'lov/YYYY-MM-DD-NN'")] string lawReference,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(source) || string.IsNullOrWhiteSpace(lawReference))
        {
            return "Ver venleg og oppgje både lovkjelde og lovreferanse.";
        }

        if (!IsApiConfigured())
        {
            this._logger.LogWarning("Lovdata API key not configured");
            return GetApiNotConfiguredMessage();
        }

        this._logger.LogInformation("Lovdata: Getting timeline for '{Source}/{LawReference}'", source, lawReference);

        try
        {
            var response = await this._httpClient.GetAsync(
                $"/v1/structuredRules/timeline/{Uri.EscapeDataString(source)}/{Uri.EscapeDataString(lawReference)}",
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                this._logger.LogWarning("Lovdata API returned {StatusCode}", response.StatusCode);
                if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    return "⚠️ Lovdata API nekta tilgang (Unauthorized). API-nøkkelen kan vere ugyldig eller utløpt.";
                }
                return $"Kunne ikkje hente endringshistorikk for '{lawReference}'. Statuskode: {response.StatusCode}";
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            var versions = JsonSerializer.Deserialize<List<LawVersion>>(content, JsonOptions);

            if (versions == null || versions.Count == 0)
            {
                return $"Fann ingen endringshistorikk for '{lawReference}'.";
            }

            var sb = new StringBuilder();
            sb.AppendLine($"# Endringshistorikk: {lawReference}");
            sb.AppendLine($"*Totalt {versions.Count} versjonar*\n");

            foreach (var version in versions.OrderByDescending(v => v.Date))
            {
                sb.AppendLine($"- **{version.Date}**: {version.Description ?? "Endring"}");
            }

            sb.AppendLine("\n---");
            sb.AppendLine("Bruk GetLawAtDateAsync for å hente ein spesifikk versjon.");

            return sb.ToString();
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error getting law timeline from Lovdata");
            return $"Det oppstod ein feil ved henting av endringshistorikk: {ex.Message}";
        }
    }

    /// <summary>
    /// Provides information about common Norwegian laws relevant for leaders.
    /// </summary>
    [KernelFunction, Description("Få informasjon om vanlege lover som er relevante for leiarar, med referansar til Lovdata.")]
    public Task<string> GetCommonLawReferencesAsync(CancellationToken cancellationToken = default)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Vanlege lover for leiarar\n");
        sb.AppendLine("Her er referansar til lover som ofte er relevante for leiarar:\n");

        sb.AppendLine("## Arbeidsrett");
        sb.AppendLine("- **Arbeidsmiljøloven**: `lov/2005-06-17-62`");
        sb.AppendLine("  Regulerer arbeidsmiljø, arbeidstid, tilsetting og oppseiing.");
        sb.AppendLine("- **Ferieloven**: `lov/1988-04-29-21`");
        sb.AppendLine("  Regulerer rett til ferie og feriepengar.");
        sb.AppendLine("- **Likestillings- og diskrimineringsloven**: `lov/2017-06-16-51`");
        sb.AppendLine("  Forbod mot diskriminering.");
        sb.AppendLine("- **Arbeidstvistloven**: `lov/2012-01-27-9`");
        sb.AppendLine("  Regulerer arbeidstvistar og tariffavtalar.\n");

        sb.AppendLine("## Offentleg forvaltning");
        sb.AppendLine("- **Forvaltningsloven**: `lov/1967-02-10`");
        sb.AppendLine("  Saksbehandlingsreglar for det offentlege.");
        sb.AppendLine("- **Offentleglova**: `lov/2006-05-19-16`");
        sb.AppendLine("  Rett til innsyn i offentlege dokument.");
        sb.AppendLine("- **Kommuneloven**: `lov/2018-06-22-83`");
        sb.AppendLine("  Regulerer kommunar og fylkeskommunar.\n");

        sb.AppendLine("## Personvern");
        sb.AppendLine("- **Personopplysningsloven**: `lov/2018-06-15-38`");
        sb.AppendLine("  Regulerer behandling av personopplysningar (GDPR).\n");

        sb.AppendLine("---");
        sb.AppendLine("**Direkte lenkjer til Lovdata:**");
        sb.AppendLine("- Arbeidsmiljølova: https://lovdata.no/lov/2005-06-17-62");
        sb.AppendLine("- Ferielova: https://lovdata.no/lov/1988-04-29-21");
        sb.AppendLine("- Forvaltningslova: https://lovdata.no/lov/1967-02-10");
        sb.AppendLine("- Offentleglova: https://lovdata.no/lov/2006-05-19-16");
        sb.AppendLine("- Personopplysningslova: https://lovdata.no/lov/2018-06-15-38");

        return Task.FromResult(sb.ToString());
    }

    /// <summary>
    /// Lists available public data packages from Lovdata (no authentication required).
    /// </summary>
    [KernelFunction, Description("List tilgjengelege offentlege datapakkar frå Lovdata (krev ikkje API-nøkkel). Desse er maskinlesbare eksportar av lovdata.")]
    public async Task<string> ListPublicDataPackagesAsync(CancellationToken cancellationToken = default)
    {
        this._logger.LogInformation("Lovdata: Listing public data packages");

        try
        {
            var response = await this._httpClient.GetAsync("/v1/publicData/list", cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                this._logger.LogWarning("Lovdata public API returned {StatusCode}", response.StatusCode);
                return $"Kunne ikkje hente liste over offentlege datapakkar. Statuskode: {response.StatusCode}";
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);

            // Try to parse as JSON
            try
            {
                var packages = JsonSerializer.Deserialize<List<PublicDataPackage>>(content, JsonOptions);

                if (packages == null || packages.Count == 0)
                {
                    // Try parsing as simple string array
                    var fileNames = JsonSerializer.Deserialize<List<string>>(content, JsonOptions);
                    if (fileNames != null && fileNames.Count > 0)
                    {
                        var sb = new StringBuilder();
                        sb.AppendLine("# Offentlege datapakkar frå Lovdata\n");
                        sb.AppendLine("Desse datapakkane er tilgjengelege under NLOD 2.0-lisensen (krev ikkje API-nøkkel):\n");

                        foreach (var fileName in fileNames)
                        {
                            sb.AppendLine($"- `{fileName}`");
                        }

                        sb.AppendLine("\n---");
                        sb.AppendLine("Desse er maskinlesbare eksportar i ZIP-format. For interaktiv lesing av lover, bruk lovdata.no direkte.");

                        return sb.ToString();
                    }
                    return "Fann ingen offentlege datapakkar.";
                }

                var result = new StringBuilder();
                result.AppendLine("# Offentlege datapakkar frå Lovdata\n");
                result.AppendLine("Desse datapakkane er tilgjengelege under NLOD 2.0-lisensen:\n");

                foreach (var package in packages)
                {
                    result.AppendLine($"- **{package.Name ?? package.Filename ?? "Ukjend"}**");
                    if (!string.IsNullOrEmpty(package.Description))
                    {
                        result.AppendLine($"  {package.Description}");
                    }
                    if (!string.IsNullOrEmpty(package.Filename))
                    {
                        result.AppendLine($"  Fil: `{package.Filename}`");
                    }
                }

                result.AppendLine("\n---");
                result.AppendLine("Desse er maskinlesbare eksportar. For interaktiv lesing av lover, bruk lovdata.no direkte.");

                return result.ToString();
            }
            catch (JsonException)
            {
                // If JSON parsing fails, return raw content summary
                return $"Lovdata returnerte data, men formatet kunne ikkje lesast. Rå respons (første 500 teikn):\n{content.Substring(0, Math.Min(500, content.Length))}";
            }
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error listing public data packages from Lovdata");
            return $"Det oppstod ein feil ved henting av offentlege datapakkar: {ex.Message}";
        }
    }

    /// <summary>
    /// Parses the HTML/XML content from Lovdata and extracts readable text.
    /// </summary>
    private static string ParseLawContent(string htmlContent, string lawReference)
    {
        // Simple extraction - remove HTML tags and clean up
        // For more sophisticated parsing, consider using an HTML parser library

        var text = htmlContent;

        // Remove script and style tags with content
        text = System.Text.RegularExpressions.Regex.Replace(text, @"<script[^>]*>[\s\S]*?</script>", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        text = System.Text.RegularExpressions.Regex.Replace(text, @"<style[^>]*>[\s\S]*?</style>", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        // Replace common HTML elements with markdown equivalents
        text = System.Text.RegularExpressions.Regex.Replace(text, "<h1[^>]*>", "\n# ");
        text = System.Text.RegularExpressions.Regex.Replace(text, "</h1>", "\n");
        text = System.Text.RegularExpressions.Regex.Replace(text, "<h2[^>]*>", "\n## ");
        text = System.Text.RegularExpressions.Regex.Replace(text, "</h2>", "\n");
        text = System.Text.RegularExpressions.Regex.Replace(text, "<h3[^>]*>", "\n### ");
        text = System.Text.RegularExpressions.Regex.Replace(text, "</h3>", "\n");
        text = System.Text.RegularExpressions.Regex.Replace(text, "<p[^>]*>", "\n");
        text = System.Text.RegularExpressions.Regex.Replace(text, "</p>", "\n");
        text = System.Text.RegularExpressions.Regex.Replace(text, "<br[^>]*>", "\n");
        text = System.Text.RegularExpressions.Regex.Replace(text, "<li[^>]*>", "\n- ");
        text = System.Text.RegularExpressions.Regex.Replace(text, "</li>", "");

        // Remove remaining HTML tags
        text = System.Text.RegularExpressions.Regex.Replace(text, "<[^>]+>", "");

        // Decode HTML entities
        text = System.Net.WebUtility.HtmlDecode(text);

        // Clean up whitespace
        text = System.Text.RegularExpressions.Regex.Replace(text, @"\n{3,}", "\n\n");
        text = System.Text.RegularExpressions.Regex.Replace(text, @"[ \t]+", " ");

        return text.Trim();
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    // DTO classes for Lovdata API responses
    private sealed class LegalSourceInfo
    {
        [JsonPropertyName("base")]
        public string? Base { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }

        [JsonPropertyName("documentCount")]
        public string? DocumentCount { get; set; }
    }

    private sealed class LawInfo
    {
        [JsonPropertyName("ruleFile")]
        public string? RuleFile { get; set; }

        [JsonPropertyName("title")]
        public string? Title { get; set; }

        [JsonPropertyName("shortTitle")]
        public string? ShortTitle { get; set; }

        [JsonPropertyName("date")]
        public string? Date { get; set; }
    }

    private sealed class LawVersion
    {
        [JsonPropertyName("date")]
        public string? Date { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }
    }

    private sealed class PublicDataPackage
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("filename")]
        public string? Filename { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }

        [JsonPropertyName("size")]
        public long? Size { get; set; }

        [JsonPropertyName("lastModified")]
        public string? LastModified { get; set; }
    }
}
