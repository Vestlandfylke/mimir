# Kostnadsrapport: Mimir i Azure
## Vestland fylkeskommune – KI & teknologiutvikling

**Utarbeidd av:** Digitalisering – KI & teknologiutvikling  
**Dato:** 7. januar 2026  
**Periode analysert:** Desember 2025  
**Status:** Beta-testing

---

## Samandrag

Denne rapporten analyserer dei faktiske Azure-kostnadene for Mimir-applikasjonen i beta-perioden (desember 2025) og estimerer kostnadene ved full utrulling til 800–1000 aktive brukarar dagleg.

### Hovudfunn

| Metrikk | Verdi |
|---------|-------|
| **Faktisk kostnad desember 2025** | ~20 650 kr |
| **Aktive brukarar (beta)** | ~65 |
| **Estimert kostnad ved full skala** | 50 000 – 70 000 kr/mnd |
| **Største kostnadsdrivar** | Azure OpenAI (~50% ved full skala) |

---

## 1. Bakgrunn

Mimir er ein KI-assistent utvikla for Vestland fylkeskommune, bygd på Microsoft Semantic Kernel og Azure OpenAI. Applikasjonen er for tida i beta-testing med avgrensa bruk.

### Teknisk arkitektur

| Komponent | Teknologi | Azure-teneste |
|-----------|-----------|---------------|
| Frontend | React + Fluent UI | App Service |
| Backend | .NET 8 + Semantic Kernel | App Service |
| Dokumentprosessering | Kernel Memory | App Service |
| MCP-verktøy | Python + FastAPI | Container Apps |
| Chat-historikk | – | Cosmos DB |
| Semantisk søk | – | Azure KI Search |
| Språkmodell | GPT-5.2-Chat | Azure OpenAI |
| Embedding | text-embedding-ada-002 | Azure OpenAI |
| OCR | – | Document Intelligence |
| Sanntidskommunikasjon | – | SignalR |

---

## 2. Faktiske kostnader – desember 2025

### 2.1 Infrastrukturkostnader

Kjelde: Azure Cost Management (RG-SK-Copilot-NPI)

| Teneste | Kostnad NOK | Merknad |
|---------|-------------|---------|
| Azure App Service (P2 v3) | 7 202 | WebAPI + Frontend |
| Azure App Service (P2mv3) | 7 084 | MemoryPipeline |
| Azure App Service (P1mv3) | 436 | Staging/dev |
| Azure Cosmos DB | 2 243 | 100 RU/s provisioned |
| Azure KI Search (Basic) | 1 531 | Vektor-indeks |
| Azure Storage | 1 097 | Køar + blob storage |
| SignalR Service | 385 | Sanntids-chat |
| Log Analytics | 323 | Telemetri |
| Container Apps | 73 | MCP Bridge |
| Container Registry | 37 | Docker-images |
| Document Intelligence | < 1 | OCR (minimal bruk) |
| Bandwidth | < 1 | Utgåande trafikk |
| **Subtotal infrastruktur** | **20 411** | |

### 2.2 Azure OpenAI-kostnader

Kjelde: Azure Cost Management (AO-KI-SWECENT)

| Teneste | Kostnad NOK |
|---------|-------------|
| Azure OpenAI (GPT-5.2-Chat) | 237 |

*Merknad: Låg kostnad skuldast avgrensa bruk i beta og mogleg inkludert kreditt.*

### 2.3 Totalkostnad desember 2025

| Kategori | Kostnad NOK |
|----------|-------------|
| Infrastruktur | 20 411 |
| Azure OpenAI | 237 |
| **TOTAL** | **20 648** |

---

## 3. Kostnadsfordeling

### 3.1 Desember 2025 (beta)

```
App Service         ████████████████████████████░░░░░  71%
Cosmos DB           ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  11%
KI Search           ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   7%
Storage + andre     ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   9%
Azure OpenAI        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   1%
```

### 3.2 Estimert ved full skala (med prompt caching)

