<#
.SYNOPSIS
    Creates the leiar-dokumenter Azure AI Search index and uploads documentation.

.DESCRIPTION
    This script:
    1. Creates the search index with proper schema and semantic configuration
    2. Reads documents from "leiar documents/" folder
    3. Extracts PDF content using Python (PyMuPDF)
    4. Uploads documents to the index

.PARAMETER SearchServiceName
    The name of the Azure AI Search service (default: acs-copichat-4kt5uxo2hrzri)

.PARAMETER ApiKey
    The admin API key for the Azure AI Search service

.PARAMETER IndexName
    The name of the index to create (default: leiar-dokumenter)

.PARAMETER SkipExtraction
    Skip PDF extraction and use previously extracted content from extracted-content folder

.PARAMETER AzureDIEndpoint
    Azure Document Intelligence endpoint for OCR and complex PDF extraction

.PARAMETER AzureDIKey
    Azure Document Intelligence API key

.PARAMETER ForceAzureDI
    Always use Azure Document Intelligence for all PDFs (not just ones with images)

.PARAMETER StripHtml
    Remove HTML tags from extracted content (cleaner output for search)

.EXAMPLE
    .\setup-leiar-dokumenter-index.ps1 -ApiKey "your-admin-api-key-from-azure-portal"
    
.EXAMPLE
    .\setup-leiar-dokumenter-index.ps1 -ApiKey "your-key" -AzureDIEndpoint "https://your-resource.cognitiveservices.azure.com/" -AzureDIKey "your-di-key"

.EXAMPLE
    .\setup-leiar-dokumenter-index.ps1 -ApiKey "your-key" -SkipExtraction
#>

param(
    [string]$SearchServiceName = "acs-copichat-4kt5uxo2hrzri",
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,
    [string]$IndexName = "leiar-dokumenter",
    [switch]$SkipExtraction,
    [string]$AzureDIEndpoint,
    [string]$AzureDIKey,
    [switch]$ForceAzureDI,
    [switch]$StripHtml
)

$ErrorActionPreference = "Stop"

# Ensure UTF-8 encoding for API calls
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Configuration
$SearchEndpoint = "https://$SearchServiceName.search.windows.net"
$ApiVersion = "2023-11-01"
$DocsPath = Join-Path $PSScriptRoot "..\..\leiar documents"
$ExtractedContentPath = Join-Path $PSScriptRoot "extracted-content"
$PythonScript = Join-Path $PSScriptRoot "extract-pdf-content.py"

Write-Host "=== Leiar Dokumenter Index Setup ===" -ForegroundColor Cyan
Write-Host "Search Service: $SearchServiceName"
Write-Host "Index Name: $IndexName"
Write-Host "Docs Path: $DocsPath"
Write-Host ""

# Headers for API calls
$headers = @{
    "Content-Type" = "application/json"
    "api-key" = $ApiKey
}

