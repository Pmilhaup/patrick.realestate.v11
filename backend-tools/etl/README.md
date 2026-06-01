# Cook County Sales ETL

Phase 1 daily pull from Cook County Assessor's Open Data into
Supabase `public_records_cook_county_sales`.

Dataset: `wvhk-k5uv` ("Assessor - Parcel Sales") at
[datacatalog.cookcountyil.gov](https://datacatalog.cookcountyil.gov/Property-Taxation/Assessor-Parcel-Sales/wvhk-k5uv).

## Setup

1. **Make sure SQL migration 02 has been applied first**
   (`sql-proposed/02_public_records_cook_county_sales_2026-05-29.sql`).

2. **Install Python deps:**
   ```powershell
   cd "C:\Users\PMilh\OneDrive\Documents\Claude\Projects\_Real Estate OS\06_Website & Backend\patrick.realestate.v10\backend-tools\etl"
   py -m pip install -r requirements.txt
   ```

3. **Create `.env`** from the template:
   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```
   Fill in `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (same values used
   by `backend.html` lines ~1087-1088). Optionally request a free
   Socrata app token at the Cook County data portal and paste it.

## Env vars

| Var | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | yes | e.g. `https://itupjrknklzvmmqicuyc.supabase.co` |
| `SUPABASE_SERVICE_KEY` | yes | service-role JWT (bypasses RLS) |
| `SOCRATA_APP_TOKEN` | no | raises Socrata rate limit |

## Smoke tests

```powershell
# 1. dry-run, last 7 days — verifies API works without writing
py cook_county_sales_etl.py --dry-run --days 7

# 2. actual ingest, last 30 days
py cook_county_sales_etl.py --days 30

# 3. verify in Supabase
# Open backend.html and run:
#   SELECT COUNT(*) FROM public_records_cook_county_sales;
#   SELECT pin, sale_date, sale_price, deed_type
#     FROM public_records_cook_county_sales
#     ORDER BY sale_date DESC LIMIT 5;
```

Expected first-run result: thousands of rows (entire county for
the window); the script doesn't pre-filter ZIP because the
downstream join to `remine_property_index` does that for free.

## Schedule via Windows Task Scheduler

1. Open Task Scheduler -> Create Basic Task.
2. Name: `Cook County Sales ETL`.
3. Trigger: Daily, 03:30 local.
4. Action: Start a program.
5. Program/script: `py` (or full path to `python.exe`).
6. Add arguments: `cook_county_sales_etl.py --days 7`
7. Start in: full path to this `etl\` folder.
8. Settings tab -> check "Run task as soon as possible after a
   scheduled start is missed."

`--days 7` keeps the daily run cheap. The first manual run should
use `--days 365` to backfill a year so the LOR computations and
neighborhood-velocity rollups have data to chew on.

## Re-run safety

The script is idempotent — Supabase upsert on `(pin, sale_date)`
means re-running the same window updates existing rows in place.
Crashes mid-run only lose the in-flight batch (max 500 rows).

## Phase 2 hooks (not yet built)

- Backfill `remine_property_index.length_of_residence_years` from
  the most recent `sale_date` per PIN.
- Compute `nbhd_velocity_pct` via a SQL rollup grouped by census
  tract over the last 12 months.
- Set `life_event_flags.probate = true` when
  `deed_type IN ('Executor Deed', 'Trustee Deed')`.
- Set `life_event_flags.divorce_hint = true` when
  `deed_type = 'Quit Claim'` and prior owner names overlap.