```
Azure OpenAI        ██████████████████░░░░░░░░░░░░░░░  50%
App Service         ████████████░░░░░░░░░░░░░░░░░░░░░  28%
Cosmos DB           ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   9%
KI Search           ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   4%
Andre               ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   9%
```

---

## 4. Azure OpenAI-prising

### 4.1 GPT-5.2-Chat (Standard Global)

| Token-type | Pris per million tokens (NOK) |
|------------|-------------------------------|
| Input | ~18 kr |
| Cached Input | ~1,80 kr (90% rabatt) |
| Output | ~144 kr |

*Valutakurs: 1 USD ≈ 10,25 NOK*

### 4.2 Prompt Caching-implementasjon

Vi har implementert optimalisering for Azure OpenAI prompt caching som reduserer input-kostnadene vesentleg:

**Korleis det fungerer:**
- Azure OpenAI cacher automatisk prompt-prefiks over 1024 tokens
- Cached tokens fakturerast med 90% rabatt
- Vi har lagt til eit statisk prefiks på ~1200 tokens som er identisk for alle førespurnader

**Forventa cache hit rate:** 50-60%

### 4.3 Kostnadsberekningar

**Føresetnader for full skala:**
- 900 aktive brukarar dagleg
- 15 meldingar per brukar per dag
- ~2 000 input-tokens per interaksjon (inkl. kontekst)
- ~500 output-tokens per interaksjon
- ~405 000 interaksjonar per månad

**Utan prompt caching:**

| Token-type | Volum | Pris | Kostnad NOK |
|------------|-------|------|-------------|
| Input | 810M tokens | 18 kr/M | 14 580 |
| Output | 202M tokens | 144 kr/M | 29 088 |
| **Total** | | | **43 668** |

**Med 50% prompt caching (implementert):**

| Token-type | Volum | Pris | Kostnad NOK |
|------------|-------|------|-------------|
| Normal input | 405M tokens | 18 kr/M | 7 290 |
| Cached input | 405M tokens | 1,80 kr/M | 729 |
| Output | 202M tokens | 144 kr/M | 29 088 |
| **Total** | | | **37 107** |

**Innsparing frå prompt caching: ~6 500 kr/mnd (15%)**

---

## 5. Estimert kostnad ved full skala

### 5.1 Detaljert estimat (800–1000 brukarar/dag)

| Teneste | Lågt estimat | Middels | Høgt estimat |
|---------|--------------|---------|--------------|
| Azure OpenAI (med caching) | 28 000 kr | 35 000 kr | 45 000 kr |
| App Service | 15 000 kr | 18 000 kr | 22 000 kr |
| Cosmos DB | 3 000 kr | 5 000 kr | 7 000 kr |
| Azure KI Search | 1 500 kr | 2 000 kr | 3 000 kr |
| SignalR | 1 000 kr | 1 500 kr | 2 500 kr |
| Storage | 1 000 kr | 1 500 kr | 2 500 kr |
| Container Apps | 300 kr | 500 kr | 800 kr |
| Log Analytics | 300 kr | 500 kr | 800 kr |
| Document Intelligence | 200 kr | 500 kr | 1 000 kr |
| Andre (bandwidth, registry) | 200 kr | 400 kr | 600 kr |
| **TOTAL** | **50 500 kr** | **64 900 kr** | **85 200 kr** |

### 5.2 Samanlikningstabell

| Fase | Brukarar | Kostnad/mnd |
|------|----------|-------------|
| **Beta (faktisk)** | ~65 | ~20 650 kr |
| Optimalisert beta | ~65 | ~12 000 kr |
| **Full skala (lågt)** | ~800 | ~50 000 kr |
| **Full skala (middels)** | ~900 | ~65 000 kr |
| **Full skala (høgt)** | ~1000 | ~85 000 kr |

---

## 6. Kostnadsoptimalisering

### 6.1 Implementerte tiltak

| Tiltak | Status | Forventa innsparing |
|--------|--------|---------------------|
| Prompt caching (statisk prefiks) | ✅ Implementert | ~15% på OpenAI-input |
| Cache metrics-overvaking | ✅ Implementert | Gjev innsikt i ytterlegare optimalisering |
| User-parameter for cache routing | ✅ Implementert | Betrar cache hit rate |

