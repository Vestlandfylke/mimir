# 🚀 DEPLOY NO - Quick Guide

## ✅ Alt er klart! Her er siste steget:

### STEG 1: Commit og Push (2 min)

```bash
cd D:\mimir_experimental\mimir

# Sjekk kva som er endra
git status

# Legg til alt
git add .

# Commit
git commit -m "Setup GitHub Actions and new features

- Pinned documents
- File download
- Math (KaTeX) support
- Copy message button
- Teams/iframe auth
- Fast model for intent
- MCP Bridge deployment
- Nynorsk localization"

# Push
git push origin main
```

### STEG 2: Monitor Deployment (10-15 min)

1. Gå til: **https://github.com/[ditt-repo]/actions**
2. Du skal sjå **"Deploy Mimir to Production"** kjøre
3. Klikk på workflow for å sjå framgang

**Deployment-sekvensprosess:**
1. ⏱️ Build Backend (2-3 min)
2. ⏱️ Build Frontend (2-3 min)
3. ⏱️ Build MCP Bridge (1-2 min)
4. ⏱️ Deploy Infrastructure (1 min)
5. ⏱️ Deploy Backend (2-3 min)
6. ⏱️ Deploy MCP Bridge to Container Apps (3-5 min)
7. ⏱️ Configure WebAPI (1 min)

**Total tid**: ~10-15 minutt

---

## 🎯 Kva skjer automatisk:

✅ GitHub Actions vil:
1. Bygge webapi (backend)
2. Bygge webapp (frontend)  
3. Bygge MCP Bridge
4. Deploy alt til Azure
5. Bygge Docker image for MCP Bridge i ACR
6. Deploy MCP Bridge til Container Apps
7. Oppdatere WebAPI konfigurasjon med MCP URL
8. Restarte WebAPI

**Du treng ikkje gjere noko meir!** GitHub handterer alt! 🎉

---

## ✅ Verifisering

Etter deployment, test desse:

### 1. Backend API
```bash
curl https://app-copichat-4kt5uxo2hrzri-webapi.azurewebsites.net/healthz
```
Forventet: `200 OK`

### 2. Frontend
Gå til din Mimir URL i nettlesar

### 3. Nye Funksjonar
- 📥 File download: "Lag ei fil med..."
- 📌 Pinned docs: Pin eit dokument
- 🔢 Math: "Forklar Pytagoras"
- 📋 Copy: Kopier ei melding
- 🔧 MCP tools: "Analyser tekst" (i Klarspråk-assistent)

---

## 🆘 Om noko feiler

### GitHub Actions feiler:
1. Sjekk **Actions → [workflow] → Logs**
2. Vanlige problem:
   - Manglar secrets/variables
   - ACR permissions
   - Container App quota

### MCP Bridge feiler:
```bash
# Sjekk logs
az containerapp logs show \
  --name mcp-bridge-mimir \
  --resource-group RG-SK-Copilot-NPI \
  --follow
```

### Backend feiler:
1. Gå til Azure Portal → App Service → Log stream
2. Sjekk Application Insights for errors

---

## 📞 Hjelp

Om du treng hjelp, sjå:
- `GITHUB_ACTIONS_SETUP.md` - Detaljert setup
- `STEP_BY_STEP_GUIDE.md` - Steg-for-steg
- `FEATURE_SUMMARY.md` - Oversikt over funksjonar

---

## 🎊 READY TO DEPLOY!

**Alt du treng å gjere:**
1. `git add .`
2. `git commit -m "Setup new features"`
3. `git push origin main`
4. Watch GitHub Actions do the magic! ✨

---

**God deployment!** 🚀

