# Azure Deployment Checklist - Nye Funksjonar

## 📋 Sjekkliste før deployment til Azure

### ✅ 1. Cosmos DB - Opprett ny container

Opprett `generatedfiles` container i Cosmos DB:

**Manuelt via Azure Portal:**
1. Gå til Azure Portal → Cosmos DB account → Data Explorer
2. Velg database: `CopilotChat`
3. Klikk "New Container"
4. Container ID: `generatedfiles`
5. Partition key: `/chatId`
6. Throughput: 400 RU/s (Autoscale) eller del med eksisterande containere
7. Klikk "OK"

**Via Azure CLI:**
```bash
az cosmosdb sql container create \
  --resource-group "RG-SK-Copilot-NPI" \
  --account-name "cosmos-copichat-4kt5uxo2hrzri" \
  --database-name "CopilotChat" \
  --name "generatedfiles" \
  --partition-key-path "/chatId" \
  --throughput 400
```

**Via PowerShell:**
```powershell
$resourceGroup = "RG-SK-Copilot-NPI"
$cosmosAccount = "cosmos-copichat-4kt5uxo2hrzri"
$database = "CopilotChat"

az cosmosdb sql container create `
  --resource-group $resourceGroup `
  --account-name $cosmosAccount `
  --database-name $database `
  --name "generatedfiles" `
  --partition-key-path "/chatId" `
  --throughput 400
```

---

### ✅ 2. App Service Configuration

Sjekk at desse innstillingane finst i **Azure Portal → App Service → Configuration → Application settings**:

```
Cosmos__GeneratedFilesContainer = generatedfiles
```

*(Dette er allereie konfigurert i `appsettings.json`, men du kan overstyre i Azure om nødvendig)*

---

### ✅ 3. Deployment

Deploy som normalt:

**Via Scripts:**
```powershell
cd D:\mimir_experimental\mimir\scripts\deploy

# Package WebAPI
.\package-webapi.ps1

# Deploy til Azure
.\deploy.ps1 -ResourceGroup "RG-SK-Copilot-NPI"
```

**Via Visual Studio / VS Code:**
- Right-click på `webapi` prosjekt → Publish
- Right-click på `webapp` folder → Deploy to Static Web App

---

### ✅ 4. Webapp - npm install

Sidan du har lagt til nye npm-pakkar (katex, remark-math, rehype-katex), må du sikre at `package.json` er oppdatert før webapp-deployment:

```bash
cd D:\mimir_experimental\mimir\webapp
npm install --legacy-peer-deps
npm run build
```

Sjekk at bygget fungerer før du deployer.

---

## 🧪 Testing etter deployment

### 1. Test filnedlasting
1. Logg inn på Azure-versjonen av Mimir
2. Spør: "Lag ei markdown-fil med eit døme"
3. Klikk på nedlastingslenkja
4. ✅ Forventet: Fila lastar ned frå `https://your-app.azurewebsites.net/files/{fileId}`

### 2. Test pinned documents
1. Last opp eit dokument
2. Klikk på pin-ikonet (📍 → 📌)
3. Spør eit spørsmål
4. ✅ Forventet: Dokumentet er alltid inkludert i konteksten

### 3. Test matematikk
1. Spør: "Forklar Pytagoras sin setning"
2. ✅ Forventet: Formelen $a^2 + b^2 = c^2$ vert vist korrekt

### 4. Test kopier-knapp
1. Finn ei melding frå Mimir
2. Klikk på clipboard-ikonet
3. ✅ Forventet: Meldinga vert kopiert

### 5. Test Teams/Iframe
1. Opne Mimir i Microsoft Teams (om konfigurert)
2. ✅ Forventet: Popup-autentisering fungerer

---

## 📊 Cosmos DB RU Recommendations

Med dei nye containerne, her er anbefalt RU-konfigurasjon for 500 samtidige brukarar:

| Container | Type | RU/s | Kostnad/md |
|-----------|------|------|-----------|
| `chatsessions` | Autoscale | Max 4,000 | ~$29 |
| `chatmessages` | Autoscale | Max 10,000 | ~$73 |
| `chatmemorysources` | Autoscale | Max 4,000 | ~$29 |
| `chatparticipants` | Autoscale | Max 1,000 | ~$7 |
| **`generatedfiles`** | **Autoscale** | **Max 1,000** | **~$7** |
| **TOTAL** | | **Max 20,000** | **~$145** |

*(Prisane er estimat basert på Azure Standard-prising)*

---

## 🔧 Troubleshooting

### Problem: "Container not found" error
**Løysing**: Du har glømt å opprette `generatedfiles` container. Sjå steg 1.

### Problem: Filnedlasting gir 404
**Løysing**: 
1. Sjekk at `FileDownloadController` er deploy
2. Sjekk at URL-en er korrekt: `https://your-app.azurewebsites.net/files/{fileId}`
3. Sjekk at fila eksisterer i Cosmos DB

### Problem: Pin-knappen viser ikkje
**Løysing**: 
1. Sjekk at webapp er deploy med siste kode
2. Hard refresh i nettlesaren (Ctrl+Shift+R)
3. Sjekk at `package.json` inneheld pin-icons

### Problem: Matematikk-rendering fungerer ikkje
**Løysing**:
1. Sjekk at `katex`, `remark-math`, `rehype-katex` er i `package.json`
2. Kjør `npm install --legacy-peer-deps` før deployment
3. Sjekk at `katex/dist/katex.min.css` er importert

---

## 📝 Oppsummering

### Kva er automatisk konfigurert:
✅ `GeneratedFilesContainer` i `appsettings.json`
✅ `GeneratedFileRepository` registrering i `ServiceExtensions.cs`
✅ `FileDownloadController` for å serve filer
✅ `FileGenerationPlugin` med full URL-støtte
✅ Pin/unpin API-endepunkt i `DocumentController`
✅ Frontend-komponenter for pinned documents
✅ KaTeX math rendering
✅ Copy message button
✅ Teams/iframe authentication

### Kva DU må gjere:
1. ⚠️ Opprett `generatedfiles` container i Cosmos DB
2. ⚠️ Kjør `npm install --legacy-peer-deps` i webapp før deployment
3. ⚠️ Deploy både webapi og webapp
4. ✅ Test alle nye funksjonar

---

🚀 **Ready for deployment!**

