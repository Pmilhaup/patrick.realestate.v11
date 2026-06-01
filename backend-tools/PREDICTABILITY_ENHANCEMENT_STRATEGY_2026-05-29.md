# Predictive Seller Score Enhancement — Strategy Doc

**Date:** 2026-05-29
**Author:** Claude (research delegated to general-purpose subagent)
**Scope:** Enhance `get_smart_predictability` with (a) buy/sell intent signals and (b) homeowner age weighting
**Status:** Pending Patrick's direction on three decisions (see end of doc)

---

## TL;DR

1. **Don't build a social-media scraper.** The ROI is poor, the major platforms aggressively enforce ToS against logged-in scraping (and most "signals" require logged-in access), and Illinois has strong age-protection in real estate. Public-record + licensed-broker enrichment delivers most of the lift with none of the legal exposure.

2. **Don't weight raw age 60–75.** Instead, use **length of residence (LOR)** as a proxy. This is exactly what SmartZip, Offrs, and Versium use under the hood. LOR isn't a protected attribute, captures the same demographic wedge, and is defensible if anyone challenges the model.

3. **Build a 3-layer architecture:**
   - **A. Public-record ETL** (free, daily) — Cook County Open Data + municipal permits + probate/divorce dockets
   - **B. Licensed enrichment** (paid, narrow) — Versium REACH on the top-N hot candidates only; Apollo + ZoomInfo MCPs (already in Patrick's stack) for owner job-change signals
   - **C. Score extension** — extend `get_smart_predictability` to consume A+B features, with LOR as the anchor; keep feedback loop

4. **Approximate cost:** $125 one-time + a $250 credit pack on Versium = scoring boost for top ~500 candidates/month. Public-records layer is free. If you want to scale enrichment to 2K+ leads/mo, Versium goes to annual API subscription pricing (talk to sales).

---

## Vendor Comparison

How the leading predictive-seller-score vendors get their data:

| Vendor | Data sources | Methodology | ToS posture | Solo-agent pricing | Accuracy claim |
|---|---|---|---|---|---|
| **SmartZip** | ~25 national sources, 250+ data points: property records, tax, transaction history, AVM, demographics, schools, crime, income | NHPI + AVM + ML on 95M homes | Licensed broker data + public records (no scraping disclosed) | ~$500–$1,500/mo per ZIP | "Up to 72%" of likely sellers in next 12 mo |
| **Offrs** | Public + proprietary: tax, demographics, equity, life events, web behavior | ML on geographic farm; 30 guaranteed leads/mo | Public records + licensed | ~$400/mo per ZIP; $0.10/property non-exclusive | 72% prediction accuracy |
| **Revaluate** | Algorithm not publicly documented | "Suspects to prospects" PSS | Unclear | Not surfaced | Not publicly verified |
| **Catalyze.AI** | Event-driven + historical + behavioral; **exclusive Legacy.com obituary relationship** | Hundreds of M data points → 8–10 month sell window | Licensed partnerships | Not surfaced | "Highest propensity" — no number |
| **Versium REACH** | Identity graph 2B+ contacts; ~400 attributes incl. LOR, home value, net worth | DaaS enrichment | Licensed B2B2C | $125 one-time, $250 credit pack, API w/ annual sub | N/A (enrichment, not scoring) |
| **Remine (Patrick already uses)** | Public record + tax + consumer + census + market trends | "Sell Score" ML, High/Med/Low | MLS/licensee channel | Bundled w/ MLS | Not publicly disclosed |

**Pattern:** every credible vendor uses licensed data + public records. Nobody publicly admits to scraping social media because it would invite litigation and ToS termination. The "AI predictive seller score" category is essentially: tax records + AVM + life events + LOR + ML on top.

---

## Recommended Legitimate Data Sources

### Free / public

- **Cook County Open Data Portal** (`datacatalog.cookcountyil.gov`) — Parcel Universe, Sales, Assessed Values, Addresses. Free public API.
- **Cook County Clerk / Circuit Court** — probate + divorce dockets are public, but no API; 2004 IL Supreme Court policy blocks remote document access. Web-readable but brittle.
- **Municipal permit feeds** — Winnetka, Wilmette, Glencoe, Kenilworth, etc. each publish differently; most have CSV/portal.
- **RPR (Realtors Property Resource)** — included in NAR dues. 2,000 records/mo export cap, mention of a free public-records API — worth a direct support call to confirm scope.

### Paid (cost-effective for solo agent)

- **Versium REACH** — strongest licensed source for LOR, age-band, household financials. Pay-as-you-go from $125. Use surgically: enrich only the hot 500–2K candidates surfaced by Layer A + Remine Sell Score, not all 24K.
- **Apollo MCP** — Patrick already has this in Cowork. Owner job-change signals via licensed B2B data.
- **ZoomInfo MCP** — Patrick already has this. Similar role to Apollo, often better coverage on executives.

### Skip (too expensive or wrong shape)

- **ATTOM / HouseCanary** — enterprise-tier property + valuation APIs. Overkill for a single agent.
- **USPS NCOA** — Patrick cannot be a licensee (Full Service Provider + Limited Service Provider both require commercial processing infrastructure). Must go through a licensed service provider (Anchor Computer, Melissa, SmartyStreets) — adds cost + middleman.
- **Legacy.com obituary feed** — Catalyze.AI has an exclusive relationship; the direct feed is walled off.
- **Whitepages Pro / Spokeo / BeenVerified** — explicitly not FCRA consumer reporting agencies; data legally cannot be used for "eligibility" decisions. Marketing tilt is arguably eligibility-adjacent.

---

## OSS / GitHub Landscape

| Project | Verdict |
|---|---|
| **Sherlock**, **Maigret**, **holehe** | Legally fine — query public profile URLs. Usable for manual enrichment of a single lead. Not viable for bulk scoring 24K properties. |
| **snscrape** | Effectively dead post-X API changes. Skip. |
| **TikTok-Api (davidteather)** | Actively maintained but needs proxies + Playwright; brittle for production. Skip. |
| **instaloader** | Works for public Instagram, but post-Meta v. Bright Data (Jan 2024) safer logged-out only. Brittle. |
| **Zillow/Redfin scrapers** | ToS-violating, frequent DMCAs in commit history. Landmine. |
| **NextDoor "moving" scrapers** | ToS-violating, obvious to NextDoor. Landmine. |
| **Probate scrapers** | Nothing well-maintained — Cook County e-filing is the bottleneck. |

---

## Legal Landscape (IL-specific)

- **Illinois Human Rights Act** explicitly protects age 40+ in real estate transactions. This is broader than the federal Fair Housing Act, which omits age. A model that targets 60–75 for "you should sell" outreach is squarely in IDHR jurisdiction.
- **Disparate impact / steering** — NAR Code Article 10 + 2026 Standards of Practice ban steering and panic-selling. An age-weighted score driving marketing tilt could be construed as either.
- **CFAA** (post-hiQ v. LinkedIn 2022 + Van Buren) — scraping *public* web pages is not "without authorization." 9th Circuit reaffirmed; case settled Dec 2022 with hiQ enjoined on contract grounds. Net: CFAA-safe, but contract/ToS risk persists.
- **Meta v. Bright Data (N.D. Cal., Jan 2024)** — Meta's ToS only binds *logged-in* scraping. Logged-out public scraping of FB/IG is contractually clean per this ruling.
- **LinkedIn** — still actively litigates and technically blocks; logged-in scraping = breach of user agreement.
- **NAR AI Policy Template (2025)** — emphasizes ethical use, human oversight, fair-housing-safe targeting. No bright-line ban on predictive tools.
- **FCRA** — Whitepages, Spokeo, BeenVerified explicitly are NOT consumer reporting agencies; data cannot legally be used for "eligibility" decisions.

**Practical takeaway:** the legal posture you want is "licensed data + public records + LOR-as-proxy," with a documented model card explaining feature selection. That's a defensible position if anyone (IDHR, NAR ethics committee) asks why your model surfaces certain owners.

---

## Age Determination — Recommended Approach

**Skip direct age. Use length of residence (LOR) as the proxy.**

Why:
- LOR is a property-record field, not a protected attribute. Cook County Assessor sales data gives you years-since-purchase for every PIN, free, via API.
- Industry leaders (Versium markets LOR as the real-estate-prospecting filter; SmartZip and Offrs both lean on equity + tenure) optimize on LOR rather than age.
- US median tenure is ~12 years (Redfin, ATTOM Q1 2026 reports). ARIC-cohort research and life-course mobility studies confirm tenure correlates with major life events without using age.
- The 60–75 demographic wedge will show up implicitly in your LOR distribution. You don't need to name it.

If you want an explicit age signal anyway:
1. **First stop:** ask your Remine rep whether owner birth-year is in your subscription tier. If yes, it's already in `remine_property_index` and you just need to surface it.
2. **Second stop:** Versium REACH `age_band` field, applied only to the hot list.
3. **Don't use:** voter rolls (IL restricts to non-commercial use), property tax records (don't carry age), or any social platform.

