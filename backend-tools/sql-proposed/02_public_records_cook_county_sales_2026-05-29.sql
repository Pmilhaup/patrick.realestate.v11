-- ============================================================
-- PHASE 1 — NEW TABLE: public_records_cook_county_sales
-- File:  02_public_records_cook_county_sales_2026-05-29.sql
-- Date:  2026-05-29
-- Status: DRAFT — DO NOT DEPLOY without Patrick's sign-off
-- ============================================================
--
-- Purpose:
--   Landing table for the Cook County Open Data sales feed
--   (Socrata API). One row per recorded sale. The Phase 1 ETL
--   (etl/cook_county_sales_etl.py) upserts into this table daily.
--
--   Downstream uses (Phase 2+):
--     * Compute LOR for PINs where remine_property_index.recording_date
--       is NULL (we have years-since-last-sale here).
--     * Compute nbhd_velocity_pct (census-tract churn rollup).
--     * Detect probate-flavored deed types (e.g. quitclaim, executor)
--       and feed remine_property_index.life_event_flags.
--
-- Notes on schema:
--   * pin is PRIMARY KEY only if we de-dupe to "latest sale per PIN".
--     But a PIN can have multiple historical sales. So PK is
--     (pin, sale_date) instead.
--   * UNIQUE (pin, sale_date) supports idempotent upsert via the
--     PostgREST `on_conflict=pin,sale_date` parameter.
--   * raw JSONB stores the full Socrata response row in case the
--     Cook County schema drifts.
--
-- ============================================================

CREATE TABLE IF NOT EXISTS public_records_cook_county_sales (
  pin           TEXT      NOT NULL,
  sale_date     DATE      NOT NULL,
  sale_price    NUMERIC,
  deed_type     TEXT,
  buyer_name    TEXT,
  seller_name   TEXT,
  source        TEXT      NOT NULL DEFAULT 'cook_county_open_data',
  raw           JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT public_records_cook_county_sales_pk
    PRIMARY KEY (pin, sale_date)
);

COMMENT ON TABLE public_records_cook_county_sales IS
  'Cook County Recorder of Deeds sales feed. Source: Socrata API on datacatalog.cookcountyil.gov. Loaded daily by etl/cook_county_sales_etl.py.';

COMMENT ON COLUMN public_records_cook_county_sales.pin IS
  'Cook County PIN. Joins to remine_property_index.pin.';

COMMENT ON COLUMN public_records_cook_county_sales.sale_date IS
  'Date the deed was recorded.';

COMMENT ON COLUMN public_records_cook_county_sales.deed_type IS
  'Raw deed type from county feed. Useful for life-event inference (e.g. quitclaim ~ divorce, executor deed ~ probate).';

COMMENT ON COLUMN public_records_cook_county_sales.raw IS
  'Full Socrata row, preserved for schema drift.';

-- Indexes for the rollups + joins.
CREATE INDEX IF NOT EXISTS idx_ccsales_pin
  ON public_records_cook_county_sales (pin);

CREATE INDEX IF NOT EXISTS idx_ccsales_sale_date
  ON public_records_cook_county_sales (sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_ccsales_deed_type
  ON public_records_cook_county_sales (deed_type);

-- Auto-update trigger to bump updated_at on row UPDATE.
CREATE OR REPLACE FUNCTION update_ccsales_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ccsales_updated_at'
  ) THEN
    CREATE TRIGGER trg_ccsales_updated_at
      BEFORE UPDATE ON public_records_cook_county_sales
      FOR EACH ROW EXECUTE FUNCTION update_ccsales_timestamp();
  END IF;
END $$;

-- RLS: read-only to anon. Service role bypasses RLS anyway, so the
-- ETL (which uses SUPABASE_SERVICE_KEY) is unaffected.
ALTER TABLE public_records_cook_county_sales ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename = 'public_records_cook_county_sales'
       AND policyname = 'ccsales_select'
  ) THEN
    CREATE POLICY ccsales_select
      ON public_records_cook_county_sales
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- ============================================================
-- VERIFICATION QUERIES (run after deploy)
-- ============================================================
-- SELECT COUNT(*) FROM public_records_cook_county_sales;
-- Expected after first ETL run: > 0 for the 4 North Shore ZIPs.
--
-- SELECT pin, sale_date, sale_price, deed_type
--   FROM public_records_cook_county_sales
--   ORDER BY sale_date DESC
--   LIMIT 5;

-- ============================================================
-- ROLLBACK (commented)
-- ============================================================
-- DROP POLICY IF EXISTS ccsales_select ON public_records_cook_county_sales;
-- DROP TRIGGER IF EXISTS trg_ccsales_updated_at ON public_records_cook_county_sales;
-- DROP FUNCTION IF EXISTS update_ccsales_timestamp();
-- DROP INDEX IF EXISTS idx_ccsales_deed_type;
-- DROP INDEX IF EXISTS idx_ccsales_sale_date;
-- DROP INDEX IF EXISTS idx_ccsales_pin;
-- DROP TABLE IF EXISTS public_records_cook_county_sales;
