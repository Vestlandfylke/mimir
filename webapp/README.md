# Mimir Frontend

React-basert webgrensesnitt for Mimir, bygd med Fluent UI React Components.

## Oversikt

Frontend-en tilbyr:

- 💬 Chat-grensesnitt med streaming-respons
- 📄 Dokumentopplasting og -administrasjon
- 📌 Festa dokument (pinned documents)
- 🔢 Matematikk-rendering med KaTeX
- 📊 **Mermaid-diagram** - Visualiser flowcharts, sekvensdiagram, ER-diagram og meir
- 💻 **Kodeblokker** - Syntax highlighting, linjenummer og kopier-knapp
- 📋 Kopier-knapp på meldingar
- 🎨 Moderne UI med Fluent Design
- 🔐 Azure AD B2C autentisering
- 📱 Teams/iframe-støtte

## Kjøre lokalt

### Krav

- [Node.js 18+](https://nodejs.org/)
- [Yarn](https://yarnpkg.com/)

### Setup

1. **Installer dependencies**

    ```bash
    yarn install
    ```

2. **Start utviklingsserver**
    ```bash
    yarn start
    ```

Frontend køyrer no på `http://localhost:3000`

### Andre kommandoar

```bash
# Bygg for produksjon
yarn build

# Kjør linter
yarn lint

# Kjør formatter
yarn format

# Kjør testar
yarn test
```

## Konfigurasjon

Frontend hentar konfigurasjon frå backend via `/authConfig` endpoint.

### Miljøvariablar (valgfritt)

Opprett `.env.local`:

```env
REACT_APP_BACKEND_URI=https://localhost:40443
```

## Arkitektur

### Mappestruktur

```
webapp/
├── src/
│   ├── components/        # React-komponentar
│   │   ├── chat/         # Chat-UI
│   │   ├── shared/       # Delte komponentar
│   │   └── views/        # Hovudsider
│   ├── libs/
│   │   ├── hooks/        # Custom React hooks
│   │   ├── models/       # TypeScript-modellar
│   │   ├── services/     # API-klientar
│   │   └── utils/        # Hjelpefunksjonar
│   ├── redux/            # Redux state management
│   └── styles/           # Fluent UI styles
├── public/               # Statiske filer
└── tests/                # Playwright E2E-testar
```

### Hovudkomponentar

- **Chat.tsx** - Hovud chat-grensesnitt
- **ChatHistoryItem.tsx** - Enkelt chat-melding
- **DocumentsTab.tsx** - Dokumentadministrasjon
- **PersonaTab.tsx** - Chat-personalisering
- **Login.tsx** - Innloggingsside

## Viktige funksjonar

### Autentisering

Frontend støttar både redirect og popup auth:

- **Redirect** - Standard for nettlesar
- **Popup** - For Teams og andre iframe-miljø

Sjå `libs/utils/EmbeddedAppHelper.ts` for implementasjon.

### Chat-streaming

Meldingar streamast i sanntid via SignalR:

```typescript
connection.on('ReceiveMessage', (message) => {
    // Håndter streaming-melding
});
```

### Dokumentopplasting

Støttar:

- PDF, DOCX, TXT, MD
- Bilete (PNG, JPG, TIFF) med OCR
- Drag-and-drop

### Matematikk-rendering

Bruker KaTeX for LaTeX-syntaks:

```typescript
import 'katex/dist/katex.min.css';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
```

### Mermaid-diagram

Støttar rendering av Mermaid-diagram direkte i chatten:

- Flowcharts, sekvensdiagram, ER-diagram, Gantt-diagram, osv.
- Last ned diagram som JPG med éin klikk
- Bruk `\`\`\`mermaid` code blocks

### Kodeblokker

Avansert kode-visning med:

- **Syntax highlighting** via prism-react-renderer
- **Linjenummer** for enkel navigering
- **Kopier-knapp** for rask kopiering
- Støtte for mange språk: TypeScript, JavaScript, Python, SQL, osv.

## Utvikling

### VS Code

Anbefalt extensions:

- ESLint
- Prettier
- TypeScript and JavaScript Language Features

### Debugging

1. Start backend: `dotnet run` i `webapi/`
2. Start frontend: `yarn start` i `webapp/`
3. Opne `http://localhost:3000` i nettlesar
4. Bruk browser DevTools for debugging

### Linting og Formatering

```bash
# Sjekk for feil
yarn lint

# Fiks automatisk
yarn lint --fix

# Formater kode
yarn format
```

## Testing

### Unit Tests (Jest)

```bash
yarn test
```

### E2E Tests (Playwright)

```bash
# Install Playwright
yarn playwright install

# Run tests
yarn test:e2e
```

Sjå [tests/README.md](tests/README.md) for meir info.

## Deployment

Frontend deployast som statiske filer til Azure App Service (hosted av backend) via GitHub Actions.

Build-prosess:

1. `yarn install --frozen-lockfile`
2. `yarn build`
3. Output går til `build/`
4. Kopieres til `webapi/wwwroot/` under backend deployment

Sjå [../GITHUB_ACTIONS_SETUP.md](../GITHUB_ACTIONS_SETUP.md) for detaljar.

## Meir informasjon

- [../FAQ_MIMIR.md](../FAQ_MIMIR.md) - Brukarrettleiing
- [../FEATURE_SUMMARY.md](../FEATURE_SUMMARY.md) - Funksjonsoversikt
- [../scripts/README.md](../scripts/README.md) - Lokal utvikling
