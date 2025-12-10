# GPT-5-mini / GPT-4o Compatibility Options

## 🐛 The Problem

- **Your Semantic Kernel version**: 1.67.1
- **Doesn't have**: `MaxCompletionTokens` property yet
- **Your model**: gpt-5-mini (requires new API)
- **Error**: `max_tokens` not supported with this model

## ✅ Working Solutions

### Option 1: Use model-router (⭐ RECOMMENDED - Immediate Fix)

Your `model-router` deployment should handle API compatibility automatically.

**Quick Fix:**
```powershell
cd scripts
.\use-model-router.ps1
```

Or manually:
```powershell
az webapp config appsettings set `
    --resource-group rg-sk-copilot-npi `
    --name app-copichat-4kt5uxo2hrzri-webapi `
    --settings `
        KernelMemory__Services__AzureOpenAIText__Deployment="model-router" `
    --output none

az webapp restart `
    --resource-group rg-sk-copilot-npi `
    --name app-copichat-4kt5uxo2hrzri-webapi
```

**Benefits:**
- ✅ Works immediately
- ✅ No code changes needed
- ✅ Compatible with all models
- ✅ Handles API version translation

---

### Option 2: Upgrade Semantic Kernel (Future-Proof)

Wait for or upgrade to a newer SK version that includes `MaxCompletionTokens`.

**Check for updates:**
```powershell
cd scripts
.\check-semantic-kernel-updates.ps1
```

Or manually:
```powershell
cd D:\mimir_experimental\mimir
dotnet list package --outdated
```

**If newer version exists**, update `Directory.Packages.props`:
```xml
<PackageVersion Include="Microsoft.SemanticKernel" Version="1.68.0" />
<PackageVersion Include="Microsoft.SemanticKernel.Abstractions" Version="1.68.0" />
<!-- Update all SK packages to match -->
```

Then:
```powershell
dotnet restore
dotnet build
dotnet test  # Test thoroughly!
```

**Benefits:**
- ✅ Future-proof solution
- ✅ Supports latest OpenAI features
- ✅ Better long-term

**Risks:**
- ⚠️ Might have breaking changes
- ⚠️ Requires testing
- ⚠️ Might not be available yet

---

### Option 3: Use Compatible Model (Quick Workaround)

Switch to a model that still supports `max_tokens` temporarily:

```powershell
az webapp config appsettings set `
    --resource-group rg-sk-copilot-npi `
    --name app-copichat-4kt5uxo2hrzri-webapi `
    --settings `
        KernelMemory__Services__AzureOpenAIText__Deployment="gpt-4" `
    --output none

az webapp restart `
    --resource-group rg-sk-copilot-npi `
    --name app-copichat-4kt5uxo2hrzri-webapi
```

**Compatible models:**
- ✅ `gpt-4`
- ✅ `gpt-4-32k`
- ✅ `gpt-35-turbo`
- ✅ `gpt-35-turbo-16k`

**Benefits:**
- ✅ Works immediately
- ✅ No code changes

**Drawbacks:**
- ❌ Can't use gpt-5-mini
- ❌ Miss out on newer model features

---

### Option 4: Use Older API Version (Not Recommended)

Force older Azure OpenAI API version (if your Azure OpenAI supports it):

```json
// In KernelMemory configuration
"AzureOpenAIText": {
  "ApiVersion": "2024-02-15-preview"  // Older version
}
```

**Why not recommended:**
- ❌ Deprecated API
- ❌ Missing new features
- ❌ Might not work with gpt-5-mini at all

---

## 🎯 Recommended Approach

**For immediate fix:**
1. Run `scripts\use-model-router.ps1` ✅
2. Test at https://mimir.vlfk.no
3. Verify no 400 errors

**For long-term:**
1. Monitor for Semantic Kernel 1.68.0+ release
2. Check release notes for `MaxCompletionTokens` support
3. Upgrade when available and tested

---

## 📊 Comparison Table

| Solution | Speed | Risk | Future-Proof | Supports gpt-5 |
|----------|-------|------|--------------|----------------|
| **model-router** | ⚡ Instant | 🟢 Low | ✅ Yes | ✅ Yes |
| **Upgrade SK** | ⏳ Depends | 🟡 Medium | ✅ Yes | ✅ Yes |
| **Use gpt-4** | ⚡ Instant | 🟢 Low | ❌ No | ❌ No |
| **Old API** | ⚡ Instant | 🔴 High | ❌ No | ❓ Maybe |

---

## 🧪 Testing After Fix

1. **Start a new chat** at https://mimir.vlfk.no
2. **Send a message** - should work without errors
3. **Check Application Insights** - no 400 errors
4. **Test MCP tools** in Klarspråk assistant
5. **Monitor token usage** - ensure limits work

---

## 📝 Notes

- `MaxCompletionTokens` is coming in future SK releases
- OpenAI deprecated `max_tokens` for GPT-4o+ models in API 2024-08-01+
- `model-router` should abstract these differences
- Always test in a non-production environment first

---

**Last Updated**: December 2024  
**Semantic Kernel**: 1.67.1  
**Target Model**: gpt-5-mini