# Step 0: Extract PDF content using Python
if (-not $SkipExtraction) {
    Write-Host "Step 0: Extracting PDF content..." -ForegroundColor Yellow
    
    # Check if Python is available
    $python = Get-Command "python" -ErrorAction SilentlyContinue
    if (-not $python) {
        $python = Get-Command "python3" -ErrorAction SilentlyContinue
    }
    
    if (-not $python) {
        Write-Host "  ERROR: Python not found. Please install Python 3.8+ and try again." -ForegroundColor Red
        Write-Host "  Alternatively, run with -SkipExtraction if you have already extracted the content." -ForegroundColor Yellow
        exit 1
    }
    
    # Check and install Python dependencies
    Write-Host "  Checking Python dependencies..." -ForegroundColor Gray
    Write-Host "  Using Python: $($python.Source)" -ForegroundColor Gray
    
    # Install PyMuPDF using the same Python that will run the script
    $checkPyMuPDF = & $python.Source -c "import fitz; print('ok')" 2>&1
    if ($checkPyMuPDF -ne "ok") {
        Write-Host "  Installing PyMuPDF..." -ForegroundColor Gray
        & $python.Source -m pip install pymupdf --user --quiet --disable-pip-version-check
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ERROR: Failed to install PyMuPDF" -ForegroundColor Red
            exit 1
        }
    }
    
    # Check Azure DI SDK if credentials provided
    if ($AzureDIEndpoint -and $AzureDIKey) {
        $checkAzureDI = & $python.Source -c "from azure.ai.documentintelligence import DocumentIntelligenceClient; print('ok')" 2>&1
        if ($checkAzureDI -ne "ok") {
            Write-Host "  Installing Azure Document Intelligence SDK..." -ForegroundColor Gray
            & $python.Source -m pip install azure-ai-documentintelligence --user --quiet --disable-pip-version-check
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  ERROR: Failed to install Azure Document Intelligence SDK" -ForegroundColor Red
                exit 1
            }
            # Verify installation
            $verifyAzureDI = & $python.Source -c "from azure.ai.documentintelligence import DocumentIntelligenceClient; print('ok')" 2>&1
            if ($verifyAzureDI -ne "ok") {
                Write-Host "  ERROR: Azure Document Intelligence SDK not found after installation" -ForegroundColor Red
                Write-Host "  Python path: $($python.Source)" -ForegroundColor Yellow
                Write-Host "  Try: $($python.Source) -m pip install azure-ai-documentintelligence" -ForegroundColor Yellow
                exit 1
            }
            Write-Host "  Azure Document Intelligence SDK installed successfully" -ForegroundColor Green
        } else {
            Write-Host "  Azure Document Intelligence SDK found" -ForegroundColor Green
        }
    }
    
    # Run extraction
    Write-Host "  Running PDF extraction..." -ForegroundColor Gray
    
    $extractArgs = @("-i", $DocsPath, "-o", $ExtractedContentPath)
    
    if ($AzureDIEndpoint -and $AzureDIKey) {
        Write-Host "  Using Azure Document Intelligence for OCR and complex PDFs" -ForegroundColor Cyan
        $extractArgs += "--azure-endpoint"
        $extractArgs += $AzureDIEndpoint
        $extractArgs += "--azure-key"
        $extractArgs += $AzureDIKey
        
        if ($ForceAzureDI) {
            $extractArgs += "--force-azure"
            Write-Host "  (Forced for all documents)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  Using PyMuPDF (local extraction)" -ForegroundColor Gray
        Write-Host "  Tip: Add -AzureDIEndpoint and -AzureDIKey for OCR support" -ForegroundColor Gray
    }
    
    if ($StripHtml) {
        $extractArgs += "--strip-html"
        Write-Host "  HTML tags will be stripped from output" -ForegroundColor Gray
    }
    
    & $python.Source $PythonScript @extractArgs
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: PDF extraction failed." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  PDF extraction complete!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Step 0: Skipping PDF extraction (using existing content)" -ForegroundColor Yellow
    if (-not (Test-Path $ExtractedContentPath)) {
        Write-Host "  ERROR: Extracted content folder not found: $ExtractedContentPath" -ForegroundColor Red
        Write-Host "  Run without -SkipExtraction first to extract PDF content." -ForegroundColor Yellow
        exit 1
    }
    Write-Host ""
}

