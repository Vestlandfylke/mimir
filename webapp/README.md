# Mimir Frontend

React-basert webgrensesnitt for Mimir, bygd med Fluent UI React Components.

## Funksjonar

- Chat med streaming-respons via SignalR
- Fleirmodellval (GPT-5.2, GPT-5 Mini, Claude, m.fl.)
- Assistentmalar med tilgangskontroll
- Plugin-sitat med kjeldetype og fargekoda merkelappar
- Filgenerering og filhandtering ("Mine filer"-panel)
- Dokumentopplasting med drag-and-drop
- Mermaid-diagram med nedlasting og redigering
- Kodeblokker med syntax highlighting og kopier-knapp
- LaTeX/KaTeX-matematikk
- Samtalearkiv ("Papirkorg") med gjenoppretting
- Mørk modus
- Azure AD og Teams SSO-autentisering
- Token-basert filnedlasting for mobil/Teams

## Kjøre lokalt

### Krav

- [Node.js 18+](https://nodejs.org/)
- [Yarn](https://yarnpkg.com/)

### Setup

```bash
# Installer avhengigheiter
yarn install

# Start utviklingsserver
yarn start
```

Frontend køyrer på `http://localhost:3000`.

### Kommandoar

```bash
yarn start       # Utviklingsserver
yarn build       # Produksjonsbygg
yarn lint        # Sjekk linting
yarn lint --fix  # Fiks linting
yarn format      # Formater kode
yarn test        # Køyr testar
```

## Konfigurasjon

Frontend hentar konfigurasjon frå backend via `/authConfig`. For lokal utvikling, opprett `.env.local`:

```env
REACT_APP_BACKEND_URI=https://localhost:40443
```

## Mappestruktur

```
webapp/src/
├── components/
│   ├── chat/                # Chat-UI
│   │   ├── chat-history/    # Meldingsvisning, sitat, kodeblokker, diagram
│   │   ├── chat-list/       # Samtaleliste
│   │   └── controls/        # Input, modelval, diagramval
│   ├── files/               # Filhandtering (FileManagementModal)
│   ├── header/              # Toppmeny, brukarinnstillingar
│   ├── shared/              # Delte komponentar
│   └── views/               # Hovudsider (ChatView, Login)
├── libs/
│   ├── hooks/               # Custom React hooks
│   ├── models/              # TypeScript-modellar (ChatMessage, Citation)
│   ├── services/            # API-klientar (ChatService, FileService)
│   └── auth/                # Autentiseringslogikk
├── redux/
│   ├── features/app/        # App-tilstand, feature flags
│   ├── features/conversations/  # Samtaledata
│   └── features/message-relay/  # SignalR-tilkopling
└── styles/                  # Fluent UI-stilar
```

## Viktige komponentar

### Plugin-sitat (CitationCards)

Viser kjelder nederst i meldingar med fargekoda merkelappar per kjeldetype:
- Kunnskapsbase, Leiardokument, Lovdata, SharePoint, Opplasta dokument

### Filhandtering (FileManagementModal)

"Mine filer"-panel som viser genererte filer med nedlasting og sletting. Støttar:
- Standard blob-nedlasting for desktop
- Token-basert `window.open()` for mobil/Teams (omgår WebView-avgrensingar)

### Mermaid-diagram (MermaidBlock)

Renderar diagram direkte i chatten med:
- Nedlasting som JPG
- Fullskjerm-visning og redigering

### SignalR-meldingsrelay

Sanntidsoppdateringar via SignalR inkludert:
- Streaming av svar
- Oppdatering av sitat etter plugin-kall
- Reasoning-visning for resonneringsmodellar

## Autentisering

- **Redirect** — standard for nettlesar
- **Popup** — for Teams og iframe-miljø (auto-detektert)

Sjå `libs/auth/AuthHelper.ts` og `libs/utils/EmbeddedAppHelper.ts`.

## Testing

```bash
# Unit-testar (Jest)
yarn test

# E2E-testar (Playwright)
yarn playwright install
yarn test:e2e
```

Sjå [tests/README.md](tests/README.md) for meir.

## Deployment

Frontend byggast og kopierast til `webapi/wwwroot/` under deployment:

```bash
yarn install --frozen-lockfile
yarn build
# Output: build/ → webapi/wwwroot/
```

Sjå [../scripts/deploy/README.md](../scripts/deploy/README.md).
