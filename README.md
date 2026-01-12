# Mimir - AI-assistent for Vestland Fylkeskommune

> Ein intelligent AI-assistent utvikla for Vestland fylkeskommune, kalla Mimir etter visdommens gud i norrøn mytologi.

## Om Mimir

Mimir er ein avansert chatbot bygd på Microsoft Semantic Kernel og Azure OpenAI, med integrasjon av Model Context Protocol (MCP) for utvida funksjonalitet.

### Hovudfunksjonar

- 🤖 **Intelligent chat** med kontekstforståing og langtidsminne
- 📄 **Dokumentanalyse** med semantisk søk i opplasta dokument
- 📌 **Festa dokument** som alltid er i kontekst
- 📥 **Filgenerering** - Lag nedlastbare Word, Excel, PowerPoint, PDF, Markdown og tekstfiler
- 📊 **Mermaid-diagram** - Visualiser flowcharts, sekvensdiagram, ER-diagram direkte i chatten
- 💻 **Kodeblokker** - Syntax highlighting, linjenummer og kopier-knapp
- 🔢 **Matematikkstøtte** med KaTeX-rendering
- 🌍 **Nynorsk-lokalisering** for god brukaropplevlng
- 🔧 **13 MCP-verktøy** via FastMCP server:
  - Klarspråk-analyse og forbetering
  - Tekstforenkling og kvalitetsvurdering
  - Søk i retningslinjer og terminologi
  - Dokumentformatering
  - Skriveråd og prinsippforklaringar

### Nye Funksjonar (2025/2026)

- ✅ **Modelval per chat** - Vel mellom GPT-4o, GPT-4o-mini og GPT-5.2 Reasoning for kvar samtale
- ✅ **Reasoning/tankeprosess** - Vis AI-ens tankeprosess for modellar som støttar det
- ✅ **Mørk modus** - Full støtte for mørk modus, inkludert diagram
- ✅ **GitHub Actions deployment** - Automatisk deployment til Azure
- ✅ **MCP Bridge** - Container App for MCP-verktøy
- ✅ **Fast model** - gpt-4o-mini for rask intent-ekstraksjon
- ✅ **Teams-støtte** - Fungerer i Microsoft Teams og andre iframe-appliksjonar
- ✅ **Pinned documents** - Fest dokument som alltid skal vere i kontekst

## Kom i gang

### For brukarar

Sjå [FAQ_MIMIR.md](FAQ_MIMIR.md) for brukarrettleiing.

### For utviklarar

#### Krav

- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 18+](https://nodejs.org/) og Yarn
- [Azure OpenAI](https://aka.ms/oai/access) ressurs
- [Python 3.11+](https://www.python.org/) (for MCP Bridge)

#### Lokal utvikling

**Alternativ 1: Start alt med éin kommando**
```powershell
.\scripts\Start.ps1
```
Dette startar:
- MCP Bridge (Python FastAPI)
- Backend WebAPI (.NET 8)
- Frontend (React)

**Alternativ 2: Start komponentar separat**
```powershell
# Backend
.\scripts\Start-Backend.ps1

# Frontend (i nytt terminalvindauge)
.\scripts\Start-Frontend.ps1

# MCP Bridge (i nytt terminalvindauge)
.\scripts\Start-Bridge.ps1
```

Se [scripts/README.md](scripts/README.md) for meir informasjon.

#### Konfigurasjon

1. Kopier `webapi/appsettings.json` til `webapi/appsettings.Development.json`
2. Oppdater Azure OpenAI konfigurasjon:
   ```json
   {
     "AzureOpenAI": {
       "Endpoint": "https://your-resource.openai.azure.com",
       "ChatDeploymentName": "gpt-4o",
       "EmbeddingDeploymentName": "text-embedding-ada-002"
     }
   }
   ```
3. Legg til API-nøkkel:
   ```bash
   cd webapi
   dotnet user-secrets set "AzureOpenAI:Key" "YOUR_KEY_HERE"
   ```

## Deployment til Azure

Applikasjonen bruker GitHub Actions for automatisk deployment.

### Setup

Sjå [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md) for komplett guide.

### Quick start

1. **Konfigurer GitHub Secrets** (4 stk)
   - `AZURE_OPENAI_API_KEY`
   - (3 andre for Service Principal)

2. **Konfigurer GitHub Variables** (~17 stk)
   - `CC_DEPLOYMENT_GROUP_NAME`
   - `AZURE_OPENAI_ENDPOINT`
   - osv.

3. **Push til main**
   ```bash
   git push origin main
   ```
   GitHub Actions deployer automatisk! 🚀

## Arkitektur

### Komponentar

| Komponent | Teknologi | Beskrivelse |
|-----------|-----------|-------------|
| **Frontend** | React + Fluent UI | Webgrensesnitt |
| **Backend** | .NET 8 + Semantic Kernel | API og orkestrering |
| **Memorypipeline** | .NET 8 + Kernel Memory | Dokumentprosessering |
| **MCP Bridge** | Python + FastAPI | MCP-verktøy og klarspråk |
| **Database** | Azure Cosmos DB | Chat-historikk og dokument |
| **Search** | Azure AI Search | Semantisk søk i dokument |
| **AI** | Azure OpenAI | Språkmodellar (GPT-4o, etc.) |

### Azure-ressursar

- **App Service**: Backend (WebAPI + Frontend) og Memorypipeline
- **Container App**: MCP Bridge
- **Cosmos DB**: Chat-data, dokument, metadata
- **Azure AI Search**: Vektor-indeks for semantisk søk
- **Azure OpenAI**: GPT-4o, text-embedding-ada-002
- **Application Insights**: Telemetri og logging

## Dokumentasjon

- [FAQ_MIMIR.md](FAQ_MIMIR.md) - Brukarrettleiing
- [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md) - Deployment-setup
- [DEPLOY_NOW.md](DEPLOY_NOW.md) - Quick deploy guide
- [webapi/MCP_INTEGRATION_GUIDE.md](webapi/MCP_INTEGRATION_GUIDE.md) - MCP-integrasjon
- [scripts/README.md](scripts/README.md) - Lokal utvikling

## Bidra

Dette er eit internt prosjekt for Vestland Fylkeskommune. For spørsmål eller support, kontakt:

- Digitalisering - KI & teknologiutvikling

## Lisens

Sjå [LICENSE](LICENSE) for detaljar.

---

**Basert på:** [microsoft/chat-copilot](https://github.com/microsoft/chat-copilot)