# Document metadata mapping with descriptions
# Each document has an id, title, category, and description
$documentMeta = @{
    "2025_Presentasjon-av-ny-som-leiar.pdf" = @{
        id = "presentasjon-ny-leiar"
        title = "Presentasjon av ny som leiar 2025"
        category = "onboarding"
        description = "Presentasjon og informasjon for nye leiarar i Vestland fylkeskommune. Introduksjon til leiarrolla og organisasjonen."
    }
    "2025.02-Støttedokument-til-medarbeidarsamtale-for-leiarar-og-medarbeidarar.pdf" = @{
        id = "stottedokument-medarbeidarsamtale"
        title = "Støttedokument til medarbeidarsamtale for leiarar og medarbeidarar"
        category = "medarbeidarsamtale"
        description = "Støttedokument med rettleiing for gjennomføring av medarbeidarsamtalar. Inneheld spørsmål og tema for samtalen mellom leiar og medarbeidar. Korleis førebu, gjennomføre og følgje opp medarbeidarsamtalen. Kompetanseutvikling, trivsel, arbeidsmiljø, mål og forventningar."
    }
    "Arbeidsreglement.pdf" = @{
        id = "arbeidsreglement"
        title = "Arbeidsreglement for Vestland fylkeskommune"
        category = "reglement"
        description = "Arbeidsreglement som gjeld for alle tilsette i Vestland fylkeskommune. Inneheld reglar om arbeidstid, fleksitid, fråvær, permisjonar og plikter. Kjernetid, pausar, overtid, avspasering. Tilsettingsvilkår, prøvetid, oppseiing."
    }
    "Endelig organisasjonsstrategi VLFK 24 (1).pdf" = @{
        id = "organisasjonsstrategi"
        title = "Organisasjonsstrategi for Vestland fylkeskommune 2024"
        category = "strategi"
        description = "Overordna organisasjonsstrategi for Vestland fylkeskommune. Visjon, mål og strategiske satsingsområde for organisasjonen."
    }
    "Etiske retningslinjer for tilsette i Vestland fylkeskommune.pdf" = @{
        id = "etiske-retningslinjer"
        title = "Etiske retningslinjer for tilsette i Vestland fylkeskommune"
        category = "retningslinjer"
        description = "Etiske retningslinjer som gjeld for alle tilsette. Handlar om integritet, lojalitet, openheit og respekt i arbeidskvardagen."
    }
    "Handlingsplan-Likestilt-arbeidsliv-Vestland-fylkeskommune.pdf" = @{
        id = "handlingsplan-likestilling"
        title = "Handlingsplan for likestilt arbeidsliv i Vestland fylkeskommune"
        category = "likestilling"
        description = "Handlingsplan for å fremje likestilling og mangfald i arbeidslivet. Tiltak og mål for eit inkluderande arbeidsmiljø."
    }
    "Handsaming av personalsaker.pdf" = @{
        id = "handsaming-personalsaker"
        title = "Handsaming av personalsaker"
        category = "personal"
        description = "Retningslinjer for handsaming av personalsaker. Prosedyrar for advarslar, skriftleg åtvaring, oppseiing, avskjed og andre personalsaker. Drøftingsmøte, dokumentasjon, arbeidsgjevar sitt ansvar. HR-støtte, juridisk rettleiing."
    }
    "Hovedtariffavtalen-2024-2026-interactive-120924.pdf" = @{
        id = "hovedtariffavtalen"
        title = "Hovedtariffavtalen 2024-2026"
        category = "tariff"
        description = "Hovedtariffavtalen (HTA) for kommunal og fylkeskommunal sektor 2024-2026. Lønns- og arbeidsvilkår, ferierettar, stillingskoder, lønnstabell, lønnsforhandling, tariffoppgjer. Overtid, tillegg, arbeidstid, permisjon, pensjon. KS-området."
    }
    "Kompetansestrategi.pdf" = @{
        id = "kompetansestrategi"
        title = "Kompetansestrategi for Vestland fylkeskommune"
        category = "strategi"
        description = "Strategi for kompetanseutvikling i organisasjonen. Mål og tiltak for å sikre rett kompetanse for framtida."
    }
    "Konflikthandtering.pdf" = @{
        id = "konflikthandtering"
        title = "Konflikthandtering"
        category = "arbeidsmiljo"
        description = "Retningslinjer og metodar for handtering av konfliktar på arbeidsplassen. Førebygging, varsling og løysing av konfliktar. Samarbeidsproblem, mobbing, trakassering. Mekling, dialog, arbeidsmiljøutval (AMU). Leiar sitt ansvar ved konflikt."
    }
    "Medarbeidarsamtalen.txt" = @{
        id = "medarbeidarsamtalen"
        title = "Medarbeidarsamtalen - Rettleiing og gjennomføring"
        category = "medarbeidarsamtale"
        description = "Informasjon om medarbeidarsamtalen i Vestland fylkeskommune. Formål, gjennomføring og oppfølging."
    }
    "Mottak og registrering av gåver og andre fordelar.pdf" = @{
        id = "gaver-fordelar"
        title = "Mottak og registrering av gåver og andre fordelar"
        category = "retningslinjer"
        description = "Retningslinjer for mottak av gåver og fordelar. Kva som er tillatt, grenser og korleis ein skal registrere mottatte gåver."
    }
    "Overordna kompetanseplan.pdf" = @{
        id = "overordna-kompetanseplan"
        title = "Overordna kompetanseplan"
        category = "kompetanse"
        description = "Overordna plan for kompetanseutvikling og opplæring i Vestland fylkeskommune."
    }
    "Retningsline om heimekontor og om arbeid utført i arbeidstakars heim.pdf" = @{
        id = "heimekontor-retningslinjer"
        title = "Retningslinjer om heimekontor og arbeid utført i arbeidstakars heim"
        category = "arbeidstid"
        description = "Retningslinjer for heimekontor og fjernarbeid. Vilkår, avtalar og praktisk gjennomføring av arbeid heimefrå. Heimekontorforskrift, arbeidsmiljø heime, utstyr, forsikring. Søknad om heimekontor, avtale med arbeidsgjevar."
    }
    "Rutine for handsaming av klage på skriftleg åtvaring.pdf" = @{
        id = "klage-atvaring-rutine"
        title = "Rutine for handsaming av klage på skriftleg åtvaring"
        category = "personal"
        description = "Rutine for korleis klagar på skriftlege åtvaringar skal handsamast. Prosess, fristar og klagerett."
    }
    "Samtalemal---medarbeidarsamtalen.pdf" = @{
        id = "samtalemal-medarbeidarsamtalen"
        title = "Samtalemal for medarbeidarsamtalen"
        category = "medarbeidarsamtale"
        description = "Mal med spørsmål og tema for gjennomføring av medarbeidarsamtalen. Strukturert opplegg for samtalen."
    }
    "Varslingsrutinen.pdf" = @{
        id = "varslingsrutinen"
        title = "Varslingsrutinen"
        category = "varsling"
        description = "Rutine for varsling av kritikkverdige forhold på arbeidsplassen. Korleis varsle, kven ein kan varsle til og vern av varslarar. Varslingskanal, anonymitet, gjengjeldelse. Arbeidsmiljølova kapittel 2A. Saksgang ved varsling, oppfølging av varslar."
    }
    "Handbok porteføljeløypa (1).pdf" = @{
        id = "handbok-portefoljeloypa"
        title = "Handbok for porteføljeløypa"
        category = "prosjekt"
        description = "Handbok for porteføljestyring og prosjektgjennomføring i Vestland fylkeskommune. Rettleiing for prosjektleiarar, prosjekteigarar og porteføljestyring. Idéfase, konseptfase, gjennomføringsfase, gevinstrealisering. Porteføljeråd, porteføljekontoret, PMO, innmelding av prosjekt."
    }
    "Innhaldsstrategi og rettleiar for vestlandfylke.no_September 2022.pdf" = @{
        id = "innhaldsstrategi-nettstad"
        title = "Innhaldsstrategi og rettleiar for vestlandfylke.no"
        category = "kommunikasjon"
        description = "Innhaldsstrategi og rettleiing for publisering på vestlandfylke.no. Korleis skrive godt innhald for nettsida."
    }
    "Kommunikasjonsstrategi for Vestland fylkeskommune.txt" = @{
        id = "kommunikasjonsstrategi"
        title = "Kommunikasjonsstrategi for Vestland fylkeskommune"
        category = "kommunikasjon"
        description = "Overordna kommunikasjonsstrategi for Vestland fylkeskommune. Prinsipp og retningslinjer for intern og ekstern kommunikasjon."
    }
    "Overordna kommunikasjonsstrategi  for Vestland fylkeskommune_September 2022.pdf" = @{
        id = "overordna-kommunikasjonsstrategi"
        title = "Overordna kommunikasjonsstrategi for Vestland fylkeskommune"
        category = "kommunikasjon"
        description = "Overordna kommunikasjonsstrategi vedtatt september 2022. Visjon, mål og strategiske prinsipp for kommunikasjonsarbeidet."
    }
    "Overordna retningslinjer for språkbruk i Vestland fylkeskommune, 3. utg.pdf" = @{
        id = "retningslinjer-spraakbruk"
        title = "Overordna retningslinjer for språkbruk i Vestland fylkeskommune"
        category = "sprak"
        description = "Retningslinjer for språkbruk og språkval i Vestland fylkeskommune. Nynorsk som hovudmål og krav til språkleg kvalitet."
    }
    "Rettleiar-for-korleis-skrive-ei-politisk-sak-pdf.pdf" = @{
        id = "rettleiar-politisk-sak"
        title = "Rettleiar for korleis skrive ei politisk sak"
        category = "sakshandsaming"
        description = "Rettleiing for korleis ein skriv ei god politisk sak. Struktur, innhald og krav til saksdokument til politisk handsaming."
    }
    "Språkprofil 2024_revidert des.pdf" = @{
        id = "spraakprofil"
        title = "Språkprofil for Vestland fylkeskommune 2024"
        category = "sprak"
        description = "Språkprofil for Vestland fylkeskommune. Rettleiing for klarspråk, tone og stil i skriftleg kommunikasjon."
    }
    "Dette kan porteføljekontoret hjelpe med.txt" = @{
        id = "portefoljekontoret-hjelp"
        title = "Dette kan porteføljekontoret hjelpe med"
        category = "prosjekt"
        description = "Oversikt over kva porteføljekontoret (PMO) kan hjelpe med. Inneheld lenke til innmeldingsskjema i PowerApps, informasjonsside på SharePoint. Beskriv korleis melde inn ei sak, prosjekt eller tiltak til porteføljekontoret. Porteføljestyring, prosjektinnmelding, prosjektidé, konseptfase, porteføljeråd, kontaktperson."
    }
    "Ordliste norsk-engelsk navn på avdelingar, seksjonar og stillingar på engelsk.txt" = @{
        id = "ordliste-norsk-engelsk"
        title = "Ordliste norsk-engelsk for avdelingar, seksjonar og stillingar"
        category = "sprak"
        description = "Ordliste med norske og engelske namn på avdelingar, seksjonar og stillingar i Vestland fylkeskommune."
    }
    "Rutine for krav om skriftleg kommunikasjon frå staten og andre fylkeskommunar på nynorsk.txt" = @{
        id = "rutine-nynorsk-krav"
        title = "Rutine for krav om skriftleg kommunikasjon på nynorsk"
        category = "sprak"
        description = "Rutine for å krevje skriftleg kommunikasjon på nynorsk frå staten og andre fylkeskommunar. Mållova og språkrettar."
    }
    "om-tillitsreformen.pdf" = @{
        id = "om-tillitsreformen"
        title = "Om tillitsreformen"
        category = "leiing"
        description = "Informasjon om tillitsreformen i offentleg sektor. Mål, prinsipp og bakgrunn for tillitsbasert styring og leiing. Korleis tillitsreformen påverkar kommunal og fylkeskommunal verksemd."
    }
    "Tillitsarbeid i praksis _ Statens arbeidsgiverportal.pdf" = @{
        id = "tillitsarbeid-praksis"
        title = "Tillitsarbeid i praksis"
        category = "leiing"
        description = "Praktisk rettleiing for tillitsarbeid i offentleg sektor frå Statens arbeidsgiverportal. Korleis implementere tillitsbasert styring, metodar og verktøy. Erfaringar og døme på tillitsarbeid."
    }
    "Tillitsbasert ledelse og selvledelse _ Statens arbeidsgiverportal.pdf" = @{
        id = "tillitsbasert-leiing-selvleiing"
        title = "Tillitsbasert ledelse og selvledelse"
        category = "leiing"
        description = "Rettleiing om tillitsbasert leiing og selvleiing frå Statens arbeidsgiverportal. Prinsipp for autonomi, ansvar og tillit i leiing. Korleis fremje selvleiing og medarbeidarskap."
    }
    "Lenke til kurs i klart språk.txt" = @{
        id = "kurs-klart-spraak"
        title = "Lenke til kurs i klart språk"
        category = "sprak"
        description = "Lenke til kurs om klart språk og klarspråk. Opplæring i korleis skrive tydeleg og forståeleg. Kurs i god skriving for offentleg sektor."
    }
    "Lenke til kurs skrive politisk sak.txt" = @{
        id = "kurs-politisk-sak"
        title = "Lenke til kurs i å skrive politisk sak"
        category = "sakshandsaming"
        description = "Lenke til kurs om korleis skrive politiske saker. Opplæring i saksframlegg, saksutgreiing og politisk sakshandsaming."
    }
    "Politisk-saksbehandling-i-Elements.pdf" = @{
        id = "politisk-saksbehandling-elements"
        title = "Politisk saksbehandling i Elements"
        category = "sakshandsaming"
        description = "Rettleiing for politisk saksbehandling i Elements sak- og arkivsystem. Korleis opprette, handsame og arkivere politiske saker. Arbeidsflyt og rutinar i Elements."
    }
    "Rettleiar-for-korleis-skrive-ei-politisk-sak.pdf" = @{
        id = "rettleiar-politisk-sak-v2"
        title = "Rettleiar for korleis skrive ei politisk sak"
        category = "sakshandsaming"
        description = "Rettleiing for korleis ein skriv ei god politisk sak. Struktur, innhald og krav til saksdokument til politisk handsaming. Saksframlegg, bakgrunn, vurdering og tilråding."
    }
    "Utforming av politiske vedtak i Vestland fylkeskommune.pdf" = @{
        id = "utforming-politiske-vedtak"
        title = "Utforming av politiske vedtak i Vestland fylkeskommune"
        category = "sakshandsaming"
        description = "Rettleiing for utforming av politiske vedtak. Korleis skrive gode vedtakstekstar, formulere vedtak og sikre juridisk korrekte vedtak. Vedtaksformulering, tilrådingsvedtak, endringsframlegg."
    }
    "Rettleiing for forbetringsforslag-skjema.md" = @{
        id = "forbetringsforslag-skjema"
        title = "Rettleiing for forbetringsforslag-skjema"
        category = "prosjekt"
        description = "Rettleiing for korleis fylle ut forbetringsforslag-skjemaet i Vestland fylkeskommune. Forklaring av alle felt: type forslag, tittel, behov og problem, gevinstar, systemeigar, systemforvaltar, interessentar, finansiering, startdato. Hjelp til å førebu innmelding av idé, behov eller forbetringsforslag til porteføljekontoret."
    }
    "Lenke til Innmeldingsskjema Porteføljestyring.txt" = @{
        id = "lenke-innmeldingsskjema-portefolje"
        title = "Lenke til innmeldingsskjema for porteføljestyring"
        category = "prosjekt"
        description = "Direktelenke til innmeldingsskjema for porteføljestyring. Bruk denne lenka for å melde inn prosjekt, idear eller forbetringsforslag til porteføljekontoret (PMO). Forbetringsforslag, prosjektinnmelding, idéfase."
    }
    "Lenke til Porteføljestyring og strategi.txt" = @{
        id = "lenke-portefoljestyring-strategi"
        title = "Lenke til porteføljestyring og strategi"
        category = "prosjekt"
        description = "Lenke til informasjonsside om porteføljestyring og strategi i Vestland fylkeskommune. Informasjon om porteføljekontoret, prosjektstyring, porteføljeløypa og strategisk planlegging."
    }
    "Gevinst definisjonar, og og utrykk.txt" = @{
        id = "gevinst-definisjonar"
        title = "Gevinst - definisjonar og uttrykk"
        category = "prosjekt"
        description = "Definisjonar og forklaringar av omgrep knytt til gevinstrealisering. Kva er ein gevinst, gevinstrealisering, gevinstplan, KPI, måleindikator. Ordliste for gevinstarbeid i prosjekt."
    }
    "Gevinstansvarleg.txt" = @{
        id = "gevinstansvarleg"
        title = "Gevinstansvarleg - rolle og ansvar"
        category = "prosjekt"
        description = "Informasjon om rolla som gevinstansvarleg i prosjekt. Ansvar, oppgåver og forventningar til gevinstansvarleg. Korleis sikre at gevinstar blir realiserte etter prosjektslutt."
    }
    "Gevinstarbeid i ulike faser av prosjekt.txt" = @{
        id = "gevinstarbeid-fasar"
        title = "Gevinstarbeid i ulike faser av prosjekt"
        category = "prosjekt"
        description = "Rettleiing for gevinstarbeid gjennom heile prosjektløpet. Idéfase, konseptfase, gjennomføringsfase, avslutning og gevinstrealisering. Når og korleis jobbe med gevinstar i kvar fase."
    }
    "Gevinstverktøy.pdf" = @{
        id = "gevinstverktoey"
        title = "Gevinstverktøy"
        category = "prosjekt"
        description = "Verktøy og malar for gevinstarbeid i prosjekt. Gevinstplan, gevinstkart, gevinstoppfølging, måling og rapportering av gevinstar. Praktiske hjelpemiddel for gevinstrealisering."
    }
    "Lenke til gevinst side sharepoint.txt" = @{
        id = "lenke-gevinst-sharepoint"
        title = "Lenke til gevinstside på SharePoint"
        category = "prosjekt"
        description = "Direktelenke til informasjonsside om gevinstrealisering på SharePoint. Ressursar, malar og rettleiing for gevinstarbeid i Vestland fylkeskommune."
    }
    "Lenke til prosjektportalen.txt" = @{
        id = "lenke-prosjektportalen"
        title = "Lenke til prosjektportalen"
        category = "prosjekt"
        description = "Direktelenke til prosjektportalen i Vestland fylkeskommune. Oversikt over prosjekt, status, framdrift og porteføljestyring. Innlogging og tilgang til prosjektinformasjon."
    }
}

