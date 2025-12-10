# Mimir Deployment Checklist - December 2024

## 📦 What's Being Deployed

### Backend Changes ✅
- ✅ Semantic Kernel upgraded from 1.67.1 to 1.68.0 (GPT-5/GPT-4o support)
- ✅ Microsoft.Extensions.AI upgraded to 10.1.0
- ✅ SignalR CORS fix (AllowCredentials added)

### Frontend Changes ⚠️
- ✅ Teams authentication helper with SSO support
- ✅ Silent authentication on login page
- ✅ Enhanced Teams detection
- ✅ All linting errors fixed
- ⚠️ **NEEDS**: `yarn add @microsoft/teams-js` before deployment

### Production Configuration Scripts 📋
- ✅ `scripts/update-production-config.ps1` - Apply missing settings
- ✅ `scripts/use-model-router.ps1` - Fix model compatibility
- ✅ `scripts/check-azure-openai-config.ps1` - Diagnostics

### Documentation 📚
- ✅ `TEAMS_AUTH_QUICK_START.md`
- ✅ `SEMANTIC_KERNEL_1.68_UPGRADE.md`
- ✅ `SIGNALR_CORS_FIX.md`
- ✅ `scripts/PRODUCTION_CONFIG_CHECKLIST.md`
- ✅ `scripts/GPT5_COMPATIBILITY_OPTIONS.md`
- ✅ Teams manifest ready in `teams-manifest/manifest.json`

---

## 🚀 Deployment Steps

### Phase 1: Pre-Deployment (Local Testing) ✅ DONE

- [x] Backend builds successfully
- [x] Frontend builds successfully  
- [x] Local testing passed
- [x] No compilation errors
- [x] SignalR working locally

---

### Phase 2: Frontend - Install Teams SDK

**BEFORE deploying frontend, install the Teams package:**

```bash
cd webapp
yarn add @microsoft/teams-js
```

Then rebuild:

```bash
yarn build
```

---

### Phase 3: Commit All Changes

```bash
git add .
git commit -m "feat: Major upgrade - SK 1.68.0, Teams SSO, and production fixes

Changes:
- Upgrade Semantic Kernel to 1.68.0 for GPT-5/GPT-4o support
- Add Teams authentication with silent SSO support
- Fix SignalR CORS for local development
- Add production configuration scripts for MCP approval
- Update deployment workflows with complete settings
- Fix all frontend linting errors
- Add comprehensive documentation

Fixes:
- max_tokens error with gpt-5-mini (#9165)
- MCP tools auto-executing without approval in production
- Teams authentication not working in embedded contexts
- SignalR connection issues in local dev"

git push origin main
```

---

### Phase 4: Deploy via GitHub Actions (Automatic)

Once you push to main, the GitHub Actions workflow will:

1. ✅ Build backend with SK 1.68.0
2. ✅ Build frontend with Teams SDK
3. ✅ Deploy backend to Azure
4. ✅ Deploy frontend to Azure
5. ✅ Deploy MCP bridge
6. ✅ Configure WebAPI with MCP settings (including new ones we added)

**Monitor deployment:**
- Go to: https://github.com/YOUR-ORG/YOUR-REPO/actions
- Watch the `mimir-deploy-production` workflow

---

### Phase 5: Apply Production Configuration

**After deployment completes**, run these scripts to add missing settings:

#### 5.1 Update Production Config (MCP, FastModel, etc.)

```powershell
cd scripts
.\update-production-config.ps1
```

This adds:
- FastModel__Enabled = true
- FastModel__Deployment = gpt-4o-mini
- McpServers__PlanApprovalMode = PerServer
- McpServers__Servers__0__RequireApproval = true
- DocumentMemory settings

#### 5.2 Optional: Check Azure OpenAI Config

```powershell
cd scripts
.\check-azure-openai-config.ps1
```

This verifies all Azure OpenAI settings are present.

---

### Phase 6: Update Teams Manifest

1. **Go to**: https://dev.teams.microsoft.com/
2. **Click**: "Apps" → "Import app"
3. **Upload**: `teams-manifest/mimir-teams-app.zip` (after creating it)
4. **Or use "Take ownership"** with App ID: `5483def5-ac82-4352-a18d-910697c2feb3`
5. **Update** the manifest with:
   ```json
   {
     "webApplicationInfo": {
       "id": "ff5f4fff-78d3-436f-aaa8-cda7b89e81b",
       "resource": "api://mimir.vlfk.no/ff5f4fff-78d3-436f-aaa8-cda7b89e81b"
     }
   }
   ```
6. **Save and publish**

---

### Phase 7: Post-Deployment Verification

#### 7.1 Test in Browser
- [ ] Go to https://mimir.vlfk.no
- [ ] Try silent login (should auto-login if you were logged in recently)
- [ ] Send a chat message
- [ ] Verify no max_tokens errors
- [ ] Test document upload
- [ ] Check Application Insights - no 400/500 errors

#### 7.2 Test in Teams
- [ ] Open Mimir in Teams
- [ ] Should auto-login with SSO (no button click!)
- [ ] Send a chat message
- [ ] Test Klarspråk assistant
- [ ] Verify MCP approval prompts appear

#### 7.3 Check MCP Approval
- [ ] Open Klarspråk assistant
- [ ] Ask to analyze some text
- [ ] **Should see approval prompt before tool executes**
- [ ] Approve and verify it works

#### 7.4 Application Insights Queries

Run these in Azure:

```kql
// Check for max_tokens errors (should be 0)
exceptions
| where timestamp > ago(1h)
| where outerMessage contains "max_tokens"
| count

// Check overall error rate
requests
| where timestamp > ago(1h)
| summarize 
    Total = count(),
    Errors = countif(resultCode startswith "5"),
    ErrorRate = round((countif(resultCode startswith "5") * 100.0) / count(), 2)
```

---

## ⚡ Quick Deploy (If Confident)

If you want to deploy everything in one go:

```bash
# 1. Install Teams SDK
cd webapp && yarn add @microsoft/teams-js && cd ..

# 2. Rebuild frontend
cd webapp && yarn build && cd ..

# 3. Commit and push
git add .
git commit -m "feat: Upgrade SK 1.68.0 and add Teams SSO support"
git push origin main

# 4. Wait for GitHub Actions to complete

# 5. Apply production config
cd scripts
.\update-production-config.ps1
```

---

## 🎯 Expected Results

### Backend
- ✅ No more 500 errors with gpt-5-mini
- ✅ MCP tools require approval
- ✅ FastModel uses gpt-4o-mini for speed
- ✅ Document processing works

### Frontend  
- ✅ Silent login in browser (if cached)
- ✅ Silent SSO in Teams (if configured)
- ✅ Login button only shows when needed
- ✅ Works in Teams app and browser

---

## 🚨 Rollback Plan (If Needed)

If something goes wrong:

```bash
# Revert the commit
git revert HEAD
git push

# Or disable problematic features
az webapp config appsettings set \
  --settings FastModel__Enabled="false"
```

---

## 📊 Pre-Deploy Checklist

- [x] Backend builds locally
- [x] Frontend builds locally
- [x] Local testing passed
- [ ] **Install @microsoft/teams-js** (DO THIS FIRST!)
- [ ] Rebuild frontend after package install
- [ ] Commit changes
- [ ] Push to trigger deployment
- [ ] Run production config scripts
- [ ] Update Teams manifest
- [ ] Test in production

---

**Ready to deploy!** Start with installing the Teams SDK, then we'll commit and push! 🚀