---

## Top Predictive Features (Ranked)

Based on what SmartZip, Offrs, HouseCanary actually use plus academic backing (Clark & Lisowski, Coulter et al. on life-course mobility):

1. **Length of residence / years since last sale** — universal anchor
2. **Home equity / LTV** — strongest single propensity signal
3. **Recent life event** — death/probate, divorce filing, job change
4. **Refinance recency** — refinanced <2 yr ago is a strong NEGATIVE signal (rate lock-in)
5. **Neighborhood velocity / nearby sales** — census-tract churn
6. **Permit / improvement activity** — pre-sale prep is detectable
7. **Household composition change** — empty-nester signal; proxy via school-district enrollment or census ACS
8. **Mortgage age / loan vintage** — Remine surfaces this as a filter

---

## Recommended Architecture

### Layer A — Daily public-record ETL (free / cheap)

- **Cook County Open Data API** → nightly pull of parcel sales, assessed values, addresses → Supabase `public_records_daily` table
- **Cook County Clerk** probate + divorce dockets → low-volume scrape (logged-out, names only) → flag matches against Remine owner names → `life_event_flags` table
- **North Shore municipal permit feeds** → per-suburb adapter; many publish CSV → `permits_daily` table

Cadence: nightly Cloudflare Worker cron OR Windows Task Scheduler invoking a Python script that hits the APIs and upserts into Supabase.