# Maximum content size per document (Azure Search works best with smaller chunks)
$MaxContentSize = 30000  # ~30KB per chunk for better search relevance

# Function to get extracted content for a file
function Get-ExtractedContent {
    param(
        [string]$OriginalFileName,
        [string]$ExtractedPath
    )
    
    # For PDFs, look for the .txt version in extracted folder
    if ($OriginalFileName -match '\.pdf$') {
        $txtFileName = [System.IO.Path]::GetFileNameWithoutExtension($OriginalFileName) + ".txt"
        $extractedFile = Join-Path $ExtractedPath $txtFileName
        
        if (Test-Path $extractedFile) {
            return Get-Content -Path $extractedFile -Raw -Encoding UTF8
        }
    }
    
    return $null
}

# Function to chunk large content into sections
function Split-ContentIntoChunks {
    param(
        [string]$Content,
        [int]$MaxChunkSize = 30000,
        [string]$Title
    )
    
    $chunks = @()
    
    # If content is small enough, return as single chunk
    if ($Content.Length -le $MaxChunkSize) {
        return @(@{
            content = $Content
            section = $null
            part = 1
            total = 1
        })
    }
    
    # Try to split by markdown headers (## or #)
    $sections = $Content -split '(?=\n#{1,2}\s+[^\n]+)'
    
    if ($sections.Count -gt 1) {
        # Split by sections
        $currentChunk = ""
        $chunkNumber = 1
        $sectionName = "Innledning"
        
        foreach ($section in $sections) {
            # Extract section name from header
            if ($section -match '^\n?(#{1,2})\s+(.+)') {
                $sectionName = $Matches[2].Trim()
            }
            
            if (($currentChunk.Length + $section.Length) -gt $MaxChunkSize -and $currentChunk.Length -gt 0) {
                # Save current chunk
                $chunks += @{
                    content = $currentChunk.Trim()
                    section = $sectionName
                    part = $chunkNumber
                    total = 0  # Will be updated later
                }
                $chunkNumber++
                $currentChunk = $section
            } else {
                $currentChunk += $section
            }
        }
        
        # Add final chunk
        if ($currentChunk.Length -gt 0) {
            $chunks += @{
                content = $currentChunk.Trim()
                section = $sectionName
                part = $chunkNumber
                total = 0
            }
        }
    } else {
        # No headers found, split by size with overlap
        $position = 0
        $chunkNumber = 1
        $overlap = 500  # Characters to overlap between chunks
        
        while ($position -lt $Content.Length) {
            $chunkSize = [Math]::Min($MaxChunkSize, $Content.Length - $position)
            $chunk = $Content.Substring($position, $chunkSize)
            
            # Try to end at a paragraph break
            if ($position + $chunkSize -lt $Content.Length) {
                $lastParagraph = $chunk.LastIndexOf("`n`n")
                if ($lastParagraph -gt $MaxChunkSize * 0.7) {
                    $chunk = $chunk.Substring(0, $lastParagraph)
                    $chunkSize = $lastParagraph
                }
            }
            
            $chunks += @{
                content = $chunk.Trim()
                section = "Del $chunkNumber"
                part = $chunkNumber
                total = 0
            }
            
            $position += $chunkSize - $overlap
            $chunkNumber++
        }
    }
    
    # Update total count
    $total = $chunks.Count
    for ($i = 0; $i -lt $chunks.Count; $i++) {
        $chunks[$i].total = $total
    }
    
    return $chunks
}

