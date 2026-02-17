// Copyright (c) Microsoft. All rights reserved.

using System.ComponentModel;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using CopilotChat.WebApi.Options;
using CopilotChat.WebApi.Services;
using Microsoft.SemanticKernel;

namespace CopilotChat.WebApi.Plugins.Chat;

/// <summary>
/// Semantic Kernel plugin for accessing SharePoint documents using On-Behalf-Of (OBO) authentication.
/// This ensures users can only access documents they have SharePoint permissions for.
/// </summary>
internal sealed class SharePointOboPlugin
{
    private readonly string _bearerToken;
    private readonly ILogger _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IDocumentTextExtractor _textExtractor;
    private readonly SharePointOboPluginOptions _options;
    private readonly PluginCitationService? _citationService;

    private const string GraphApiBaseUrl = "https://graph.microsoft.com/v1.0";

    // Cached site ID to avoid repeated lookups
    private string? _siteId;

    public SharePointOboPlugin(
        string bearerToken,
        IHttpClientFactory httpClientFactory,
        IDocumentTextExtractor textExtractor,
        SharePointOboPluginOptions options,
        ILogger logger,
        PluginCitationService? citationService = null)
    {
        this._bearerToken = bearerToken ?? throw new ArgumentNullException(nameof(bearerToken));
        this._httpClientFactory = httpClientFactory ?? throw new ArgumentNullException(nameof(httpClientFactory));
        this._textExtractor = textExtractor ?? throw new ArgumentNullException(nameof(textExtractor));
        this._options = options ?? throw new ArgumentNullException(nameof(options));
        this._logger = logger ?? throw new ArgumentNullException(nameof(logger));
        this._citationService = citationService;
    }

    /// <summary>
    /// Searches for documents in SharePoint matching the given query.
    /// </summary>
    [KernelFunction, Description("Søk etter dokument i SharePoint med nøkkelord. Returnerer dokumentnamn, stiar og grunnleggande metadata.")]
    public async Task<string> SearchDocumentsAsync(
        [Description("Søkeord for å finne dokument")] string query,
        [Description("Maks antal resultat å returnere (standard: 10)")] int maxResults = 10,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return "Please provide a search query.";
        }

        this._logger.LogInformation("SharePoint: Searching for documents with query '{Query}'", query);

        try
        {
            var accessToken = await this.GetOboAccessTokenAsync(cancellationToken);
            var siteId = await this.GetSiteIdAsync(accessToken, cancellationToken);

            using var client = this._httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            // Search in the site's drive
            var searchUrl = $"{GraphApiBaseUrl}/sites/{siteId}/drive/root/search(q='{Uri.EscapeDataString(query)}')?$top={maxResults}&$select=id,name,webUrl,size,lastModifiedDateTime,createdDateTime,file,folder,parentReference";

            var response = await client.GetAsync(searchUrl, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                this._logger.LogWarning("SharePoint search failed: {StatusCode} - {Error}", response.StatusCode, error);
                return $"Search failed: {response.StatusCode}";
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            var searchResult = JsonSerializer.Deserialize<GraphSearchResponse>(content);

            if (searchResult?.Value == null || searchResult.Value.Count == 0)
            {
                return "No documents found matching your search.";
            }

            // Format results
            var results = searchResult.Value
                .Where(item => item.File != null) // Only files, not folders
                .Select(item => new
                {
                    item.Name,
                    Path = item.ParentReference?.Path?.Replace("/drive/root:", "") ?? "/",
                    item.WebUrl,
                    Size = FormatFileSize(item.Size),
                    Modified = item.LastModifiedDateTime?.ToString("yyyy-MM-dd HH:mm") ?? "Unknown",
                    Type = item.File?.MimeType ?? "Unknown"
                })
                .ToList();

            return JsonSerializer.Serialize(results, new JsonSerializerOptions { WriteIndented = true });
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error searching SharePoint documents");
            return $"Error searching documents: {ex.Message}";
        }
    }