### Layer B — Licensed enrichment (paid, narrow)

- **Versium REACH** — pay-as-you-go LOR, age band, household financials. Enrich only the top-N hot candidates (top 500–2K monthly, surfaced by Layer A flags + Remine Sell Score). Cost-controlled by hot-list size.
- **Apollo MCP** — Patrick already has. Owner job-change signals — only run on the hot list.
- **ZoomInfo MCP** — Patrick already has. Similar to Apollo, often better executive coverage.
- **RPR** — pull free monthly export quota for North Shore PINs.

### Layer C — Score extension + feedback

Extend `get_smart_predictability` to consume Layer A + B fields:
- New columns on `remine_property_index`: `length_of_residence_years`, `equity_estimate`, `life_event_flags JSONB`, `permit_activity_recent_bool`, `nbhd_velocity_pct`, `last_refi_year`, `signal_sources JSONB`, `signal_last_seen_at`
- Feature weights — LOR as anchor, equity multiplier, life-event boost, refi-recency dampener
- Do NOT include raw age as a direct feature; let LOR carry it
- Daily snapshot + sales-funnel trigger feedback loop already in place — supplies ground truth via `remine_prospect_feedback`
- Add a **model card** doc explaining feature list + rationale. Save in `_Real Estate OS/00_Operating Docs/MODEL_CARD_predictability.md` for IDHR / NAR ethics defensibility.

### Explicitly NOT in scope

- Social-media scraping daemons (Facebook, Instagram, NextDoor, TikTok, LinkedIn)
- Raw age targeting
- USPS NCOA direct integration (use a licensed service provider only if needed later)

---

## Decisions Patrick Needs to Make

Before I build anything, three calls:

### 1. Budget for licensed enrichment

- **A. Free / public-records only** — build Layer A + extend the score using LOR + life-event flags from county records. No monthly cost. Expect ~70% of full lift.
- **B. Add Versium REACH ($125 + $250 credit pack)** — same as A plus age-band + LOR enrichment on top 500 monthly. Expect ~85% of full lift.
- **C. Versium annual subscription + Apollo/ZoomInfo enrichment** — scales to 2K+ enrichments/mo. Cost: depends on Versium quote.