# Step 1: Delete existing index if it exists
Write-Host "Step 1: Deleting existing index (if any)..." -ForegroundColor Yellow
try {
    $deleteUrl = "$SearchEndpoint/indexes/$($IndexName)?api-version=$ApiVersion"
    Invoke-RestMethod -Uri $deleteUrl -Method Delete -Headers $headers
    Write-Host "  Deleted existing index." -ForegroundColor Green
    Start-Sleep -Seconds 2
} catch {
    Write-Host "  No existing index found (this is OK)." -ForegroundColor Gray
}

# Step 2: Create the index with schema and semantic configuration
Write-Host "Step 2: Creating index with schema..." -ForegroundColor Yellow

$indexSchema = @{
    name = $IndexName
    fields = @(
        @{
            name = "id"
            type = "Edm.String"
            key = $true
            searchable = $false
            filterable = $false
            sortable = $false
            facetable = $false
        },
        @{
            name = "title"
            type = "Edm.String"
            searchable = $true
            filterable = $true
            sortable = $true
            facetable = $false
            analyzer = "nb.microsoft"
        },
        @{
            name = "content"
            type = "Edm.String"
            searchable = $true
            filterable = $false
            sortable = $false
            facetable = $false
            analyzer = "nb.microsoft"
        },
        @{
            name = "source"
            type = "Edm.String"
            searchable = $false
            filterable = $true
            sortable = $false
            facetable = $false
        },
        @{
            name = "category"
            type = "Edm.String"
            searchable = $true
            filterable = $true
            sortable = $false
            facetable = $true
        }
    )
    semantic = @{
        defaultConfiguration = "leiar-semantic-config"
        configurations = @(
            @{
                name = "leiar-semantic-config"
                prioritizedFields = @{
                    titleField = @{
                        fieldName = "title"
                    }
                    prioritizedContentFields = @(
                        @{
                            fieldName = "content"
                        }
                    )
                    prioritizedKeywordsFields = @(
                        @{
                            fieldName = "category"
                        }
                    )
                }
            }
        )
    }
} | ConvertTo-Json -Depth 10