    /// <summary>
    /// Lists folders in a SharePoint directory.
    /// </summary>
    [KernelFunction, Description("List mapper i ein SharePoint-katalog. Bruk tom sti eller '/' for rotkatalogen.")]
    public async Task<string> ListFoldersAsync(
        [Description("Folder path relative to document library root (e.g., '/Reports' or empty for root)")] string path = "",
        CancellationToken cancellationToken = default)
    {
        this._logger.LogInformation("SharePoint: Listing folders at path '{Path}'", path);

        try
        {
            var accessToken = await this.GetOboAccessTokenAsync(cancellationToken);
            var siteId = await this.GetSiteIdAsync(accessToken, cancellationToken);

            using var client = this._httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            // Build the URL based on path
            var listUrl = string.IsNullOrWhiteSpace(path) || path == "/"
                ? $"{GraphApiBaseUrl}/sites/{siteId}/drive/root/children?$filter=folder ne null&$select=id,name,webUrl,folder,lastModifiedDateTime"
                : $"{GraphApiBaseUrl}/sites/{siteId}/drive/root:/{path.TrimStart('/')}:/children?$filter=folder ne null&$select=id,name,webUrl,folder,lastModifiedDateTime";

            var response = await client.GetAsync(listUrl, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                this._logger.LogWarning("SharePoint list folders failed: {StatusCode} - {Error}", response.StatusCode, error);
                return $"Failed to list folders: {response.StatusCode}";
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = JsonSerializer.Deserialize<GraphSearchResponse>(content);

            if (result?.Value == null || result.Value.Count == 0)
            {
                return "No folders found at this location.";
            }

            var folders = result.Value
                .Where(item => item.Folder != null)
                .Select(item => new
                {
                    item.Name,
                    ChildCount = item.Folder?.ChildCount ?? 0,
                    Modified = item.LastModifiedDateTime?.ToString("yyyy-MM-dd HH:mm") ?? "Unknown"
                })
                .ToList();

            return JsonSerializer.Serialize(folders, new JsonSerializerOptions { WriteIndented = true });
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error listing SharePoint folders");
            return $"Error listing folders: {ex.Message}";
        }
    }

    /// <summary>
    /// Lists documents in a SharePoint directory.
    /// </summary>
    [KernelFunction, Description("List dokument i ei SharePoint-mappe. Bruk tom sti eller '/' for rotkatalogen.")]
    public async Task<string> ListDocumentsAsync(
        [Description("Folder path relative to document library root (e.g., '/Reports' or empty for root)")] string path = "",
        [Description("Maximum number of documents to return (default: 20)")] int maxResults = 20,
        CancellationToken cancellationToken = default)
    {
        this._logger.LogInformation("SharePoint: Listing documents at path '{Path}'", path);

        try
        {
            var accessToken = await this.GetOboAccessTokenAsync(cancellationToken);
            var siteId = await this.GetSiteIdAsync(accessToken, cancellationToken);

            using var client = this._httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            // Build the URL based on path
            var listUrl = string.IsNullOrWhiteSpace(path) || path == "/"
                ? $"{GraphApiBaseUrl}/sites/{siteId}/drive/root/children?$filter=file ne null&$top={maxResults}&$select=id,name,webUrl,size,lastModifiedDateTime,createdDateTime,file,parentReference"
                : $"{GraphApiBaseUrl}/sites/{siteId}/drive/root:/{path.TrimStart('/')}:/children?$filter=file ne null&$top={maxResults}&$select=id,name,webUrl,size,lastModifiedDateTime,createdDateTime,file,parentReference";

            var response = await client.GetAsync(listUrl, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                this._logger.LogWarning("SharePoint list documents failed: {StatusCode} - {Error}", response.StatusCode, error);
                return $"Failed to list documents: {response.StatusCode}";
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = JsonSerializer.Deserialize<GraphSearchResponse>(content);

            if (result?.Value == null || result.Value.Count == 0)
            {
                return "No documents found at this location.";
            }

            var documents = result.Value
                .Where(item => item.File != null)
                .Select(item => new
                {
                    item.Name,
                    item.Id,
                    Size = FormatFileSize(item.Size),
                    Modified = item.LastModifiedDateTime?.ToString("yyyy-MM-dd HH:mm") ?? "Unknown",
                    Type = item.File?.MimeType ?? "Unknown"
                })
                .ToList();

            return JsonSerializer.Serialize(documents, new JsonSerializerOptions { WriteIndented = true });
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error listing SharePoint documents");
            return $"Error listing documents: {ex.Message}";
        }
    }

    /// <summary>
    /// Gets the text content of a document for RAG purposes.
    /// </summary>
    [KernelFunction, Description("Last ned og hent ut tekstinnhald frå eit SharePoint-dokument. Bruk dette for å lese innhaldet i eit dokument.")]
    public async Task<string> GetDocumentContentAsync(
        [Description("The document ID (from search or list results) or full path (e.g., '/Reports/budget.pdf')")] string documentIdOrPath,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(documentIdOrPath))
        {
            return "Please provide a document ID or path.";
        }

        this._logger.LogInformation("SharePoint: Getting content for document '{Document}'", documentIdOrPath);

        try
        {
            var accessToken = await this.GetOboAccessTokenAsync(cancellationToken);
            var siteId = await this.GetSiteIdAsync(accessToken, cancellationToken);

            using var client = this._httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            // First, get the file metadata to determine the file name
            string metadataUrl;
            if (documentIdOrPath.StartsWith("/") || documentIdOrPath.Contains("/"))
            {
                // Path-based
                metadataUrl = $"{GraphApiBaseUrl}/sites/{siteId}/drive/root:/{documentIdOrPath.TrimStart('/')}";
            }
            else
            {
                // ID-based
                metadataUrl = $"{GraphApiBaseUrl}/sites/{siteId}/drive/items/{documentIdOrPath}";
            }

            var metadataResponse = await client.GetAsync(metadataUrl, cancellationToken);
            if (!metadataResponse.IsSuccessStatusCode)
            {
                return $"Document not found or access denied: {metadataResponse.StatusCode}";
            }

            var metadataContent = await metadataResponse.Content.ReadAsStringAsync(cancellationToken);
            var metadata = JsonSerializer.Deserialize<DriveItem>(metadataContent);

            if (metadata == null || string.IsNullOrEmpty(metadata.Name))
            {
                return "Could not retrieve document metadata.";
            }

            // Check if the file type is supported
            if (!this._textExtractor.IsSupported(metadata.Name))
            {
                return $"File type not supported for text extraction: {Path.GetExtension(metadata.Name)}. Supported types: PDF, DOCX, XLSX, PPTX, and common text files.";
            }

            // Download the file content
            var downloadUrl = documentIdOrPath.StartsWith("/") || documentIdOrPath.Contains("/")
                ? $"{GraphApiBaseUrl}/sites/{siteId}/drive/root:/{documentIdOrPath.TrimStart('/')}:/content"
                : $"{GraphApiBaseUrl}/sites/{siteId}/drive/items/{documentIdOrPath}/content";

            var downloadResponse = await client.GetAsync(downloadUrl, cancellationToken);
            if (!downloadResponse.IsSuccessStatusCode)
            {
                return $"Failed to download document: {downloadResponse.StatusCode}";
            }

            using var stream = await downloadResponse.Content.ReadAsStreamAsync(cancellationToken);

            // Copy to memory stream since some extractors need seekable streams
            using var memoryStream = new MemoryStream();
            await stream.CopyToAsync(memoryStream, cancellationToken);
            memoryStream.Position = 0;

            // Extract text
            var text = await this._textExtractor.ExtractTextAsync(
                memoryStream,
                metadata.Name,
                this._options.MaxContentLength);

            // Register citation for display in the UI
            if (this._citationService != null)
            {
                var snippet = text.Length > 500 ? text.Substring(0, 500) + "..." : text;
                this._citationService.AddCitation(
                    documentTitle: metadata.Name!,
                    source: metadata.WebUrl ?? documentIdOrPath,
                    snippet: snippet,
                    relevanceScore: 1.0,
                    sourceType: "SharePoint"
                );
            }

            return $"=== Content from: {metadata.Name} ===\n\n{text}";
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error getting SharePoint document content");
            return $"Error retrieving document content: {ex.Message}";
        }
    }

    /// <summary>
    /// Gets metadata for a document without downloading it.
    /// </summary>
    [KernelFunction, Description("Hent metadata (eigenskapar) for eit SharePoint-dokument utan å laste det ned.")]
    public async Task<string> GetDocumentMetadataAsync(
        [Description("The document ID or full path (e.g., '/Reports/budget.pdf')")] string documentIdOrPath,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(documentIdOrPath))
        {
            return "Please provide a document ID or path.";
        }

        this._logger.LogInformation("SharePoint: Getting metadata for document '{Document}'", documentIdOrPath);

        try
        {
            var accessToken = await this.GetOboAccessTokenAsync(cancellationToken);
            var siteId = await this.GetSiteIdAsync(accessToken, cancellationToken);

            using var client = this._httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            string metadataUrl;
            if (documentIdOrPath.StartsWith("/") || documentIdOrPath.Contains("/"))
            {
                metadataUrl = $"{GraphApiBaseUrl}/sites/{siteId}/drive/root:/{documentIdOrPath.TrimStart('/')}?$select=id,name,webUrl,size,lastModifiedDateTime,createdDateTime,createdBy,lastModifiedBy,file,parentReference";
            }
            else
            {
                metadataUrl = $"{GraphApiBaseUrl}/sites/{siteId}/drive/items/{documentIdOrPath}?$select=id,name,webUrl,size,lastModifiedDateTime,createdDateTime,createdBy,lastModifiedBy,file,parentReference";
            }

            var response = await client.GetAsync(metadataUrl, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return $"Document not found or access denied: {response.StatusCode}";
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            var item = JsonSerializer.Deserialize<DriveItem>(content);

            if (item == null)
            {
                return "Could not retrieve document metadata.";
            }

            var metadata = new
            {
                item.Name,
                item.Id,
                Path = item.ParentReference?.Path?.Replace("/drive/root:", "") ?? "/",
                item.WebUrl,
                Size = FormatFileSize(item.Size),
                Created = item.CreatedDateTime?.ToString("yyyy-MM-dd HH:mm") ?? "Unknown",
                Modified = item.LastModifiedDateTime?.ToString("yyyy-MM-dd HH:mm") ?? "Unknown",
                CreatedBy = item.CreatedBy?.User?.DisplayName ?? "Unknown",
                ModifiedBy = item.LastModifiedBy?.User?.DisplayName ?? "Unknown",
                MimeType = item.File?.MimeType ?? "Unknown"
            };

            return JsonSerializer.Serialize(metadata, new JsonSerializerOptions { WriteIndented = true });
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error getting SharePoint document metadata");
            return $"Error retrieving document metadata: {ex.Message}";
        }
    }

    /// <summary>
    /// Lists all SharePoint sites the user has access to.
    /// </summary>
    [KernelFunction, Description("List alle SharePoint-nettstader/område brukaren har tilgang til. Bruk dette for å finne tilgjengelege nettstader før du søkjer i dei.")]
    public async Task<string> ListSitesAsync(
        [Description("Maximum number of sites to return (default: 20)")] int maxResults = 20,
        CancellationToken cancellationToken = default)
    {
        this._logger.LogInformation("SharePoint: Listing sites user has access to");

        try
        {
            var accessToken = await this.GetOboAccessTokenAsync(cancellationToken);

            using var client = this._httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            // Get sites the user is following or has access to
            var sitesUrl = $"{GraphApiBaseUrl}/sites?search=*&$top={maxResults}&$select=id,name,displayName,webUrl,description";

            var response = await client.GetAsync(sitesUrl, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                this._logger.LogWarning("SharePoint list sites failed: {StatusCode} - {Error}", response.StatusCode, error);
                return $"Failed to list sites: {response.StatusCode}";
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = JsonSerializer.Deserialize<GraphSitesResponse>(content);

            if (result?.Value == null || result.Value.Count == 0)
            {
                return "No SharePoint sites found.";
            }

            var sites = result.Value
                .Select(site => new
                {
                    site.DisplayName,
                    site.Name,
                    site.WebUrl,
                    Description = site.Description ?? "No description",
                    site.Id
                })
                .ToList();

            return JsonSerializer.Serialize(sites, new JsonSerializerOptions { WriteIndented = true });
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error listing SharePoint sites");
            return $"Error listing sites: {ex.Message}";
        }
    }

    /// <summary>
    /// Gets news articles from a SharePoint site.
    /// </summary>
    [KernelFunction, Description("Hent nyheitsartiklar frå SharePoint. Returnerer titlar, samandrag og publiseringsinfo.")]
    public async Task<string> GetNewsAsync(
        [Description("Optional: Site URL or ID to get news from. If empty, uses the default configured site.")] string siteUrlOrId = "",
        [Description("Maximum number of news articles to return (default: 10)")] int maxResults = 10,
        CancellationToken cancellationToken = default)
    {
        this._logger.LogInformation("SharePoint: Getting news articles");

        try
        {
            var accessToken = await this.GetOboAccessTokenAsync(cancellationToken);

            using var client = this._httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            // Determine which site to use
            string siteId;
            if (string.IsNullOrWhiteSpace(siteUrlOrId))
            {
                siteId = await this.GetSiteIdAsync(accessToken, cancellationToken);
            }
            else if (siteUrlOrId.StartsWith("http"))
            {
                // It's a URL, resolve to site ID
                var siteUrl = new Uri(siteUrlOrId);
                var hostname = siteUrl.Host;
                var sitePath = siteUrl.AbsolutePath;
                var siteEndpoint = $"{GraphApiBaseUrl}/sites/{hostname}:{sitePath}";
                var siteResponse = await client.GetAsync(siteEndpoint, cancellationToken);
                if (!siteResponse.IsSuccessStatusCode)
                {
                    return $"Could not access site: {siteUrlOrId}";
                }
                var siteContent = await siteResponse.Content.ReadAsStringAsync(cancellationToken);
                using var siteDoc = JsonDocument.Parse(siteContent);
                siteId = siteDoc.RootElement.GetProperty("id").GetString()!;
            }
            else
            {
                // Assume it's already a site ID
                siteId = siteUrlOrId;
            }

            // Get news pages from the site
            // SharePoint news is stored in the Site Pages library as pages with promotedState = 2
            var newsUrl = $"{GraphApiBaseUrl}/sites/{siteId}/pages?$filter=promotionKind eq 'newsPost'&$top={maxResults}&$orderby=lastModifiedDateTime desc&$select=id,name,title,description,webUrl,createdDateTime,lastModifiedDateTime,createdBy,lastModifiedBy";

            var response = await client.GetAsync(newsUrl, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                // Try alternative approach: search for news in site pages
                var altNewsUrl = $"{GraphApiBaseUrl}/sites/{siteId}/pages?$top={maxResults}&$orderby=lastModifiedDateTime desc&$select=id,name,title,description,webUrl,createdDateTime,lastModifiedDateTime,createdBy,lastModifiedBy";
                response = await client.GetAsync(altNewsUrl, cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync(cancellationToken);
                    this._logger.LogWarning("SharePoint get news failed: {StatusCode} - {Error}", response.StatusCode, error);
                    return $"Failed to get news: {response.StatusCode}. Note: News access may require additional permissions.";
                }
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = JsonSerializer.Deserialize<GraphPagesResponse>(content);

            if (result?.Value == null || result.Value.Count == 0)
            {
                return "No news articles found.";
            }

            var news = result.Value
                .Select(page => new
                {
                    page.Title,
                    Description = page.Description ?? "No description",
                    page.WebUrl,
                    Published = page.CreatedDateTime?.ToString("yyyy-MM-dd HH:mm") ?? "Unknown",
                    Modified = page.LastModifiedDateTime?.ToString("yyyy-MM-dd HH:mm") ?? "Unknown",
                    Author = page.CreatedBy?.User?.DisplayName ?? "Unknown"
                })
                .ToList();

            return JsonSerializer.Serialize(news, new JsonSerializerOptions { WriteIndented = true });
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error getting SharePoint news");
            return $"Error getting news: {ex.Message}";
        }
    }

    /// <summary>
    /// Searches for content across configured SharePoint sites.
    /// </summary>
    [KernelFunction, Description("Søk etter dokument, sider og innhald på tvers av konfigurerte SharePoint-nettstader. Bruk dette for breie søk når du ikkje veit kva nettstad som inneheld informasjonen. Dette søkjer i både dokument OG SharePoint-sider/nyhetsartiklar.")]
    public async Task<string> SearchAcrossSitesAsync(
        [Description("Search keywords to find content")] string query,
        [Description("Maximum number of results to return (default: 15)")] int maxResults = 15,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return "Please provide a search query.";
        }

        this._logger.LogInformation("SharePoint: Searching across configured sites with query '{Query}'", query);

        try
        {
            var accessToken = await this.GetOboAccessTokenAsync(cancellationToken);

            using var client = this._httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            // Build site filter if AllowedSites is configured
            var siteFilter = BuildSiteFilter();
            var queryString = string.IsNullOrEmpty(siteFilter) ? query : $"{query} {siteFilter}";

            // Use the search API to search across configured sites
            // Include listItem to find SharePoint pages (pages are list items in the Site Pages library)
            var searchRequest = new
            {
                requests = new[]
                {
                    new
                    {
                        entityTypes = new[] { "driveItem", "listItem", "site" },
                        query = new { queryString = queryString },
                        from = 0,
                        size = maxResults,
                        fields = new[] { "id", "name", "title", "webUrl", "lastModifiedDateTime", "createdBy", "parentReference", "summary", "contentclass" }
                    }
                }
            };

            var searchUrl = $"{GraphApiBaseUrl}/search/query";
            var jsonContent = new StringContent(
                JsonSerializer.Serialize(searchRequest),
                System.Text.Encoding.UTF8,
                "application/json");

            var response = await client.PostAsync(searchUrl, jsonContent, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                this._logger.LogWarning("SharePoint cross-site search failed: {StatusCode} - {Error}", response.StatusCode, error);
                return $"Search failed: {response.StatusCode}";
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(content);

            var results = new List<object>();

            if (doc.RootElement.TryGetProperty("value", out var valueArray))
            {
                foreach (var searchResponse in valueArray.EnumerateArray())
                {
                    if (searchResponse.TryGetProperty("hitsContainers", out var containers))
                    {
                        foreach (var container in containers.EnumerateArray())
                        {
                            if (container.TryGetProperty("hits", out var hits))
                            {
                                foreach (var hit in hits.EnumerateArray())
                                {
                                    var result = new Dictionary<string, object?>();

                                    if (hit.TryGetProperty("resource", out var resource))
                                    {
                                        // Get title first (for pages), fall back to name
                                        var displayName = resource.TryGetProperty("title", out var titleElem) && !string.IsNullOrEmpty(titleElem.GetString())
                                            ? titleElem.GetString()
                                            : (resource.TryGetProperty("name", out var nameElem) ? nameElem.GetString() : "Unknown");

                                        result["Title"] = displayName;
                                        result["Name"] = resource.TryGetProperty("name", out var name) ? name.GetString() : "Unknown";
                                        result["WebUrl"] = resource.TryGetProperty("webUrl", out var webUrl) ? webUrl.GetString() : null;
                                        result["Modified"] = resource.TryGetProperty("lastModifiedDateTime", out var modified)
                                            ? modified.GetDateTime().ToString("yyyy-MM-dd HH:mm")
                                            : "Unknown";

                                        // Determine content type
                                        if (resource.TryGetProperty("contentclass", out var contentClass))
                                        {
                                            result["ContentType"] = contentClass.GetString();
                                        }

                                        if (resource.TryGetProperty("parentReference", out var parent))
                                        {
                                            if (parent.TryGetProperty("siteId", out var siteIdElem))
                                            {
                                                result["SiteId"] = siteIdElem.GetString();
                                            }
                                            // Get site name from the URL
                                            if (result["WebUrl"] != null)
                                            {
                                                var url = result["WebUrl"]?.ToString() ?? "";
                                                if (url.Contains("/sites/"))
                                                {
                                                    var sitePart = url.Split("/sites/").LastOrDefault()?.Split('/').FirstOrDefault();
                                                    if (!string.IsNullOrEmpty(sitePart))
                                                    {
                                                        result["Site"] = sitePart;
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    if (hit.TryGetProperty("summary", out var summary))
                                    {
                                        // Clean up the summary (remove HTML tags if any)
                                        var summaryText = summary.GetString() ?? "";
                                        summaryText = System.Text.RegularExpressions.Regex.Replace(summaryText, "<[^>]+>", " ");
                                        summaryText = System.Net.WebUtility.HtmlDecode(summaryText);
                                        summaryText = System.Text.RegularExpressions.Regex.Replace(summaryText, @"\s+", " ").Trim();
                                        result["Summary"] = summaryText;
                                    }

                                    results.Add(result);
                                }
                            }
                        }
                    }
                }
            }

            if (results.Count == 0)
            {
                return "No results found across SharePoint sites.";
            }

            // Register citations for search results that the LLM will use
            if (this._citationService != null)
            {
                foreach (var r in results)
                {
                    if (r is Dictionary<string, object?> dict)
                    {
                        var docTitle = dict.TryGetValue("Title", out var t) ? t?.ToString() : null;
                        var webUrl = dict.TryGetValue("WebUrl", out var u) ? u?.ToString() : "";
                        var summary = dict.TryGetValue("Summary", out var s) ? s?.ToString() : "";

                        if (!string.IsNullOrEmpty(docTitle))
                        {
                            this._citationService.AddCitation(
                                documentTitle: docTitle,
                                source: webUrl ?? "",
                                snippet: summary ?? "",
                                relevanceScore: 0.8,
                                sourceType: "SharePoint"
                            );
                        }
                    }
                }
            }

            return JsonSerializer.Serialize(results, new JsonSerializerOptions { WriteIndented = true });
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error searching across SharePoint sites");
            return $"Error searching: {ex.Message}";
        }
    }

    /// <summary>
    /// Searches for SharePoint pages (news articles, wiki pages, etc.) by title or content.
    /// </summary>
    [KernelFunction, Description("Søk etter SharePoint-sider (nyhetsartiklar, wiki-sider) etter tittel eller nøkkelord. Bruk dette for å finne spesifikke sider når SearchAcrossSitesAsync gir for mange resultat. Søkjer i konfigurerte SharePoint-nettstader.")]
    public async Task<string> SearchPagesAsync(
        [Description("Search keywords or title to find pages")] string query,
        [Description("Maximum number of results to return (default: 10)")] int maxResults = 10,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return "Please provide a search query.";
        }

        this._logger.LogInformation("SharePoint: Searching for pages with query '{Query}'", query);

        try
        {
            var accessToken = await this.GetOboAccessTokenAsync(cancellationToken);

            using var client = this._httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            // Build site filter if AllowedSites is configured
            var siteFilter = BuildSiteFilter();

            // Use the search API specifically for SharePoint pages
            // contentclass:STS_Site_Page filters for SharePoint pages
            var queryString = string.IsNullOrEmpty(siteFilter)
                ? $"{query} contentclass:STS_Site_Page"
                : $"{query} contentclass:STS_Site_Page {siteFilter}";

            var searchRequest = new
            {
                requests = new[]
                {
                    new
                    {
                        entityTypes = new[] { "listItem" },
                        query = new { queryString = queryString },
                        from = 0,
                        size = maxResults,
                        fields = new[] { "id", "name", "title", "webUrl", "lastModifiedDateTime", "createdBy", "summary", "path" }
                    }
                }
            };

            var searchUrl = $"{GraphApiBaseUrl}/search/query";
            var jsonContent = new StringContent(
                JsonSerializer.Serialize(searchRequest),
                System.Text.Encoding.UTF8,
                "application/json");

            var response = await client.PostAsync(searchUrl, jsonContent, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                this._logger.LogWarning("SharePoint page search failed: {StatusCode} - {Error}", response.StatusCode, error);
                return $"Search failed: {response.StatusCode}";
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(content);

            var results = new List<object>();

            if (doc.RootElement.TryGetProperty("value", out var valueArray))
            {
                foreach (var searchResponse in valueArray.EnumerateArray())
                {
                    if (searchResponse.TryGetProperty("hitsContainers", out var containers))
                    {
                        foreach (var container in containers.EnumerateArray())
                        {
                            if (container.TryGetProperty("hits", out var hits))
                            {
                                foreach (var hit in hits.EnumerateArray())
                                {
                                    var result = new Dictionary<string, object?>();

                                    if (hit.TryGetProperty("resource", out var resource))
                                    {
                                        result["Title"] = resource.TryGetProperty("title", out var title) ? title.GetString() :
                                            (resource.TryGetProperty("name", out var name) ? name.GetString() : "Unknown");
                                        result["WebUrl"] = resource.TryGetProperty("webUrl", out var webUrl) ? webUrl.GetString() : null;
                                        result["Modified"] = resource.TryGetProperty("lastModifiedDateTime", out var modified)
                                            ? modified.GetDateTime().ToString("yyyy-MM-dd HH:mm")
                                            : "Unknown";

                                        // Extract site name from URL
                                        var url = result["WebUrl"]?.ToString() ?? "";
                                        if (url.Contains("/sites/"))
                                        {
                                            var sitePart = url.Split("/sites/").LastOrDefault()?.Split('/').FirstOrDefault();
                                            if (!string.IsNullOrEmpty(sitePart))
                                            {
                                                result["Site"] = sitePart;
                                            }
                                        }
                                    }

                                    if (hit.TryGetProperty("summary", out var summary))
                                    {
                                        var summaryText = summary.GetString() ?? "";
                                        summaryText = System.Text.RegularExpressions.Regex.Replace(summaryText, "<[^>]+>", " ");
                                        summaryText = System.Net.WebUtility.HtmlDecode(summaryText);
                                        summaryText = System.Text.RegularExpressions.Regex.Replace(summaryText, @"\s+", " ").Trim();
                                        result["Summary"] = summaryText;
                                    }

                                    results.Add(result);
                                }
                            }
                        }
                    }
                }
            }

            if (results.Count == 0)
            {
                return $"No SharePoint pages found matching '{query}'. Try different keywords or use SearchAcrossSitesAsync for broader search.";
            }

            return JsonSerializer.Serialize(results, new JsonSerializerOptions { WriteIndented = true });
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error searching SharePoint pages");
            return $"Error searching pages: {ex.Message}";
        }
    }

    /// <summary>
    /// Gets the content of a SharePoint page (not a document).
    /// </summary>
    [KernelFunction, Description("Les innhaldet på ei SharePoint-side eller nyhetsartikkel. Bruk dette for å hente heile teksten på ei side. Du kan oppgje full side-URL eller berre sidetittelen for å søkje.")]
    public async Task<string> GetPageContentAsync(
        [Description("The page URL, page ID, or page title to search for")] string pageIdOrUrl,
        [Description("Optional: Site URL if the page is not in the default site (e.g., 'https://vlfksky.sharepoint.com/sites/HR-kvalitet-HMS')")] string siteUrlOrId = "",
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(pageIdOrUrl))
        {
            return "Please provide a page URL, ID, or title.";
        }

        this._logger.LogInformation("SharePoint: Getting page content for '{Page}'", pageIdOrUrl);

        try
        {
            var accessToken = await this.GetOboAccessTokenAsync(cancellationToken);

            using var client = this._httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            // Determine which site to use
            string siteId;
            string? extractedSiteUrl = null;

            // If the page URL contains /sites/, extract the site URL from it
            if (pageIdOrUrl.StartsWith("http") && pageIdOrUrl.Contains("/sites/"))
            {
                var pageUri = new Uri(pageIdOrUrl);
                var pathParts = pageUri.AbsolutePath.Split('/');
                var sitesIndex = Array.IndexOf(pathParts, "sites");
                if (sitesIndex >= 0 && sitesIndex + 1 < pathParts.Length)
                {
                    extractedSiteUrl = $"https://{pageUri.Host}/sites/{pathParts[sitesIndex + 1]}";
                    this._logger.LogInformation("SharePoint: Extracted site URL from page URL: {SiteUrl}", extractedSiteUrl);
                }
            }

            // Use extracted site URL if available, otherwise use provided siteUrlOrId
            var effectiveSiteUrl = extractedSiteUrl ?? siteUrlOrId;

            if (string.IsNullOrWhiteSpace(effectiveSiteUrl))
            {
                siteId = await this.GetSiteIdAsync(accessToken, cancellationToken);
            }
            else if (effectiveSiteUrl.StartsWith("http"))
            {
                var siteUrl = new Uri(effectiveSiteUrl);
                var hostname = siteUrl.Host;
                var sitePath = siteUrl.AbsolutePath.TrimEnd('/');
                var siteEndpoint = $"{GraphApiBaseUrl}/sites/{hostname}:{sitePath}";
                this._logger.LogInformation("SharePoint: Resolving site at {Endpoint}", siteEndpoint);
                var siteResponse = await client.GetAsync(siteEndpoint, cancellationToken);
                if (!siteResponse.IsSuccessStatusCode)
                {
                    var siteError = await siteResponse.Content.ReadAsStringAsync(cancellationToken);
                    this._logger.LogWarning("SharePoint: Could not resolve site: {StatusCode} - {Error}", siteResponse.StatusCode, siteError);
                    return $"Could not access site: {effectiveSiteUrl}. Error: {siteResponse.StatusCode}";
                }
                var siteContent = await siteResponse.Content.ReadAsStringAsync(cancellationToken);
                using var siteDoc = JsonDocument.Parse(siteContent);
                siteId = siteDoc.RootElement.GetProperty("id").GetString()!;
                this._logger.LogInformation("SharePoint: Resolved site ID: {SiteId}", siteId);
            }
            else
            {
                siteId = effectiveSiteUrl;
            }

            // Get page content
            string? pageId = null;
            if (pageIdOrUrl.StartsWith("http"))
            {
                // Extract page name from URL
                var pageUri = new Uri(pageIdOrUrl);
                var pageName = pageUri.Segments.Last();
                // URL decode the page name
                pageName = Uri.UnescapeDataString(pageName);
                this._logger.LogInformation("SharePoint: Looking for page with name '{PageName}'", pageName);

                // First try to find by exact name
                var searchUrl = $"{GraphApiBaseUrl}/sites/{siteId}/pages?$filter=name eq '{pageName}'&$select=id,name,title";
                var searchResponse = await client.GetAsync(searchUrl, cancellationToken);

                if (searchResponse.IsSuccessStatusCode)
                {
                    var searchContent = await searchResponse.Content.ReadAsStringAsync(cancellationToken);
                    using var searchDoc = JsonDocument.Parse(searchContent);
                    if (searchDoc.RootElement.TryGetProperty("value", out var pages) && pages.GetArrayLength() > 0)
                    {
                        pageId = pages[0].GetProperty("id").GetString()!;
                    }
                }

                // If not found, try without URL encoding issues
                if (pageId == null && pageName.EndsWith(".aspx"))
                {
                    // Try listing all pages and matching
                    var listUrl = $"{GraphApiBaseUrl}/sites/{siteId}/pages?$select=id,name,title&$top=100";
                    var listResponse = await client.GetAsync(listUrl, cancellationToken);
                    if (listResponse.IsSuccessStatusCode)
                    {
                        var listContent = await listResponse.Content.ReadAsStringAsync(cancellationToken);
                        using var listDoc = JsonDocument.Parse(listContent);
                        if (listDoc.RootElement.TryGetProperty("value", out var allPages))
                        {
                            foreach (var page in allPages.EnumerateArray())
                            {
                                var name = page.GetProperty("name").GetString() ?? "";
                                // Compare URL-decoded names
                                if (Uri.UnescapeDataString(name).Equals(pageName, StringComparison.OrdinalIgnoreCase))
                                {
                                    pageId = page.GetProperty("id").GetString()!;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            else if (!Guid.TryParse(pageIdOrUrl, out _))
            {
                // It's not a URL and not a GUID, so assume it's a title/search term
                this._logger.LogInformation("SharePoint: Searching for page with title containing '{Title}'", pageIdOrUrl);

                // Search for pages containing the search term in title
                var listUrl = $"{GraphApiBaseUrl}/sites/{siteId}/pages?$select=id,name,title&$top=50";
                var listResponse = await client.GetAsync(listUrl, cancellationToken);
                if (listResponse.IsSuccessStatusCode)
                {
                    var listContent = await listResponse.Content.ReadAsStringAsync(cancellationToken);
                    using var listDoc = JsonDocument.Parse(listContent);
                    if (listDoc.RootElement.TryGetProperty("value", out var allPages))
                    {
                        var searchTerm = pageIdOrUrl.ToLowerInvariant();
                        foreach (var page in allPages.EnumerateArray())
                        {
                            var pageTitle = page.TryGetProperty("title", out var pageTitleElem) ? pageTitleElem.GetString() ?? "" : "";
                            if (pageTitle.ToLowerInvariant().Contains(searchTerm))
                            {
                                pageId = page.GetProperty("id").GetString()!;
                                this._logger.LogInformation("SharePoint: Found page '{Title}' matching search term", pageTitle);
                                break;
                            }
                        }
                    }
                }

                if (pageId == null)
                {
                    return $"No page found with title containing '{pageIdOrUrl}' in this site. Try using SearchAcrossSitesAsync to find which site contains the page, or provide the site URL.";
                }
            }
            else
            {
                pageId = pageIdOrUrl;
            }

            if (pageId == null)
            {
                return "Page not found. The page may not exist, or you may need to specify the correct site URL. Tip: Use SearchAcrossSitesAsync to search across all sites first.";
            }

            // Get page with web parts content
            var pageUrl = $"{GraphApiBaseUrl}/sites/{siteId}/pages/{pageId}?$expand=canvasLayout";
            var response = await client.GetAsync(pageUrl, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cancellationToken);
                this._logger.LogWarning("SharePoint get page failed: {StatusCode} - {Error}", response.StatusCode, error);
                return $"Failed to get page content: {response.StatusCode}";
            }

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(content);

            var title = doc.RootElement.TryGetProperty("title", out var titleElem) ? titleElem.GetString() : "Untitled";
            var description = doc.RootElement.TryGetProperty("description", out var descElem) ? descElem.GetString() : "";

            // Try to extract text from canvas layout
            var pageText = new System.Text.StringBuilder();
            pageText.AppendLine($"# {title}");
            if (!string.IsNullOrEmpty(description))
            {
                pageText.AppendLine();
                pageText.AppendLine(description);
            }

            // The canvas layout contains the actual page content
            if (doc.RootElement.TryGetProperty("canvasLayout", out var canvas))
            {
                pageText.AppendLine();
                pageText.AppendLine("---");

                // Extract text from web parts
                if (canvas.TryGetProperty("horizontalSections", out var sections))
                {
                    foreach (var section in sections.EnumerateArray())
                    {
                        if (section.TryGetProperty("columns", out var columns))
                        {
                            foreach (var column in columns.EnumerateArray())
                            {
                                if (column.TryGetProperty("webparts", out var webparts))
                                {
                                    foreach (var webpart in webparts.EnumerateArray())
                                    {
                                        if (webpart.TryGetProperty("innerHtml", out var html))
                                        {
                                            // Simple HTML to text conversion
                                            var htmlText = html.GetString() ?? "";
                                            // Remove HTML tags (basic)
                                            htmlText = System.Text.RegularExpressions.Regex.Replace(htmlText, "<[^>]+>", " ");
                                            htmlText = System.Net.WebUtility.HtmlDecode(htmlText);
                                            htmlText = System.Text.RegularExpressions.Regex.Replace(htmlText, @"\s+", " ").Trim();

                                            if (!string.IsNullOrWhiteSpace(htmlText))
                                            {
                                                pageText.AppendLine(htmlText);
                                                pageText.AppendLine();
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            var result = pageText.ToString().Trim();
            if (result.Length < 50)
            {
                return $"Page '{title}' was found but has minimal text content. Description: {description}";
            }

            // Register citation for display in the UI
            if (this._citationService != null)
            {
                var snippet = result.Length > 500 ? result.Substring(0, 500) + "..." : result;
                this._citationService.AddCitation(
                    documentTitle: title ?? "SharePoint-side",
                    source: pageIdOrUrl.StartsWith("http") ? pageIdOrUrl : "",
                    snippet: snippet,
                    relevanceScore: 1.0,
                    sourceType: "SharePoint"
                );
            }

            return result;
        }
        catch (Exception ex)
        {
            this._logger.LogError(ex, "Error getting SharePoint page content");
            return $"Error getting page content: {ex.Message}";
        }
    }

    /// <summary>
    /// Gets an access token for Microsoft Graph using the OBO flow.
    /// </summary>
    private async Task<string> GetOboAccessTokenAsync(CancellationToken cancellationToken)
    {
        using var client = this._httpClientFactory.CreateClient();

        var tokenEndpoint = $"{this._options.Authority}/{this._options.TenantId}/oauth2/v2.0/token";

        var requestBody = new Dictionary<string, string>
        {
            ["grant_type"] = "urn:ietf:params:oauth:grant-type:jwt-bearer",
            ["client_id"] = this._options.ClientId!,
            ["client_secret"] = this._options.ClientSecret!,
            ["assertion"] = this._bearerToken,
            ["scope"] = this._options.DefaultScopes,
            ["requested_token_use"] = "on_behalf_of"
        };

        var response = await client.PostAsync(
            tokenEndpoint,
            new FormUrlEncodedContent(requestBody),
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(cancellationToken);
            this._logger.LogError("OBO token exchange failed: {StatusCode} - {Error}", response.StatusCode, error);
            throw new HttpRequestException($"Failed to get OBO access token: {response.StatusCode}");
        }

        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(content);

        if (doc.RootElement.TryGetProperty("access_token", out var tokenElement))
        {
            return tokenElement.GetString() ?? throw new InvalidOperationException("Access token was null");
        }

        throw new InvalidOperationException("No access token in response");
    }

    /// <summary>
    /// Gets the SharePoint site ID from the configured site URL.
    /// </summary>
    private async Task<string> GetSiteIdAsync(string accessToken, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrEmpty(this._siteId))
        {
            return this._siteId;
        }

        var siteUrl = new Uri(this._options.SiteUrl!);
        var hostname = siteUrl.Host;
        var sitePath = siteUrl.AbsolutePath;

        using var client = this._httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var siteEndpoint = $"{GraphApiBaseUrl}/sites/{hostname}:{sitePath}";
        var response = await client.GetAsync(siteEndpoint, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(cancellationToken);
            this._logger.LogError("Failed to get site ID: {StatusCode} - {Error}", response.StatusCode, error);
            throw new HttpRequestException($"Failed to get SharePoint site: {response.StatusCode}");
        }

        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(content);

        if (doc.RootElement.TryGetProperty("id", out var idElement))
        {
            this._siteId = idElement.GetString();
            this._logger.LogInformation("Resolved SharePoint site ID: {SiteId}", this._siteId);
            return this._siteId ?? throw new InvalidOperationException("Site ID was null");
        }

        throw new InvalidOperationException("Could not resolve SharePoint site ID");
    }

    /// <summary>
    /// Formats a file size in bytes to a human-readable string.
    /// </summary>
    private static string FormatFileSize(long? bytes)
    {
        if (bytes == null || bytes == 0)
        {
            return "0 B";
        }

        string[] sizes = { "B", "KB", "MB", "GB" };
        int order = 0;
        double size = bytes.Value;

        while (size >= 1024 && order < sizes.Length - 1)
        {
            order++;
            size /= 1024;
        }

        return $"{size:0.##} {sizes[order]}";
    }

    /// <summary>
    /// Builds a site filter for the search query based on AllowedSites configuration.
    /// </summary>
    private string BuildSiteFilter()
    {
        if (this._options.AllowedSites == null || this._options.AllowedSites.Count == 0)
        {
            return string.Empty;
        }

        // Build a KQL filter to restrict search to allowed sites
        // Format: (path:site1 OR path:site2)
        var siteFilters = this._options.AllowedSites
            .Select(site => $"path:\"{site}\"")
            .ToList();

        return $"({string.Join(" OR ", siteFilters)})";
    }

    #region Graph API Response Models

    private sealed class GraphSearchResponse
    {
        [JsonPropertyName("value")]
        public List<DriveItem>? Value { get; set; }
    }

    private sealed class GraphSitesResponse
    {
        [JsonPropertyName("value")]
        public List<SiteInfo>? Value { get; set; }
    }

    private sealed class SiteInfo
    {
        [JsonPropertyName("id")]
        public string? Id { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("displayName")]
        public string? DisplayName { get; set; }

        [JsonPropertyName("webUrl")]
        public string? WebUrl { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }
    }

    private sealed class GraphPagesResponse
    {
        [JsonPropertyName("value")]
        public List<PageInfo>? Value { get; set; }
    }

    private sealed class PageInfo
    {
        [JsonPropertyName("id")]
        public string? Id { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("title")]
        public string? Title { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }

        [JsonPropertyName("webUrl")]
        public string? WebUrl { get; set; }

        [JsonPropertyName("createdDateTime")]
        public DateTime? CreatedDateTime { get; set; }

        [JsonPropertyName("lastModifiedDateTime")]
        public DateTime? LastModifiedDateTime { get; set; }

        [JsonPropertyName("createdBy")]
        public IdentitySet? CreatedBy { get; set; }

        [JsonPropertyName("lastModifiedBy")]
        public IdentitySet? LastModifiedBy { get; set; }
    }

    private sealed class DriveItem
    {
        [JsonPropertyName("id")]
        public string? Id { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("webUrl")]
        public string? WebUrl { get; set; }

        [JsonPropertyName("size")]
        public long? Size { get; set; }

        [JsonPropertyName("lastModifiedDateTime")]
        public DateTime? LastModifiedDateTime { get; set; }

        [JsonPropertyName("createdDateTime")]
        public DateTime? CreatedDateTime { get; set; }

        [JsonPropertyName("file")]
        public FileInfo? File { get; set; }

        [JsonPropertyName("folder")]
        public FolderInfo? Folder { get; set; }

        [JsonPropertyName("parentReference")]
        public ParentReference? ParentReference { get; set; }

        [JsonPropertyName("createdBy")]
        public IdentitySet? CreatedBy { get; set; }

        [JsonPropertyName("lastModifiedBy")]
        public IdentitySet? LastModifiedBy { get; set; }
    }

    private sealed class FileInfo
    {
        [JsonPropertyName("mimeType")]
        public string? MimeType { get; set; }
    }

    private sealed class FolderInfo
    {
        [JsonPropertyName("childCount")]
        public int? ChildCount { get; set; }
    }

    private sealed class ParentReference
    {
        [JsonPropertyName("path")]
        public string? Path { get; set; }

        [JsonPropertyName("driveId")]
        public string? DriveId { get; set; }
    }

    private sealed class IdentitySet
    {
        [JsonPropertyName("user")]
        public UserIdentity? User { get; set; }
    }

    private sealed class UserIdentity
    {
        [JsonPropertyName("displayName")]
        public string? DisplayName { get; set; }

        [JsonPropertyName("email")]
        public string? Email { get; set; }
    }

    #endregion
}
