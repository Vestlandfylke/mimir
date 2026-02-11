# Teknisk FAQ – Førstelinje Support for Mimir

> **Målgruppe:** Førstelinje support-teknikarar i Vestland fylkeskommune  
> **Sist oppdatert:** Februar 2026

---

## Innhald

1. [Oversikt over Mimir-løysinga](#1-oversikt-over-mimir-løysinga)
2. [Arkitektur og infrastruktur](#2-arkitektur-og-infrastruktur)
3. [Autentisering og tilgangsstyring](#3-autentisering-og-tilgangsstyring)
4. [Bli invitert inn i ein brukar sin chat (Del samtaleøkt)](#4-bli-invitert-inn-i-ein-brukar-sin-chat-del-samtaleøkt)
5. [Feilsøking inne i ein delt samtale](#5-feilsøking-inne-i-ein-delt-samtale)
6. [Info-knappen på Mimir-meldingar](#6-info-knappen-på-mimir-meldingar)
7. [Dokument og filar i samtalar](#7-dokument-og-filar-i-samtalar)
8. [AI-modellar og konfigurasjon](#8-ai-modellar-og-konfigurasjon)
9. [Papirkorg og arkiv](#9-papirkorg-og-arkiv)
10. [Rateavgrensing og yting](#10-rateavgrensing-og-yting)
11. [Vanlege feilmeldingar og løysingar](#11-vanlege-feilmeldingar-og-løysingar)
12. [Assistentmalar (Personas)](#12-assistentmalar-personas)
13. [Verktøy og plugins](#13-verktøy-og-plugins)
14. [SignalR og sanntidskommunikasjon](#14-signalr-og-sanntidskommunikasjon)
15. [Logging og overvaking](#15-logging-og-overvaking)
16. [Sjekkliste for vanleg feilsøking](#16-sjekkliste-for-vanleg-feilsøking)
17. [Eskalering til andrelinje](#17-eskalering-til-andrelinje)

---

## 1. Oversikt over Mimir-løysinga

Mimir er ein intern KI-assistent for Vestland fylkeskommune. Løysinga består av:

| Komponent | Teknologi | Funksjon |
|-----------|-----------|----------|
| **Frontend (webapp)** | React / TypeScript | Brukargrensesnitt i nettlesar |
| **Backend (webapi)** | ASP.NET Core / C# | API, forretningslogikk, AI-orkestrering |
| **Datalagring** | Azure Cosmos DB | Samtalar, meldingar, deltakarar, dokument-metadata |
| **Dokumentlagring** | Azure Blob Storage | Opplasta dokument og genererte filer |
| **Vektordatabase** | Azure AI Search | Semantisk søk i dokument og kunnskapsbasar |
| **AI-modellar** | Azure OpenAI / Azure AI Foundry | GPT-5.2, GPT-5 Mini, Claude Opus 4.5 |
| **OCR** | Azure AI Document Intelligence | Tekstgjenkjenning frå bilete og skanna dokument |
| **Sanntid** | SignalR (WebSockets) | Sanntidsoppdateringar i delte samtalar |
| **Autentisering** | Azure AD (Entra ID) | SSO, gruppebasert tilgang |
| **Overvaking** | Application Insights | Logging, feilsporing, ytingsdata |

### URL-ar

| Miljø | URL |
|-------|-----|
| Produksjon | Sjå intern dokumentasjon |
| Backend API | `https://<app-service-name>.azurewebsites.net` |
| Swagger (API-dok) | `<backend-url>/swagger` (berre autoriserte brukarar) |

---

## 2. Arkitektur og infrastruktur

### Dataflyt ved ein melding

```
Brukar → Frontend (React) → Backend API (ASP.NET Core) → Azure OpenAI
                                  ↕                           ↓
                            Cosmos DB                   AI-svar (streaming)
                            Blob Storage                      ↓
                            AI Search                 Backend → Frontend
                            SignalR Hub            (SignalR til alle deltakarar)
```

### Viktige Azure-ressursar

| Ressurs | Bruk |
|---------|------|
| Azure App Service | Hostar backend-API |
| Azure Static Web App / App Service | Hostar frontend |
| Azure Cosmos DB | Samtaledata (sessions, messages, participants) |
| Azure Blob Storage | Dokument og genererte filer |
| Azure AI Search | Vektorbasert dokumentsøk |
| Azure OpenAI | AI-modellendepunkt |
| Azure AI Document Intelligence | OCR for bilete/PDF |
| Application Insights | Logging og overvaking |

### Cosmos DB-containerar

| Container | Innhald | Partisjonsnøkkel |
|-----------|---------|-------------------|
| `chatsessions` | Samtaleøkter | `/id` |
| `chatmessages` | Alle meldingar | `/chatId` |
| `chatparticipants` | Deltakarar i samtalar | `/userId` |
| `chatmemorysources` | Dokument-metadata | `/chatId` |
| `generatedfiles` | Metadata for genererte filer | – |
| `archivedchatsessions` | Arkiverte samtalar | `/deletedBy` |
| `archivedchatmessages` | Arkiverte meldingar | `/originalChatId` |
| `archivedchatparticipants` | Arkiverte deltakarar | `/originalChatId` |
| `archivedmemorysources` | Arkiverte dokument | `/originalChatId` |

---

## 3. Autentisering og tilgangsstyring

### Innlogging

- **Metode:** Azure AD (Entra ID) med OAuth 2.0 / OpenID Connect
- **Tenant:** Vestland fylkeskommune (`5b14945b-0f87-4...`)
- **Frontend Client ID:** `ff5f4fff-78d3-436f-aaa8-cfde7b89e81b`
- **Backend Client ID:** `db0932b4-3bb7-4b89-a398-85be5940e84f`
- **Scope:** `access_as_user`
- **Teams SSO:** Støtta via `ApplicationIdUri`

### Tilgangskontroll

| Nivå | Mekanisme |
|------|-----------|
| **Applikasjon** | Azure AD-innlogging kravd |
| **Samtale** | Deltakar-basert (`RequireChatParticipant`-policy) |
| **Assistentmalar** | Gruppe-/brukar-basert tilgang |
| **Swagger API** | Berre spesifikke Object ID-ar |

### Vanlege autentiseringsproblem

| Problem | Årsak | Løysing |
|---------|-------|---------|
| "Innlogging feiler" | Token utløpt | Be brukaren logge ut og inn att |
| "Ikkje tilgang" | Brukar ikkje i rett AD-gruppe | Sjekk gruppetilhøyrsle i Entra ID |
| "401 Unauthorized" | Ugyldig eller utløpt token | Tøm nettlesarcache, logg inn på nytt |
| "AADSTS error" | Azure AD-konfigurasjonsfeil | Eskaler til andrelinje |
| Teams-innlogging feiler | SSO-token ugyldig | Be brukaren opne Mimir i vanleg nettlesar |

---

## 4. Bli invitert inn i ein brukar sin chat (Del samtaleøkt)

> **Dette er den viktigaste funksjonen for support!** Brukaren kan invitere deg direkte inn i samtalen sin, slik at du ser alt som har skjedd.

### Føresetnad

Brukaren må ha **"Flerbrukar-samtalar"** aktivert i innstillingane sine:
1. Brukaren klikkar på tannhjulikonet (innstillingar)
2. Slår på "Flerbrukar-samtalar" (Live Chat Session Sharing)

### Steg-for-steg: Brukaren inviterer deg

1. Brukaren opnar samtalen dei treng hjelp med
2. Brukaren klikkar på **del-ikonet (👥)** i verktøylinja over samtalen
3. Brukaren vel **"Inviter andre til samtalen"**
4. Ein dialog viser ein **Chat-ID** (GUID-format, t.d. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
5. Chat-ID-en vert automatisk kopiert til utklippstavla
6. Brukaren sender Chat-ID-en til deg (via Teams, e-post, telefon etc.)

### Steg-for-steg: Du blir med i samtalen

1. Opne Mimir i nettlesaren din
2. Klikk på **plussikonet (+)** øvst til venstre ("Ny samtale")
3. Vel **"Bli med i ein bot"**
4. Lim inn **Chat-ID-en** du fekk frå brukaren
5. Klikk **"Bli med"**
6. Du er no deltakar i samtalen

### Kva du ser etter at du har blitt med

| Element | Beskriving |
|---------|------------|
| **Meldingshistorikk** | Alle tidlegare meldingar mellom brukaren og Mimir |
| **Dokument** | Alle opplasta dokument i Dokument-fana |
| **Tilpassingar** | Korleis brukaren har konfigurert Mimir (modell, tone, instruksjonar) |
| **Info-knapp (ℹ️)** | Detaljert prompt-informasjon på kvar Mimir-melding |
| **Planlagde handlingar** | Planar-fana viser kva verktøy Mimir har brukt |

### Viktig å vite

- **Alle deltakarar ser alle meldingar** – inkludert nye meldingar du eller brukaren sender
- **Du kan sjølv stille spørsmål til Mimir** i den delte samtalen
- **Dokument er tilgjengelege for alle** deltakarar
- **Sanntidsoppdatering** – meldingar og endringar synkroniserast via SignalR
- **Brukar-ID vert logga** – systemet sporer kven som er deltakar

### Feilsøking ved deling

| Problem | Årsak | Løysing |
|---------|-------|---------|
| "Finner ikkje samtalen" | Feil Chat-ID | Be brukaren kopiere ID-en på nytt |
| "Ikkje tilgang" | Funksjonen ikkje aktivert | Be brukaren slå på "Flerbrukar-samtalar" i innstillingar |
| Chat-ID fungerer ikkje | Samtalen kan vere sletta/arkivert | Sjekk om samtalen framleis eksisterer |
| Meldingar synast ikkje | SignalR-tilkoplingsproblem | Oppdater sida (F5) |

---

## 5. Feilsøking inne i ein delt samtale

Når du er inne i brukaren sin samtale, har du tilgang til kraftige verktøy for feilsøking:

### 5.1 Sjekke prompt-historikk

1. Sjå gjennom **meldingshistorikken** i chat-fana
2. Klikk **ℹ️-ikonet** (info-knappen) på kvar Mimir-melding for detaljert prompt-informasjon (sjå [seksjon 6](#6-info-knappen-på-mimir-meldingar))
3. Sjekk om brukaren har formulert spørsmåla tydeleg

### 5.2 Sjekke dokument

1. Gå til **Dokument-fana**
2. Sjekk kva dokument som er lasta opp
3. Sjekk om relevante dokument er **festa (📌)** – festa dokument vert alltid inkludert i konteksten
4. Verifiser at dokument er ferdig prosessert (ingen framdriftsindikator synleg)

### 5.3 Sjekke tilpassingar

1. Gå til **Tilpassing-fana**
2. Sjekk kva **AI-modell** brukaren brukar
3. Sjekk **tone** og **svarstil** innstillingar
4. Sjekk om brukaren har skrive **eigne instruksjonar** som kan påverke svara
5. Sjekk **minnebalanse** (nyleg kontekst vs. heilskap)

### 5.4 Sjekke verktøybruk

1. Gå til **Planar-fana**
2. Sjå kva verktøy Mimir har planlagt å bruke
3. Sjekk om verktøya køyrte vellykka eller feila
4. Verktøy som SharePoint-søk, Lovdata-oppslag osv. vert vist her

### 5.5 Typiske ting å sjekke

| Brukarklage | Kva du bør sjekke |
|-------------|-------------------|
| "Mimir ignorerer dokumentet mitt" | Er dokumentet festa (📌)? Er det ferdig prosessert? |
| "Mimir svarar på feil språk" | Sjekk eigne instruksjonar i Tilpassing |
| "Svara er for korte/lange" | Sjekk svarstil-innstillinga |
| "Mimir finn ikkje info" | Sjekk kva verktøy som vart brukt i Planar-fana |
| "Mimir gir rare svar" | Sjekk info-knappen for full prompt og token-bruk |
| "Mimir er veldig treig" | Sjekk kva modell som er valt (reasoning-modellar er tregare) |

---

## 6. Info-knappen på Mimir-meldingar

> **ℹ️-knappen** er det viktigaste feilsøkingsverktøyet for support. Den viser nøyaktig kva Mimir "tenkte" og kva informasjon som vart brukt.

### Kor finn du info-knappen?

- Kvart svar frå Mimir har eit lite **ℹ️-ikon** (Info-ikon)
- Klikk på ikonet for å opne **Prompt-dialogen**

### Kva viser Prompt-dialogen?

Dialogen har fleire seksjonar i ein trekkspel-meny (accordion):

#### 1. Token-bruk (graf)

Øvst i dialogen ser du eit **visuelt diagram** over token-forbruket:

| Token-kategori | Forklaring |
|----------------|------------|
| `audienceExtraction` | Token brukt til å forstå målgruppa |
| `userIntentExtraction` | Token brukt til å forstå brukaren sin intensjon |
| `metaPromptTemplate` | Token brukt av system-instruksjonane |
| `responseCompletion` | Token brukt til sjølve svaret |
| `workingMemoryExtraction` | Token brukt til arbeidsminne |
| `longTermMemoryExtraction` | Token brukt til langtidsminne |

> **Tips:** Høgt token-forbruk på `metaPromptTemplate` kan tyde på at brukaren har veldig lange eigne instruksjonar eller mange festa dokument.

#### 2. Tankeprosess (Reasoning)

- Viser steg-for-steg korleis AI-en tenkte seg fram til svaret
- Berre tilgjengeleg for **reasoning-modellar** (t.d. GPT-5.2 Reasoning)
- Nyttig for å forstå *kvifor* Mimir ga eit bestemt svar

#### 3. Systeminstruksjonar (System Persona)

- Dei overordna instruksjonane som styrer Mimir si åtferd
- Inkluderer organisasjons-kontekst, språkkrav, og retningslinjer
- Inkluderer eventuelt brukaren sine eigne instruksjonar

#### 4. Målgruppeanalyse (Audience)

- Viser kven Mimir har identifisert som målgruppe for svaret
- Påverkar tone og detaljnivå i svaret

#### 5. Forståing av spørsmål (User Intent)

- Viser korleis Mimir har tolka brukaren sitt spørsmål
- **Viktig for feilsøking:** Viss Mimir har misforstått intensjonen, forklarar det kvifor svaret vart feil

#### 6. Samtalehistorikk (Chat History)

- Viser dei meldingane som vart inkludert i konteksten (token-budsjettert)
- **Merk:** Ikkje alle meldingar vert inkludert – eldre meldingar kan vere kutta på grunn av token-grenser
- Format: `[tidspunkt] Brukarnamn sa: innhald`

#### 7. Dokument og minne (Chat Memories)

- Viser kva dokument-innhald som vart henta og inkludert
- Både langtidsminne og arbeidsminne
- **Viktig:** Sjekk dette viss brukaren meiner Mimir "ikkje les dokumentet"

#### 8. Ekstern informasjon (External Information)

- Viser data henta frå verktøy/plugins (SharePoint, Lovdata, etc.)
- Viser resultata frå planlagde handlingar
- **Viktig:** Sjekk dette viss brukaren meiner Mimir ikkje fann rett informasjon

### Korleis bruke info-knappen til feilsøking

| Scenario | Kva du sjekkar i info-dialogen |
|----------|-------------------------------|
| Mimir gir feil svar | **User Intent** – har Mimir forstått spørsmålet? |
| Mimir ignorerer dokument | **Chat Memories** – er dokumentinnhald inkludert? |
| Mimir brukar feil tone | **System Persona** + **Audience** – kva instruksjonar gjeld? |
| Svar er avkutta | **Token-bruk** – er token-grensa nådd? |
| Mimir finn ikkje SharePoint-info | **External Information** – vart søket utført? Kva resultat? |
| Mimir "gløymer" tidlegare meldingar | **Chat History** – kor mange meldingar er inkludert? |

---

## 7. Dokument og filar i samtalar

### Støtta filtypar

| Kategori | Format |
|----------|--------|
| Dokument | PDF, DOCX, DOC, TXT, MD |
| Rekneark | XLSX, XLS, CSV |
| Presentasjonar | PPTX, PPT |
| Bilete | PNG, JPG, JPEG, TIFF |
| Kode | Dei fleste tekstbaserte format |

### Grenser

| Type | Grense |
|------|--------|
| Maksimal filstorleik | **50 MB** per fil |
| Maksimalt antal filer per opplasting | **20** |
| Maks innhaldslengde (dokumentuttrekk) | 50 000 teikn |

### Korleis dokument vert prosessert

1. Brukar lastar opp fil via Dokument-fana
2. Backend validerer filtype og storleik
3. Innhaldsmoderasjon (om aktivert) sjekkar fila
4. Fila vert lagra i **Azure Blob Storage**
5. **Kernel Memory** parsar og indekserer innhaldet
6. Metadata vert lagra i **Cosmos DB** (`chatmemorysources`)
7. Dokumentet er søkbart i samtalen

### Dokument-problem

| Problem | Årsak | Løysing |
|---------|-------|---------|
| "Fila vert ikkje lasta opp" | Fil for stor (>50 MB) | Komprimer eller del opp fila |
| "Fila vert ikkje lasta opp" | Filtype ikkje støtta | Konverter til støtta format |
| "Mimir finn ikkje innhald" | Dokument ikkje ferdig prosessert | Vent og prøv igjen |
| "Mimir finn ikkje innhald" | Dokument ikkje festa | Fest dokumentet med 📌 |
| "Skanna PDF er tom" | OCR feila | Sjekk at PDF-en har lesbar tekst |
| Opplasting heng | Nettverksproblem eller stor fil | Sjekk nettverket, prøv mindre fil |

### Genererte filer

- Mimir kan generere Word, Excel, PowerPoint, PDF og andre filer
- **Filer vert sletta etter 7 dagar** – minn brukaren på å laste ned
- Filer er knytte til samtalen og vert arkivert saman med samtalen

---

## 8. AI-modellar og konfigurasjon

### Tilgjengelege modellar

| Modell | ID | Provider | Eigenskap |
|--------|----|----------|-----------|
| **GPT-5.2 Chat** | `gpt-5.2-chat` | Azure OpenAI | Standard, best for dei fleste oppgåver |
| **GPT-5.2 Reasoning** | `gpt-5.2-reasoning` | Azure OpenAI | Viser tankeprosess, tregare |
| **GPT-5 Mini** | `gpt-5-mini` | Azure OpenAI | Raskast, enklare oppgåver |
| **Claude Opus 4.5** | `claude-opus-4-5` | Azure Anthropic | Beta, deaktivert som standard |

### Modellrelaterte problem

| Problem | Årsak | Løysing |
|---------|-------|---------|
| "Svar tek veldig lang tid" | Reasoning-modell valt | Byt til GPT-5.2 Chat eller GPT-5 Mini |
| "Svaret er dårleg/grunt" | Mini-modell valt | Byt til GPT-5.2 Chat |
| "Tankeprosess manglar" | Ikkje reasoning-modell | Byt til GPT-5.2 Reasoning |
| "Modell ikkje tilgjengeleg" | Deployment-problem i Azure | Eskaler til andrelinje |
| "Claude fungerer ikkje" | Kan vere deaktivert | Sjekk om modellen er aktivert i konfigurasjon |

### Fast Model (intern optimalisering)

- Mimir brukar ein raskare modell (`gpt-4o-mini`) internt for:
  - Uttrekk av brukar-intensjon
  - Uttrekk av målgruppe
  - Arbeidsminne-ekstraksjon
- Dette er **ikkje synleg for brukaren**, men kan påverke kvaliteten på kontekstforståinga

### Token-grenser

| Parameter | Verdi |
|-----------|-------|
| Maks completion-tokens | 16 384 per svar |
| Maks kontekst (system + historikk + dokument) | Modellspesifikt |
| Historikk-meldingar | Opptil 100, token-budsjettert |

---

## 9. Papirkorg og arkiv

### Korleis arkivering fungerer

1. Brukaren klikkar **slett (🗑️)** på ein samtale
2. Samtalen vert **mjuksletta** (soft delete):
   - Kopi vert laga i arkiv-containerar i Cosmos DB
   - Original vert sletta frå aktive containerar
   - Semantiske minner vert fjerna frå aktiv indeks
3. Samtalen er tilgjengeleg i **Papirkorg** i 180 dagar
4. Automatisk opprydding køyrer kvar 24. time og slettar arkiv eldre enn 180 dagar

### Papirkorg-funksjonar

| Handling | Kven kan gjere det | Merknad |
|----------|-------------------|---------|
| **Sjå arkivert samtale** | Alle deltakarar | Les meldingshistorikk |
| **Gjenopprette samtale** | Alle deltakarar | Flyttar tilbake til aktive samtalar |
| **Slette permanent** | Berre den som arkiverte | Kan ikkje angrast |

### API-endepunkt for arkiv

| Endepunkt | Metode | Funksjon |
|-----------|--------|----------|
| `/chats/trash` | GET | Liste over arkiverte samtalar |
| `/chats/trash/{chatId}` | GET | Detaljar om arkivert samtale |
| `/chats/trash/{chatId}/messages` | GET | Meldingar i arkivert samtale |
| `/chats/trash/{chatId}/restore` | POST | Gjenopprett samtale |
| `/chats/trash/{chatId}` | DELETE | Slett permanent |

### Arkiv-problem

| Problem | Årsak | Løysing |
|---------|-------|---------|
| "Finn ikkje sletta samtale" | Over 180 dagar sidan sletting | Samtalen er permanent sletta |
| "Kan ikkje gjenopprette" | Autentiseringsproblem | Sjekk at brukar er logga inn |
| "Kan ikkje slette permanent" | Ikkje den som arkiverte | Berre den som sletta kan slette permanent |

---

## 10. Rateavgrensing og yting

### Grenser per brukar

| Type | Grense |
|------|--------|
| Meldingar per minutt | **20** |
| Meldingar per time | **200** |
| Samtidige førespurnader | **5** |

### Globale grenser

| Type | Grense |
|------|--------|
| Globale førespurnader per minutt | **1 000** |

### Rate-limit-problem

| Problem | Symptom | Løysing |
|---------|---------|---------|
| "For mange meldingar" | 429-feil | Be brukaren vente 1 minutt |
| "Svar tek lang tid" | Generelt treig | Sjekk om det er høg belastning |
| "Timeout" | Svar kjem ikkje | Prøv igjen, sjekk nettverket |

> **Merk:** HTTP-klient-timeout for AI-kall er 5 minutt. Komplekse spørsmål med mange verktøy kan ta lang tid.

---

## 11. Vanlege feilmeldingar og løysingar

### Frontend-feil

| Feilmelding / symptom | Årsak | Løysing |
|------------------------|-------|---------|
| **Tenesta er utilgjengeleg** (overlay) | Backend nede, eller Azure OpenAI nede | Sjekk tjenestestatus, vent og prøv igjen |
| **Noko gjekk gale** | Generell feil frå backend | Oppdater sida, prøv igjen |
| **Innlogging feila** | Token utløpt / Azure AD-problem | Logg ut, tøm cache, logg inn |
| **Svaret stoppa midt i** | Token-grense nådd | Be brukaren skrive "Hald fram" |
| **Tomt svar** | Innhaldsfilter utløyst | Omformuler spørsmålet |
| **Bilete lastar ikkje opp** | Ugyldige format eller for stor fil | Bruk PNG/JPG, sjekk storleik |
| **Diagram viser ikkje** | Mermaid-syntaksfeil | Be Mimir fikse diagrammet |
| **Sida reagerer ikkje** | JavaScript-feil, minneproblem | Hard refresh (Ctrl+Shift+R) |

### Backend-feil (frå logg)

| Feil | Årsak | Handling |
|------|-------|---------|
| `ClientResultException` | Azure OpenAI-kall feila | Sjekk modell-deployment i Azure |
| `401 Unauthorized` | Ugyldig token | Brukar må logge inn på nytt |
| `403 Forbidden` | Ikkje tilgang til ressurs | Sjekk Azure AD-gruppetilhøyrsle |
| `429 Too Many Requests` | Rate limit | Vent, eller auk grenser i konfig |
| `503 Service Unavailable` | Azure OpenAI-teneste nede | Sjekk Azure Service Health |
| `RequestFailedException` | Cosmos DB / Blob Storage-feil | Sjekk Azure-ressursstatus |
| `SignalR connection failed` | WebSocket-problem | Sjekk nettverket, oppdater sida |

### Nettlesarspesifikke problem

| Nettlesar | Kjent problem | Løysing |
|-----------|--------------|---------|
| Internet Explorer | Ikkje støtta | Bruk Edge, Chrome eller Firefox |
| Eldre Safari | WebSocket-problem | Oppdater Safari |
| Bedrifts-proxy | SignalR blokkert | Sjekk at WebSocket er tillate |
| Chrome med utvidingar | Adblockers kan blokkere API-kall | Deaktiver utvidingar for Mimir-domenet |

---

## 12. Assistentmalar (Personas)

### Tilgjengelege malar

| Mal | Status | Tilgang | Spesielle verktøy |
|-----|--------|---------|-------------------|
| **Standard** | Aktiv | Alle | Filgenerering, diagram |
| **Klarspråk-assistent** | Deaktivert | – | Tekstforbetring, klarspråk-analyse |
| **Leiar-assistent** | Aktiv | Leiar-grupper | SharePoint, Lovdata, strategidokument |

### Leiar-assistent

- Har tilgang til **SharePoint-søk** (HR-dokument, kvalitet, HMS)
- Har tilgang til **Lovdata** (lover og forskrifter)
- Har tilgang til **LeiarKontekst** (strategidokument via AI Search)
- Tilgangen vert styrt av Azure AD-grupper

### Mal-problem

| Problem | Årsak | Løysing |
|---------|-------|---------|
| "Ser ikkje Leiar-assistent" | Ikkje i rett AD-gruppe | Sjekk gruppetilhøyrsle |
| "Verktøy fungerer ikkje" | Plugin deaktivert | Eskaler til andrelinje |
| "Mimir svarar på feil språk" | Feil i systeminstruksjonar | Sjekk eigne instruksjonar i Tilpassing |

---

## 13. Verktøy og plugins

### Aktive plugins

| Plugin | Funksjon | Krev godkjenning |
|--------|----------|-----------------|
| **SharePoint OBO** | Søk i SharePoint med brukar sin tilgang | Nei |
| **LeiarKontekst** | Søk i strategidokument (AI Search) | Nei |
| **MimirKnowledge** | Søk i Mimir kunnskapsbase | Nei |
| **Lovdata** | Oppslag i norske lover og forskrifter | Nei |
| **Filgenerering** | Lage Word, Excel, PowerPoint, PDF | Nei |
| **Dato/tid** | Hente gjeldande dato og tid | Nei |

### Plugin-problem

| Problem | Årsak | Løysing |
|---------|-------|---------|
| "SharePoint-søk finn ingenting" | Brukar manglar tilgang til SharePoint-sida | Sjekk SharePoint-tilgang |
| "Lovdata gir timeout" | Lovdata API treig/nede | Prøv igjen seinare |
| "Filgenerering feiler" | Kompleks formatering | Prøv med enklare innhald |
| "Verktøy vert ikkje brukt" | Mimir vurderte det ikkje relevant | Be eksplisitt om å bruke verktøyet |

---

## 14. SignalR og sanntidskommunikasjon

### Korleis det fungerer

- Mimir brukar **SignalR** (WebSockets) for sanntidskommunikasjon
- Viktig for:
  - Streaming av AI-svar (ord for ord)
  - Synkronisering i delte samtalar
  - Varsling om nye deltakarar
  - Dokumentopplastings-notifikasjonar

### SignalR-problem

| Problem | Symptom | Løysing |
|---------|---------|---------|
| Svar strøymar ikkje | Svar kjem som ein klump | Sjekk WebSocket-støtte i nettverket |
| Delte meldingar synast ikkje | Andre ser ikkje nye meldingar | Oppdater sida (F5) |
| Tilkoplinga droppar | Hyppige reconnect-meldingar | Sjekk nettverksstabilitet |
| Proxy blokkerer WebSocket | Ingen sanntidsoppdateringar | Kontakt nettverksansvarleg |

---

## 15. Logging og overvaking

### Application Insights

Backend loggar til **Application Insights**. Nyttige KQL-spørjingar:

#### Nyaste feil (siste 24 timar)

```kql
exceptions
| where timestamp > ago(24h)
| order by timestamp desc
| take 50
```

#### Azure OpenAI-kall

```kql
dependencies
| where type == "HTTP" and name contains "openai"
| where timestamp > ago(1h)
| summarize count(), avg(duration) by resultCode
```

#### Feil gruppert etter type

```kql
exceptions
| where timestamp > ago(7d)
| summarize count() by type, outerMessage
| order by count_ desc
```

### Loggnivå

| Komponent | Standard loggnivå |
|-----------|-------------------|
| CopilotChat.WebApi | Information |
| Microsoft.SemanticKernel | Information |
| Microsoft.AspNetCore | Information |
| Alt anna | Warning |

---

## 16. Sjekkliste for vanleg feilsøking

### Brukar kan ikkje logge inn

- [ ] Er brukaren i Vestland fylkeskommune sin Azure AD-tenant?
- [ ] Har brukaren ein aktiv konto?
- [ ] Prøv å tømme nettlesarcache (Ctrl+Shift+Delete)
- [ ] Prøv i ein annan nettlesar (helst Edge eller Chrome)
- [ ] Prøv inkognitomodus
- [ ] Sjekk om Azure AD-tenesta er oppe

### Mimir gir dårlege svar

- [ ] Bli med i samtalen via "Del samtaleøkt" (sjå [seksjon 4](#4-bli-invitert-inn-i-ein-brukar-sin-chat-del-samtaleøkt))
- [ ] Sjekk info-knappen (ℹ️) for prompt-detaljar
- [ ] Sjekk kva modell brukaren brukar
- [ ] Sjekk om relevante dokument er festa (📌)
- [ ] Sjekk eigne instruksjonar i Tilpassing-fana
- [ ] Sjekk om spørsmålet er tydeleg formulert
- [ ] Prøv å byte modell (t.d. til GPT-5.2 Chat)

### Dokument fungerer ikkje

- [ ] Er fila under 50 MB?
- [ ] Er filtypen støtta?
- [ ] Er dokumentet ferdig prosessert (ingen framdriftsindikator)?
- [ ] Er dokumentet festa med 📌?
- [ ] Prøv å slette og laste opp dokumentet på nytt

### Mimir er treig

- [ ] Kva modell er valt? (Reasoning-modellar er tregare)
- [ ] Sjekk rate-limit (maks 20 meldingar/minutt)
- [ ] Er det høg belastning generelt? (Sjekk Application Insights)
- [ ] Sjekk brukarens nettverkstilkopling

### Deling fungerer ikkje

- [ ] Er "Flerbrukar-samtalar" aktivert?
- [ ] Er Chat-ID-en korrekt kopiert?
- [ ] Er begge brukarane logga inn?
- [ ] Er samtalen framleis aktiv (ikkje sletta/arkivert)?

---

## 17. Eskalering til andrelinje

### Når skal du eskalere?

Eskaler til andrelinje/utviklarteamet viss:

- Azure AD-konfigurasjonsproblem (AADSTS-feil)
- Azure OpenAI-tenesta er nede
- Cosmos DB / Blob Storage er utilgjengeleg
- Gjentakande 500-feil frå backend
- Problem som ikkje let seg løyse med standard feilsøking
- Brukaren treng endringar i konfigurasjon (nye modellar, plugins, etc.)
- Tryggleikshendingar (datalekkasje, uautorisert tilgang)

### Kva du bør inkludere ved eskalering

1. **Beskriving av problemet** – kva brukaren opplever
2. **Tidspunkt** – når problemet oppstod
3. **Brukar-ID / e-post** – for å søke i loggar
4. **Chat-ID** – viss relevant (frå del samtaleøkt)
5. **Skjermbilete** – av feilmeldinga
6. **Nettlesar og OS** – t.d. Edge på Windows 11
7. **Steg du har prøvd** – kva feilsøking du allereie har gjort
8. **Info-knapp-data** – viss du har vore inne i samtalen, ta med relevant info frå prompt-dialogen

### Kontaktinformasjon

- **Meld inn feil:** [hjelp.vlfk.no](https://hjelp.vlfk.no/tas/public/ssp/content/detail/service?unid=9dfe7a3d4190448dbbdbcb5b2b7fa24d&from=e26ea254-56fe-4968-8fff-30edb0390924)
- **Utviklarteam:** Kontakt via intern Teams-kanal

---

*Sist oppdatert: Februar 2026*
