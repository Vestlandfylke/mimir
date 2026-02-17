# Mimir - KI-assistent for Vestland fylkeskommune

Ein konversasjons-KI-assistent bygd på Microsoft [Semantic Kernel](https://github.com/microsoft/semantic-kernel). Prosjektet er ein fork av [microsoft/chat-copilot](https://github.com/microsoft/chat-copilot), utvida av Vestland fylkeskommune med fleirmodellstøtte, assistentmalar, plugin-sitat, filgenerering og meir.

## Funksjonar

- **Fleirmodellval** — GPT-5.2, GPT-5 Mini, Claude Opus 4.5, med fleire
- **Assistentmalar** med rollebasert tilgangskontroll (Azure AD-grupper)
- **Plugin-sitat** — kjeldevisning frå kunnskapsbase, leiardokument, Lovdata og SharePoint
- **Filgenerering** — Word, PowerPoint, Excel, PDF med Vestland-malar
- **SharePoint-søk** med On-Behalf-Of-autentisering
- **Lovdata-oppslag** — norske lover og forskrifter
- **MCP-verktøy** via Model Context Protocol
- **Samtalearkiv** med 180-dagars oppbevaring (mjuk sletting med gjenoppretting)
- **Mermaid-diagram** og **LaTeX/KaTeX**-matematikk
- **Microsoft Teams SSO** og mobilstøtte (token-basert filnedlasting)

## Komponentar

| Komponent | Teknologi | Skildring |
|-----------|-----------|-----------|
| [Frontend](./webapp/) | React + Fluent UI | Webgrensesnitt |
| [Backend](./webapi/) | .NET 10 + Semantic Kernel | REST API |
| [Memory Pipeline](./memorypipeline/) | .NET Worker | Asynkron dokumentprosessering |
| [MCP Bridge](./mcp-bridge/) | Python | Model Context Protocol-bru |

## Hurtigstart (Docker)

```bash
# 1. Klon og naviger
git clone https://github.com/Vestlandfylke/mimir.git
cd mimir

# 2. Kopier miljømal og legg til Azure OpenAI-nøklar
cp .env.example .env
# Rediger .env med AZURE_OPENAI_ENDPOINT og AZURE_OPENAI_API_KEY

# 3. Start alle tenester
docker compose -f docker-compose.dev.yml up --build

# 4. Opne http://localhost:3000
```

Sjå [GETTING_STARTED.md](GETTING_STARTED.md) for detaljar.

## Krav

### Docker (anbefalt)

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Azure OpenAI-ressurs

### Lokal utvikling

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js 18+](https://nodejs.org/)
- [Yarn](https://classic.yarnpkg.com/docs/install)
- [Python 3.11+](https://www.python.org/) (for MCP Bridge)
- Azure OpenAI-ressurs med modell-deployments

### AI-tenester

| Teneste | Krav |
|---------|------|
| Azure OpenAI | Endpoint, API-nøkkel, deployments (`gpt-5.2-chat`, `text-embedding-ada-002`) |
| Azure Anthropic | Endpoint, API-nøkkel (valfritt, for Claude-modellar) |

## Lokal utvikling

### Windows (PowerShell)

```powershell
git clone https://github.com/Vestlandfylke/mimir.git
cd mimir/scripts

# Valfritt: installer avhengigheiter
.\Install.ps1

# Konfigurer AI-teneste
.\Configure.ps1 -AIService AzureOpenAI -APIKey {API_KEY} -Endpoint {ENDPOINT}

# Start alle tenester
.\Start.ps1
```

### Linux / macOS

```bash
git clone https://github.com/Vestlandfylke/mimir.git
cd mimir/scripts

# Konfigurer
./configure.sh --aiservice AzureOpenAI --apikey {API_KEY} --endpoint {ENDPOINT}

# Start
./start.sh
```

### Teneste-URLar

| Teneste | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | https://localhost:40443 |
| MCP Bridge | http://localhost:8000 |

Verifiser med `https://localhost:40443/healthz`.

## Konfigurasjon

### Autentisering (Azure AD)

Krev to app-registreringar (frontend + backend) i Azure AD. Konfigurer med:

```powershell
.\Configure.ps1 -AIService AzureOpenAI -APIKey {KEY} -Endpoint {ENDPOINT} `
  -FrontendClientId {FRONTEND_ID} -BackendClientId {BACKEND_ID} -TenantId {TENANT_ID}
```

### Assistentmalar

Opprett spesialiserte AI-assistentar i `appsettings.json`:

```json
"Prompts": {
  "Templates": {
    "min-assistent": {
      "DisplayName": "Min Assistent",
      "Description": "Skildring vist i UI",
      "Enabled": true,
      "AllowedGroups": ["azure-ad-gruppe-id"],
      "SystemDescription": "Tilpassa systemprompt...",
      "InitialBotMessage": "Velkomstmelding"
    }
  }
}
```

Tomme `AllowedGroups`/`AllowedUsers` gjer assistenten tilgjengeleg for alle.

### Innebygde plugins

| Plugin | Funksjon | Konfigurasjon |
|--------|----------|---------------|
| **SharePointObo** | Søk i SharePoint med brukarens tilgang | `SharePointObo`-seksjon |
| **Lovdata** | Oppslag i norske lover | `Lovdata`-seksjon |
| **LeiarKontekst** | Strategidokument via Azure AI Search | `LeiarKontekst`-seksjon |
| **MimirKnowledge** | Intern kunnskapsbase | `MimirKnowledge`-seksjon |
| **FileGeneration** | Genererer Word/PowerPoint/Excel/PDF | `FileGeneration`-seksjon |

Alle plugins registrerer sitat som visast nederst i svaret med kjeldetype.

### Filgenerering

Mimir genererer Vestland-merka dokument frå malar i `webapi/templates/`:

- **Word** (`word_template.docx`) — rapportar, notat, brev
- **PowerPoint** (`Presentasjon.pptx`) — presentasjonar med layout-gjenkjenning

Genererte filer lagrast i CosmosDB og er tilgjengelege via "Mine filer"-panelet.

### MCP-verktøy

Utvid Mimir med MCP-serverar i `appsettings.json`:

```json
"McpServers": {
  "PlanApprovalMode": "PerServer",
  "Servers": [{
    "Name": "MittVerktøy",
    "Transport": "Http",
    "Url": "http://localhost:8002/mcp",
    "Enabled": true,
    "Templates": ["min-mal"],
    "RequireApproval": true
  }]
}
```

Sjå [plugins/README.md](plugins/README.md) og [mcp-bridge/README.md](mcp-bridge/README.md).

### Samtalearkiv

Sletta samtalar flyttast til "Papirkorg" med 180 dagars oppbevaring:

```json
"ChatArchive": {
  "RetentionDays": 180,
  "CleanupIntervalHours": 24
}
```

### Teams-integrasjon

Mimir støttar Teams SSO og token-basert filnedlasting for mobil:

```json
"Authentication": {
  "AzureAd": {
    "Audience": "api://din-app-id",
    "ApplicationIdUri": "api://mimir.vlfk.no/din-app-id"
  }
}
```

## Deployment

Sjå [scripts/deploy/README.md](scripts/deploy/README.md) for Azure-deployment.

### Azure-ressursar

| Ressurs | Bruk |
|---------|------|
| App Service | Backend API + statisk frontend |
| Cosmos DB | Samtalar, meldingar, arkiv, genererte filer |
| Azure AI Search | Vektorindeks, kunnskapsbase, leiardokument |
| Azure OpenAI | Språkmodellar og embeddings |
| Blob Storage | Dokumentlagring |
| Application Insights | Telemetri og logging |
| Azure Front Door | WAF og global lastbalansering (valfritt) |

## Dokumentasjon

| Dokument | Skildring |
|----------|-----------|
| [GETTING_STARTED.md](GETTING_STARTED.md) | Docker-hurtigstart |
| [FAQ_MIMIR.md](FAQ_MIMIR.md) | Brukarrettleiing |
| [webapi/README.md](webapi/README.md) | Backend-dokumentasjon |
| [webapp/README.md](webapp/README.md) | Frontend-dokumentasjon |
| [scripts/deploy/README.md](scripts/deploy/README.md) | Azure-deployment |
| [mcp-bridge/README.md](mcp-bridge/README.md) | MCP Bridge-oppsett |
| [plugins/README.md](plugins/README.md) | Plugin-konfigurasjon |

## Feilsøking

| Problem | Løysing |
|---------|---------|
| "interaction_in_progress" | Bruk privat nettlesarfane eller tøm credentials |
| SSL/CORS-feil | Gå til `https://localhost:40443/healthz` og aksepter sertifikat |
| Filnedlasting på Teams mobil | Oppdater til siste versjon (token-basert nedlasting) |
| SharePoint BadRequest | Sjekk `AllowedSites` og Graph API-tilgangar |
| Ingen MCP-verktøy | Sjekk at MCP Bridge køyrer og URL i appsettings er korrekt |

## Lisens

Copyright (c) Microsoft Corporation and contributors. Licensed under the [MIT](LICENSE) license.