$createIndexUrl = "$SearchEndpoint/indexes?api-version=$ApiVersion"
try {
    $response = Invoke-RestMethod -Uri $createIndexUrl -Method Post -Headers $headers -Body $indexSchema
    Write-Host "  Index created successfully!" -ForegroundColor Green
} catch {
    Write-Host "  Error creating index: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "  Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

Start-Sleep -Seconds 2

# Step 3: Prepare documents (with chunking for large documents)
Write-Host "Step 3: Reading documentation files..." -ForegroundColor Yellow

$documents = @()
$documentsWithContent = 0
$documentsWithoutContent = 0
$chunkedDocuments = 0

foreach ($file in Get-ChildItem -Path $DocsPath -File) {
    $meta = $documentMeta[$file.Name]
    if (-not $meta) {
        Write-Host "  Warning: No metadata for $($file.Name), skipping..." -ForegroundColor Yellow
        continue
    }
    
    $content = $null
    $fileExtension = $file.Extension.ToLower()
    
    if ($fileExtension -eq ".txt") {
        # Read text files directly from source
        $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
        Write-Host "  Prepared (TXT): $($file.Name)" -ForegroundColor Green
        $documentsWithContent++
    }
    elseif ($fileExtension -eq ".pdf") {
        # Get extracted content from the Python extraction
        $content = Get-ExtractedContent -OriginalFileName $file.Name -ExtractedPath $ExtractedContentPath
        
        if ($content) {
            $charCount = $content.Length
            $wordCount = ($content -split '\s+').Count
            Write-Host "  Prepared (PDF): $($file.Name) - $wordCount words, $charCount chars" -ForegroundColor Green
            $documentsWithContent++
        } else {
            # Fallback to description if extraction failed
            $content = "$($meta.title)`n`n$($meta.description)`n`nDette dokumentet er tilgjengeleg som PDF-fil: $($file.Name)"
            Write-Host "  Warning: No extracted content for $($file.Name), using metadata" -ForegroundColor Yellow
            $documentsWithoutContent++
        }
    }
    else {
        Write-Host "  Skipping unsupported file type: $($file.Name)" -ForegroundColor Gray
        continue
    }
    
    # Check if content needs to be chunked
    if ($content.Length -gt $MaxContentSize) {
        Write-Host "    Large document ($($content.Length) chars) - splitting into chunks..." -ForegroundColor Cyan
        $chunks = Split-ContentIntoChunks -Content $content -MaxChunkSize $MaxContentSize -Title $meta.title
        
        foreach ($chunk in $chunks) {
            $chunkId = "$($meta.id)-part$($chunk.part)"
            $chunkTitle = if ($chunk.total -gt 1) { 
                "$($meta.title) (Del $($chunk.part) av $($chunk.total))" 
            } else { 
                $meta.title 
            }
            
            $doc = @{
                "@search.action" = "upload"
                id = $chunkId
                title = $chunkTitle
                content = $chunk.content
                source = "leiar documents/$($file.Name)"
                category = $meta.category
            }
            $documents += $doc
        }
        
        Write-Host "    Created $($chunks.Count) chunks" -ForegroundColor Green
        $chunkedDocuments += $chunks.Count - 1  # -1 because we already counted the original
    }
    else {
        $doc = @{
            "@search.action" = "upload"
            id = $meta.id
            title = $meta.title
            content = $content
            source = "leiar documents/$($file.Name)"
            category = $meta.category
        }
        $documents += $doc
    }
}

Write-Host ""
Write-Host "  Total documents in index: $($documents.Count)" -ForegroundColor Cyan
Write-Host "  With full content: $documentsWithContent" -ForegroundColor Green
if ($chunkedDocuments -gt 0) {
    Write-Host "  Additional chunks from large docs: $chunkedDocuments" -ForegroundColor Cyan
}
if ($documentsWithoutContent -gt 0) {
    Write-Host "  With metadata only: $documentsWithoutContent" -ForegroundColor Yellow
}

# Step 4: Upload documents
Write-Host "Step 4: Uploading documents to index..." -ForegroundColor Yellow

$uploadPayload = @{
    value = $documents
} | ConvertTo-Json -Depth 10 -EscapeHandling EscapeNonAscii

$uploadUrl = "$SearchEndpoint/indexes/$IndexName/docs/index?api-version=$ApiVersion"

try {
    $response = Invoke-RestMethod -Uri $uploadUrl -Method Post -Headers $headers -Body $uploadPayload
    Write-Host "  Documents uploaded successfully!" -ForegroundColor Green
    Write-Host "  Results:" -ForegroundColor Cyan
    foreach ($result in $response.value) {
        $status = if ($result.status) { "OK" } else { "FAILED" }
        $color = if ($result.status) { "Green" } else { "Red" }
        Write-Host "    - $($result.key): $status" -ForegroundColor $color
    }
} catch {
    Write-Host "  Error uploading documents: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

# Step 5: Verify index
Write-Host "Step 5: Verifying index..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

$statsUrl = "$SearchEndpoint/indexes/$IndexName/stats?api-version=$ApiVersion"
try {
    $stats = Invoke-RestMethod -Uri $statsUrl -Method Get -Headers $headers
    Write-Host "  Document count: $($stats.documentCount)" -ForegroundColor Cyan
    Write-Host "  Storage size: $($stats.storageSize) bytes" -ForegroundColor Cyan
} catch {
    Write-Host "  Could not retrieve stats (index may still be updating)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Available categories in index:" -ForegroundColor Cyan
$categories = $documentMeta.Values | ForEach-Object { $_.category } | Sort-Object -Unique
foreach ($cat in $categories) {
    Write-Host "  - $cat" -ForegroundColor White
}
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Set the API key in user secrets (if not already set):"
Write-Host "   dotnet user-secrets set `"LeiarKontekst:ApiKey`" `"$ApiKey`"" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. The semantic configuration is already set in appsettings.json:"
Write-Host "   `"SemanticConfigurationName`": `"leiar-semantic-config`"" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Restart the webapi to use the updated index"
Write-Host ""

if ($AzureDIEndpoint -and $AzureDIKey) {
    Write-Host "Note: Azure Document Intelligence was used for extraction." -ForegroundColor Cyan
    Write-Host "This provides OCR for images and better handling of complex layouts." -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "Tip: For PDFs with images or complex layouts, use Azure Document Intelligence:" -ForegroundColor Cyan
    Write-Host "  .\setup-leiar-dokumenter-index.ps1 -ApiKey `"key`" -AzureDIEndpoint `"https://...`" -AzureDIKey `"key`"" -ForegroundColor Yellow
    Write-Host ""
}
