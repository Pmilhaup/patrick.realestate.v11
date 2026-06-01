-- ============================================================
-- PHASE 1 — EXTEND remine_property_index
-- File:  01_remine_property_index_phase1_columns_2026-05-29.sql
-- Date:  2026-05-29
-- Status: DRAFT — DO NOT DEPLOY without Patrick's sign-off
-- ============================================================
--
-- WHY THIS EXISTS
-- ---------------
-- Phase 1 of the LOR-anchored predictive seller score build.
-- Adds slots on remine_property_index for the new features the
-- v2 scoring function will consume. Phase 1 only adds the schema;
-- ETL phases (2+) populate these columns.
--
-- DESIGN NOTES
-- ------------
-- * length_of_residence_years
--     The Remine table already has `ownership_time` (numeric, populated
--     by Remine). We add length_of_residence_years as a *standardized*
--     LOR column. It is a REGULAR (not generated) column because:
--       - `recording_date` is NULL on a large fraction of rows
--       - the ETL can prefer recording_date, then fall back to
--         ownership_time, then fall back to mortgage1_date year math
--     A generated column would lock us to one source. The ETL will
--     keep this column in sync.
--
-- * equity_estimate_pct
--     Already present as `equity_percentage`. We add equity_estimate_pct
--     as the *canonical* slot the v2 score reads (so future
--     re-computation via AVM or county data can replace Remine's
--     equity_percentage without touching the scorer).
--
-- * life_event_flags  JSONB
--     Bag of booleans: {"probate": true, "divorce": false,
--                       "obit_match": false, "job_change": false, ...}
--     Populated by future ETL phases (Cook County probate scrape,
--     Apollo job-change MCP, etc.).
--
-- * permit_activity_recent_bool
--     TRUE if a building permit was pulled at this PIN in the last
--     365 days. Populated by the municipal permit ETL (Phase 2).
--
-- * nbhd_velocity_pct
--     Census-tract churn % over the trailing 12 months. Populated by
--     a rollup of public_records_cook_county_sales (this migration's
--     sibling table 02_*).
--
-- * signal_sources  JSONB ARRAY
--     ['cook_county_open_data','permits_winnetka','apollo','versium', ...]
--     Tells the dashboard which feeds are contributing to this row's
--     score. Helps debugging and the model card.
--
-- * signal_last_seen_at
--     Timestamp of the most recent signal update. Used by the
--     dashboard to show "stale" markers.
--
-- ROLLBACK STATEMENTS ARE AT THE BOTTOM (COMMENTED).
--
-- ============================================================

ALTER TABLE remine_property_index
  ADD COLUMN IF NOT EXISTS length_of_residence_years NUMERIC;

COMMENT ON COLUMN remine_property_index.length_of_residence_years IS
  'LOR years. Populated by ETL: prefer recording_date, fall back to ownership_time, then mortgage1_date.';

ALTER TABLE remine_property_index
  ADD COLUMN IF NOT EXISTS equity_estimate_pct NUMERIC;

COMMENT ON COLUMN remine_property_index.equity_estimate_pct IS
  'Canonical equity % consumed by the v2 score. ETL keeps this synced with equity_percentage (Remine) or a recomputed value from county sales + mortgage balance.';

ALTER TABLE remine_property_index
  ADD COLUMN IF NOT EXISTS life_event_flags JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN remine_property_index.life_event_flags IS
  'JSONB bag of booleans: probate, divorce, obit_match, job_change, refi_recent, etc. Populated by Phase 2 ETLs.';

ALTER TABLE remine_property_index
  ADD COLUMN IF NOT EXISTS permit_activity_recent_bool BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN remine_property_index.permit_activity_recent_bool IS
  'TRUE if a municipal building permit was pulled at this address/PIN in trailing 365 days. Populated by permits ETL.';

ALTER TABLE remine_property_index
  ADD COLUMN IF NOT EXISTS nbhd_velocity_pct NUMERIC;

COMMENT ON COLUMN remine_property_index.nbhd_velocity_pct IS
  'Trailing 12-month census-tract turnover %. Computed by rollup over public_records_cook_county_sales.';

ALTER TABLE remine_property_index
  ADD COLUMN IF NOT EXISTS signal_sources JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN remine_property_index.signal_sources IS
  'JSONB array of source slugs that have fired for this PIN: cook_county_open_data, permits_<village>, apollo, versium, etc.';

ALTER TABLE remine_property_index
  ADD COLUMN IF NOT EXISTS signal_last_seen_at TIMESTAMPTZ;

COMMENT ON COLUMN remine_property_index.signal_last_seen_at IS
  'Most recent time any external signal (county sale, permit, life event) updated this row.';

-- Helpful indexes for the v2 scorer + dashboard filters.
CREATE INDEX IF NOT EXISTS idx_remine_lor
  ON remine_property_index (length_of_residence_years);

CREATE INDEX IF NOT EXISTS idx_remine_equity_pct
  ON remine_property_index (equity_estimate_pct);

CREATE INDEX IF NOT EXISTS idx_remine_permit_recent
  ON remine_property_index (permit_activity_recent_bool)
  WHERE permit_activity_recent_bool = TRUE;

CREATE INDEX IF NOT EXISTS idx_remine_signal_last_seen
  ON remine_property_index (signal_last_seen_at DESC);

-- GIN on the JSONB flags so future queries like
--   WHERE life_event_flags @> '{"probate": true}'
-- are cheap.
CREATE INDEX IF NOT EXISTS idx_remine_life_event_flags
  ON remine_property_index USING GIN (life_event_flags);

CREATE INDEX IF NOT EXISTS idx_remine_signal_sources
  ON remine_property_index USING GIN (signal_sources);

-- ============================================================
-- VERIFICATION QUERIES (run after deploy)
-- ============================================================
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name='remine_property_index'
--     AND column_name IN (
--       'length_of_residence_years','equity_estimate_pct',
--       'life_event_flags','permit_activity_recent_bool',
--       'nbhd_velocity_pct','signal_sources','signal_last_seen_at'
--     );
-- Expected: 7 rows.

-- ============================================================
-- ROLLBACK (commented — uncomment + run to revert this migration)
-- ============================================================
-- DROP INDEX IF EXISTS idx_remine_signal_sources;
-- DROP INDEX IF EXISTS idx_remine_life_event_flags;
-- DROP INDEX IF EXISTS idx_remine_signal_last_seen;
-- DROP INDEX IF EXISTS idx_remine_permit_recent;
-- DROP INDEX IF EXISTS idx_remine_equity_pct;
-- DROP INDEX IF EXISTS idx_remine_lor;
-- ALTER TABLE remine_property_index DROP COLUMN IF EXISTS signal_last_seen_at;
-- ALTER TABLE remine_property_index DROP COLUMN IF EXISTS signal_sources;
-- ALTER TABLE remine_property_index DROP COLUMN IF EXISTS nbhd_velocity_pct;
-- ALTER TABLE remine_property_index DROP COLUMN IF EXISTS permit_activity_recent_bool;
-- ALTER TABLE remine_property_index DROP COLUMN IF EXISTS life_event_flags;
-- ALTER TABLE remine_property_index DROP COLUMN IF EXISTS equity_estimate_pct;
-- ALTER TABLE remine_property_index DROP COLUMN IF EXISTS length_of_residence_years;
