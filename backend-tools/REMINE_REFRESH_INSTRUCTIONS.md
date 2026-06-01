# Remine Daily Refresh — Manual Steps

**Current staleness (as of 2026-05-29):** `remine_property_index.updated_at` = **2026-05-06** (23 days stale). `remine_change_log` last entry = **2026-04-08**.

The `remine-daily-update` skill is **not fully automated** — it requires you to drop in fresh Remine exports before it can run. Here's what to do.

## Step 1 — Export from Remine (web app)

Remine caps each export at ~2,500 rows, so you produce **3 files** per the existing group split:

| File | Villages |
|---|---|
| `remine_file1_lakeforest_YYYY-MM-DD.xlsx` | Lake Forest |
| `remine_file2_wilmette_YYYY-MM-DD.xlsx` | Wilmette |
| `remine_file3_glencoe_winnetka_kenilworth_northfield_YYYY-MM-DD.xlsx` | Glencoe, Winnetka, Kenilworth, Northfield |

In Remine: filter to each village set, export to Excel, save with the filename above.

## Step 2 — Drop the files into the Cowork session

Drag all three `.xlsx` files into the Cowork chat window (or attach them to your next message). They land in the session's `uploads/` folder where the skill expects them.

## Step 3 — Invoke the skill

In Cowork, say:

> Run the **remine-daily-update** skill on the files I just uploaded.

The skill will:
1. Parse all 3 files via SheetJS (column mapping per `remine-loader.html` ETL).
2. Upsert into `remine_property_index` on PIN.
3. Auto-detect changes vs prior snapshot → write to `remine_change_log`.
4. Call `compute_remine_daily_alerts` and `get_remine_predictability_signals` per village.
5. Produce a daily briefing (ownership changes, mailing changes, score upgrades, top predictability signals).

## Step 4 — Verify

After the skill completes, the agent should confirm `remine_property_index.updated_at` now equals today's date. If it doesn't, re-check that files actually parsed (look for SheetJS errors in the run log).

## Why this can't be auto-run today

- Remine has no public API — exports must be done through the logged-in browser session.
- No fresh files were found in `uploads/`, `OneDrive/`, or any working folder when this audit ran.
- The Supabase tables are reachable and the ETL endpoints are alive — only the input data is missing.

## Related

- Skill source: `C:\Users\PMilh\OneDrive\Documents\Claude\Scheduled\remine-daily-update\SKILL.md`
- ETL reference: `remine-loader.html` in the backend-tools workspace
- Architecture note: see `project_remine_architecture` in MEMORY.md (third silo, offline only, NEVER mixed into Intelligence page)