### 6.2 Tilrådde tiltak for produksjon

| Tiltak | Forventa innsparing | Prioritet |
|--------|---------------------|-----------|
| Nedgrader App Service til S2/S3 | ~5 000 kr/mnd | Høg |
| Cosmos DB Serverless (beta) | ~1 500 kr/mnd | Middels |
| Reserved Capacity-avtalar | ~10-20% totalt | Middels |
| Kortare system prompt | ~5-10% på OpenAI | Låg |

### 6.3 Overvaking av cache-ytelse

Med den nye implementasjonen kan cache-ytelse overvakast i Application Insights:

```kql
customEvents
| where name == "PromptCacheMetrics"
| extend cacheHitRate = todouble(customDimensions["cacheHitRate"])
| summarize avgCacheRate = avg(cacheHitRate) by bin(timestamp, 1h)
| render timechart
```

---

## 7. Risikovurdering

### 7.1 Kostnadsmessige risikofaktorar

| Risiko | Sannsynlegheit | Konsekvens | Tiltak |
|--------|----------------|------------|--------|
| Høgare bruk enn estimert | Middels | Middels | Set opp budsjett-alerts |
| Låg cache hit rate | Låg | Middels | Overvak og juster prefiks |
| Prisauke frå Microsoft | Låg | Høg | Evaluer alternativ |

### 7.2 Tekniske problem å løyse

| Problem | Status | Merknad |
|---------|--------|---------|
| 64k failed requests (des.) | ⚠️ Krev undersøking | Kan påverke brukaroppleving |
| Overprovisjonert infrastruktur | ⚠️ Kan optimaliserast | Nedgradering kan spare ~5 000 kr/mnd |

---

## 8. Konklusjon

Mimir-applikasjonen har ein faktisk månadskostnad på **~20 650 kr** i beta-fasen med 65 brukarar. Ved full utrulling til 800–1000 aktive brukarar dagleg, estimerer vi ein månadskostnad på **50 000 – 70 000 kr**, avhengig av bruksmønster.

### Nøkkelpunkt

1. **Azure OpenAI er hovudkostnaden** (~50%) ved full skala, mot berre 1% i beta
2. **Prompt caching reduserer kostnadene** med ~15% på input-tokens
3. **Infrastrukturen er overprovisjonert** i beta og kan optimaliserast
4. **Tekniske feil** (64k failed requests) bør undersøkast før skalering

### Tilråding

Ved overgang til produksjon tilrår vi:

1. **Overvak cache-ytelse** dei første vekene for å verifisere 50%+ cache hit rate
2. **Nedgrader App Service** til S2/S3 når lastmønsteret er kjent
3. **Set opp budsjett-alerts** ved 40 000 kr og 60 000 kr
4. **Løys tekniske feil** før brukarauke

---

## Vedlegg

### A. Datakjelder

- Azure Cost Management – RG-SK-Copilot-NPI (desember 2025)
- Azure Cost Management – AO-KI-SWECENT (desember 2025)
- Application Insights – appins-copichat-* (desember 2025)

### B. Føresetnader for estimat

| Parameter | Verdi |
|-----------|-------|
| Valutakurs NOK/USD | ~10,25 |
| Meldingar per brukar per dag | 10-20 (snitt 15) |
| Input tokens per melding | ~2 000 |
| Output tokens per melding | ~500 |
| Forventa cache hit rate | 50-60% |

### C. Azure OpenAI-prising (januar 2026)

| Modell | Input (NOK/M) | Cached (NOK/M) | Output (NOK/M) |
|--------|---------------|----------------|----------------|
| GPT-5.2-Chat | ~18 | ~1,80 | ~144 |
| GPT-4o-mini | ~1,50 | ~0,75 | ~6 |
| text-embedding-ada-002 | ~1 | – | – |

---

*Rapport generert 7. januar 2026*  
*Vestland fylkeskommune – Digitalisering, KI & teknologiutvikling*
