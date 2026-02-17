# Mimir Scripts

Skript for å starte, stoppe og konfigurere Mimir lokalt.

## Hurtigstart

```powershell
# Start alle tenester
.\scripts\Start.ps1

# Stopp alle tenester
.\scripts\Stop.ps1
```

Dette startar tre tenester i rekkefølgje:

1. **MCP Bridge** (http://localhost:8000)
2. **Backend** (https://localhost:40443)
3. **Frontend** (http://localhost:3000)

## Enkelttenester

```powershell
.\scripts\Start-Bridge.ps1    # Berre MCP Bridge
.\scripts\Start-Backend.ps1   # Berre backend
.\scripts\Start-Frontend.ps1  # Berre frontend
```

## Konfigurasjon

```powershell
# Azure OpenAI
.\Configure.ps1 -AIService AzureOpenAI -APIKey {KEY} -Endpoint {ENDPOINT}

# Med autentisering
.\Configure.ps1 -AIService AzureOpenAI -APIKey {KEY} -Endpoint {ENDPOINT} `
  -FrontendClientId {FRONTEND_ID} -BackendClientId {BACKEND_ID} -TenantId {TENANT_ID}

# Med eigendefinerte modellnamn
.\Configure.ps1 -AIService AzureOpenAI -APIKey {KEY} -Endpoint {ENDPOINT} `
  -CompletionModel gpt-5.2-chat -EmbeddingModel text-embedding-ada-002
```

### Linux/macOS

```bash
./configure.sh --aiservice AzureOpenAI --apikey {KEY} --endpoint {ENDPOINT}
./start.sh
```

## Installer avhengigheiter

```powershell
.\Install.ps1           # Windows (Chocolatey)
./install-apt.sh        # Ubuntu/Debian
./install-brew.sh       # macOS
```

Installerer .NET 10 SDK, Node.js og Yarn.

## Verifiser oppsett

```powershell
.\verify-setup.ps1      # Windows
./verify-setup.sh       # Linux/macOS
```

## Teneste-URLar

| Teneste | URL | Skildring |
|---------|-----|-----------|
| Frontend | http://localhost:3000 | React webgrensesnitt |
| Backend | https://localhost:40443 | REST API |
| MCP Bridge | http://localhost:8000 | MCP-protokollomsetting |

## MCP Bridge

Brua omset mellom FastMCP Streamable HTTP og standard MCP JSON-RPC.

- `/mcp` — MCP JSON-RPC endpoint (brukt av backend)
- `/health` — Health check

### Endre port

```powershell
$env:BRIDGE_PORT = "9000"
.\Start-Bridge.ps1
```

### Endre FastMCP-server URL

```powershell
$env:FASTMCP_SERVER_URL = "https://din-server.azurecontainerapps.io"
.\Start-Bridge.ps1
```

## Manuell utvikling (separate terminalar)

```powershell
# Terminal 1
cd mcp-bridge && python bridge.py

# Terminal 2
cd webapi && dotnet run

# Terminal 3
cd webapp && yarn start
```

## Feilsøking

| Problem | Løysing |
|---------|---------|
| Python ikkje funne | Installer Python 3.11+ og legg til i PATH |
| Port i bruk | Køyr `.\Stop.ps1`, vent, prøv igjen |
| MCP Bridge koplar ikkje til | Sjekk at FastMCP-serveren køyrer og URL er korrekt |
| Backend finn ikkje MCP-verktøy | Sjekk `Enabled: true` og URL i `appsettings.json` |

## Loggar

- **Bridge**: Logg i konsollvindauget
- **Backend**: Konsoll + Application Insights
- **Feillogg**: `scripts/error.log`