### 2. Scope of enrichment

- Enrich all ~24K properties (expensive on any paid layer), or
- Enrich only the top-N hot candidates (recommended — usually top 500–2K/mo)

### 3. Age signal

- **Use LOR only** as the proxy (cleanest legal posture, recommended)
- **Use LOR + Remine birth-year** if Patrick's Remine tier includes it
- **Use LOR + Versium age band** on hot list only

---

## Sources

PropTech & vendors:
- SmartZip: https://www.smartzip.help/en/articles/1971215-data-analytics, https://theclose.com/smartzip-review/, https://agentflowtools.com/blog/is-smartzip-worth-it
- Offrs: https://offrs.com/data.cfm, https://theclose.com/offrs-review/
- Catalyze.AI: https://www.catalyzeai.com/real-estate/main, https://www.agentadvice.com/catalyzeai-review/
- Versium REACH: https://versium.com/real-estate-prospecting-data/, https://versium.com/pricing/
- Remine Sell Score: https://support.remine.com/hc/en-us/articles/360001690412-What-is-the-Sell-Score

Legal:
- Illinois Fair Housing FAQ: https://dhr.illinois.gov/filing-a-charge/faq-home/faq-section-vi.html
- 775 ILCS 5 (IHRA): https://www.ilga.gov/legislation/ilcs/ilcs4.asp?DocName=077500050HArt.+3&ActID=2266&ChapterID=64&SeqStart=1250000&SeqEnd=2200000
- NAR Code of Ethics 2026: https://www.nar.realtor/about-nar/governing-documents/code-of-ethics/2026-code-of-ethics-standards-of-practice
- NAR AI Policy Template: https://www.nar.realtor/brokers/ai-policy-template-for-brokers
- hiQ v LinkedIn (9th Cir. 2022): https://law.justia.com/cases/federal/appellate-courts/ca9/17-16783/17-16783-2022-04-18.html
- hiQ v LinkedIn wrap-up: https://www.zwillgen.com/alternative-data/hiq-v-linkedin-wrapped-up-web-scraping-lessons-learned/
- Meta v. Bright Data: https://www.courthousenews.com/federal-judge-rules-against-meta-in-data-scraping-case/, https://techcrunch.com/2024/02/26/meta-drops-lawsuit-against-web-scraping-firm-bright-data-that-sold-millions-of-instagram-records/

Public records:
- Cook County Parcel Universe: https://datacatalog.cookcountyil.gov/Property-Taxation/Assessor-Parcel-Universe/nj4t-kc8j
- Cook County 2026 Open Data Refresh: https://datacatalog.cookcountyil.gov/stories/s/Assessor-2025-Open-Data-Refresh/gzdr-q7c4/
- Cook County Clerk: https://www.cookcountyclerkofcourt.org/online-case-information
- Cook County Divorce Records: https://www.cookcountyil.gov/service/divorce-records
- NAR RPR: https://www.nar.realtor/realtors-property-resource-rpr

USPS NCOA:
- LSP License: https://postalpro.usps.com/NCOALink/LSP_License
- FSP License: https://postalpro.usps.com/NCOALink/FSP_License

Tenure & life events:
- ATTOM Q1 2026 Tenure Report: https://www.attomdata.com/news/most-recent/homeownership-tenure-by-state/
- Redfin homeowner tenure: https://www.redfin.com/news/homeowner-tenure-12-years/
- Life events & residential mobility: https://www.sciencedirect.com/science/article/abs/pii/S1040260815000519
- ARIC cohort movers: https://pmc.ncbi.nlm.nih.gov/articles/PMC9004423/

OSS & scraping landscape:
- snscrape current status: https://dev.to/sivarampg/scraping-twitter-in-2025-a-developers-guide-to-surviving-the-api-apocalypse-5bbd
- TikTok scraper landscape: https://thunderbit.com/blog/best-tiktok-scraper-alternatives
- Sherlock OSINT: https://oshy.tech/en/blog/sherlock-the-trendy-osint-tool/
- Maigret: https://github.com/soxoj/maigret/blob/main/README.md
- Whitepages/Spokeo/BeenVerified context: https://galadon.com/whitepages-people-search
