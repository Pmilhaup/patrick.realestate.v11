# Phase 1 Deploy Instructions

**Date:** 2026-05-29
**Scope:** LOR-anchored predictive seller score + Cook County
sales ETL. Free / public-records only. No paid layers.

## Pre-flight

- `remine_property_index` last refresh **verified 2026-05-29
  20:44 UTC** (today). Good to deploy.
- `get_smart_predictability` v1 currently in production. v1.5
  (reweight) was drafted but never deployed; v2 supersedes it.

## Files in this release

| # | File | Type |
|---|---|---|
| 1 | `sql-proposed/01_remine_property_index_phase1_columns_2026-05-29.sql` | DDL |
| 2 | `sql-proposed/02_public_records_cook_county_sales_2026-05-29.sql` | DDL |
| 3 | `sql-proposed/03_get_smart_predictability_v2_lor_anchored_2026-05-29.sql` | function |
| 4 | `etl/cook_county_sales_etl.py` + `requirements.txt` + `.env.example` + `README.md` | ETL |
| 5 | `00_Operating Docs/MODEL_CARD_predictability_2026-05-29.md` | docs |

## Deploy order

**Run SQL in this order.** Each is hot-swappable; only #3 changes
behaviour visible in backend.html.

### Step 1 — Add new columns to `remine_property_index`

File: `01_remine_property_index_phase1_columns_2026-05-29.sql`

Paste into Supabase SQL editor and run. No downtime.

**Verify:**
```sql
SELECT column_name FROM information_schema.columns
  WHERE table_name='remine_property_index'
    AND column_name IN (
      'length_of_residence_years','equity_estimate_pct',
      'life_event_flags','permit_activity_recent_bool',
      'nbhd_velocity_pct','signal_sources','signal_last_seen_at'
    )
  ORDER BY column_name;
```
Expected: 7 rows.

### Step 2 — Create `public_records_cook_county_sales`

File: `02_public_records_cook_county_sales_2026-05-29.sql`

**Verify:**
```sql
SELECT COUNT(*) FROM public_records_cook_county_sales;  -- expect 0
SELECT policyname FROM pg_policies
  WHERE tablename='public_records_cook_county_sales';   -- expect 'ccsales_select'
```

### Step 3 — Replace `get_smart_predictability` with v2

File: `03_get_smart_predictability_v2_lor_anchored_2026-05-29.sql`

Hot-swap — `CREATE OR REPLACE FUNCTION`. **backend.html will show
new scores on next refresh.**

**Verify:**
```sql
SELECT pin, signal_strength, raw_base_score,
       feature_contributions->>'lor_anchor' AS lor_pts,
       feature_contributions->>'remine_sell_score' AS sell_pts
  FROM get_smart_predictability('Winnetka', 30, 30, NULL)
  LIMIT 5;
```
Expected: `lor_pts` non-zero wherever `ownership_time >= 5`.
`raw_base_score` may exceed 59, `signal_strength` will be capped
at 59 until the top band gets ≥25 contacts with ≥30% interested.

## ETL setup (after SQL is live)

```powershell
cd "C:\Users\PMilh\OneDrive\Documents\Claude\Projects\_Real Estate OS\06_Website & Backend\patrick.realestate.v10\backend-tools\etl"

# 1. Install deps
py -m pip install -r requirements.txt

# 2. Create .env from template
Copy-Item .env.example .env
notepad .env
# Fill SUPABASE_URL and SUPABASE_SERVICE_KEY (same values used in backend.html lines ~1087-1088)
# Optionally fill SOCRATA_APP_TOKEN (free signup at datacatalog.cookcountyil.gov)

# 3. Smoke-test: dry run, 7 days
py cook_county_sales_etl.py --dry-run --days 7

# 4. First real run — backfill 365 days so LOR + neighborhood-velocity
#    rollups have history
py cook_county_sales_etl.py --days 365

# 5. Verify
# In backend.html or Supabase SQL editor:
#   SELECT COUNT(*) FROM public_records_cook_county_sales;
#   SELECT pin, sale_date, sale_price, deed_type
#     FROM public_records_cook_county_sales
#     ORDER BY sale_date DESC LIMIT 5;
```

Then schedule daily via Windows Task Scheduler (full steps in
`etl/README.md` -> "Schedule via Windows Task Scheduler").
Recommended cadence: daily at 03:30 with `--days 7`.

## backend.html — minor changes

**NOT in scope for Phase 1.** The v2 function's `RETURNS TABLE`
adds two columns (`raw_base_score`, `feature_contributions`).
PostgREST returns by name so existing reads keep working.

**Optional Phase 1.5 polish (do later when convenient):**
- Add a "why this score" tooltip on each row pulling
  `feature_contributions` from the RPC response.
- Surface the `top_band_capped` boolean as a small badge on
  60+ scores so Patrick knows the cap is on.

## Phase 2 preview

In rough priority order, all still free / cheap:

1. **Backfill LOR from county data.** Once
   `public_records_cook_county_sales` has 365 days of history,
   a SQL UPDATE populates
   `remine_property_index.length_of_residence_years` from the most
   recent `sale_date` per PIN — replacing the current
   `ownership_time` fallback.
2. **Neighborhood velocity rollup.** SQL view: 12-mo turnover %
   by census tract -> populate `nbhd_velocity_pct`.
3. **Life-event flags from deed types.** UPDATE setting
   `life_event_flags.probate=true` when
   `deed_type IN ('Executor Deed','Trustee Deed')`,
   `life_event_flags.divorce_hint=true` on `Quit Claim` with
   prior-owner overlap.
4. **Municipal permit ETLs.** Per-village adapter. Winnetka,
   Wilmette, Glencoe, Kenilworth first (Cook County).
5. **Probate dockets.** Manual list import until Cook County
   Circuit Court exposes a real API.
6. **Apollo + ZoomInfo MCP enrichment** on the hot list only —
   job-change signals on owners in the top 200 of any given
   week.
7. **Then tune Phase 1 placeholder weights** against feedback —
   permits, life events, neighborhood velocity all currently
   weight 0, slots are ready in the v2 scorer.

## Rollback

Each SQL file has explicit commented rollback statements at the
bottom. To revert all three:

1. Run rollback block in `03_*.sql` — restores v1 from the
   archived definition path noted at file footer.
2. Run rollback block in `02_*.sql` — drops the sales table.
3. Run rollback block in `01_*.sql` — drops the 7 added columns.

Frontend keeps working through all three rollbacks (PostgREST
column-by-name reads degrade to NULL on the new fields).
