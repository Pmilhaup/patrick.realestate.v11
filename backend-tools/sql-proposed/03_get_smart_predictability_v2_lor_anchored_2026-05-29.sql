-- ============================================================
-- PHASE 1 — get_smart_predictability v2 (LOR-anchored)
-- File:  03_get_smart_predictability_v2_lor_anchored_2026-05-29.sql
-- Date:  2026-05-29
-- Status: DRAFT — DO NOT DEPLOY without Patrick's sign-off
-- ============================================================
--
-- LINEAGE
-- -------
-- v1 (current production):
--   _archive/historical-assets/sql-setup/remine_feedback_setup.sql
--   lines ~84-258. Sell-score-anchored, no LOR weighting, no
--   feedback dampener for repeat rejections.
--
-- v1.5 (proposed reweight, not deployed):
--   sql-proposed/get_smart_predictability_reweight_2026-05-29.sql
--   Adds (a) top-band cap until band is validated, (b) cumulative
--   per-rejection penalty. Keeps sell_score as anchor.
--
-- v2 (THIS FILE):
--   * **LOR is the anchor feature** (was sell_score in v1/v1.5).
--   * Carries forward v1.5 dampeners:
--       - top-band cap at 59 until n>=25 AND pct_interested>=30%
--       - cumulative -10 per prior interest_level<=1 contact, cap -40
--   * Adds placeholder weight slots (currently 0-valued) for:
--       - equity_estimate_pct
--       - permit_activity_recent_bool
--       - life_event_flags (probate, divorce, job_change, obit_match)
--       - nbhd_velocity_pct
--     These read from the new columns added in
--     01_remine_property_index_phase1_columns_2026-05-29.sql.
--   * Surfaces `feature_contributions JSONB` so backend.html can
--     show "why this score is what it is" per row.
--
-- LOR ANCHOR CURVE
-- ----------------
-- Source: ATTOM Q1 2026 tenure report + Redfin homeowner tenure series
-- + ARIC-cohort life-course mobility research. Industry vendors
-- (Versium, SmartZip, Offrs) optimize on tenure rather than raw age.
--
-- Bucket boundaries chosen to reflect the propensity-to-list shape:
--   < 5 yr   -> very low      (just bought, low churn)
--   5-9 yr   -> low-medium    (rising but rate-locked since 2022)
--   10-14 yr -> medium        (statistical "thinking about it" cohort)
--   15-20 yr -> high          (peak life-event window)
--   21-30 yr -> high          (kids out, downsize / estate triggers)
--   31+ yr   -> high w/ decay (some are staying put; soft -5)
--
-- WEIGHTS (anchor)
--   LOR contribution dominates: max 35 pts (was sell_score=30 in v1).
--
-- IMPORTANT — RAW OWNER AGE
-- -------------------------
-- We DO NOT use raw owner age as a feature. The Illinois Human Rights
-- Act protects age 40+ in real estate. LOR is the
-- property-records-based proxy used by every major predictive seller
-- score vendor (SmartZip, Offrs, Versium). See MODEL_CARD for the
-- defensibility statement. Keep this comment in place.
--
-- ============================================================

CREATE OR REPLACE FUNCTION get_smart_predictability(
  p_village        TEXT    DEFAULT NULL,
  p_days_back      INTEGER DEFAULT 30,
  p_min_score      INTEGER DEFAULT 0,
  p_status_filter  TEXT    DEFAULT NULL
)
RETURNS TABLE (
  pin                       TEXT,
  property_address          TEXT,
  village                   TEXT,
  estimated_value           NUMERIC,
  milval_estimate           NUMERIC,
  sell_score                TEXT,
  signal_strength           INTEGER,  -- capped base score
  raw_base_score            INTEGER,  -- uncapped (for monitoring)
  feedback_adjusted_score   INTEGER,
  last_contact_date         DATE,
  last_interest_level       INTEGER,
  last_status               TEXT,
  follow_up_date            DATE,
  total_contacts            INTEGER,
  owner_name                TEXT,
  ownership_years           NUMERIC,
  equity_pct                NUMERIC,
  signals                   JSONB,
  feature_contributions     JSONB,    -- NEW: per-feature point breakdown
  feedback_history          JSONB
) AS $$
DECLARE
  v_top_band_validated BOOLEAN;
BEGIN
  -- ---------------------------------------------------------
  -- Gate: is the 60+ band earning its keep yet?
  -- (Carried forward from v1.5.) Until we have >=25 contacts in
  -- the top band AND >=30% of them showed interest_level >= 3,
  -- the dashboard sees capped scores.
  -- ---------------------------------------------------------
  SELECT (cnt >= 25 AND pct_interested >= 30.0)
  INTO v_top_band_validated
  FROM (
    SELECT
      COUNT(*) AS cnt,
      100.0 * COUNT(*) FILTER (WHERE f.interest_level >= 3)
        / NULLIF(COUNT(*), 0) AS pct_interested
    FROM remine_prospect_feedback f
    JOIN remine_property_index p ON p.pin = f.pin
    WHERE f.interest_level IS NOT NULL
      AND (
        -- v2 anchor for the gate: LOR + equity tier + change signals.
        CASE
          WHEN COALESCE(p.length_of_residence_years, p.ownership_time) >= 15
               AND COALESCE(p.length_of_residence_years, p.ownership_time) <= 30 THEN 35
          WHEN COALESCE(p.length_of_residence_years, p.ownership_time) >= 31 THEN 30
          WHEN COALESCE(p.length_of_residence_years, p.ownership_time) >= 10 THEN 22
          WHEN COALESCE(p.length_of_residence_years, p.ownership_time) >= 5  THEN 10
          ELSE 0
        END
        + CASE WHEN COALESCE(p.equity_estimate_pct, p.equity_percentage) >= 80 THEN 10
               WHEN COALESCE(p.equity_estimate_pct, p.equity_percentage) >= 60 THEN 5
               ELSE 0 END
      ) >= 60
  ) gate;
  v_top_band_validated := COALESCE(v_top_band_validated, FALSE);

  RETURN QUERY
  WITH change_signals AS (
    SELECT
      cl.pin,
      jsonb_agg(jsonb_build_object(
        'type',  cl.change_type,
        'field', cl.field_name,
        'date',  cl.change_date,
        'old',   cl.old_value,
        'new',   cl.new_value
      ) ORDER BY cl.change_date DESC) AS recent_changes,
      bool_or(cl.change_type = 'ownership_change') AS has_ownership_change,
      bool_or(cl.change_type = 'mailing_change')   AS has_mailing_change,
      bool_or(cl.change_type = 'title_change')     AS has_title_change,
      bool_or(cl.change_type = 'mortgage_change')  AS has_mortgage_change,
      bool_or(cl.change_type = 'sell_score_change') AS has_score_change
    FROM remine_change_log cl
    WHERE cl.change_date >= CURRENT_DATE - p_days_back
    GROUP BY cl.pin
  ),
  latest_feedback AS (
    SELECT DISTINCT ON (f.pin)
      f.pin,
      f.contact_date,
      f.interest_level,
      f.status,
      f.follow_up_date,
      f.notes,
      f.owner_sentiment,
      f.price_expectation,
      f.reason_for_selling,
      f.follow_up_action
    FROM remine_prospect_feedback f
    ORDER BY f.pin, f.contact_date DESC, f.id DESC
  ),
  feedback_counts AS (
    SELECT f.pin,
      COUNT(*) AS total_contacts,
      MAX(f.interest_level) AS max_interest_ever,
      COUNT(*) FILTER (WHERE f.interest_level <= 1) AS negative_contact_count,
      jsonb_agg(jsonb_build_object(
        'date',      f.contact_date,
        'interest',  f.interest_level,
        'status',    f.status,
        'sentiment', f.owner_sentiment,
        'notes',     f.notes
      ) ORDER BY f.contact_date DESC) AS history
    FROM remine_prospect_feedback f
    GROUP BY f.pin
  ),
  scored AS (
    SELECT
      p.pin,
      p.property_address,
      p.village,
      p.estimated_value,
      ROUND(p.estimated_value * 0.9339 * 0.85
            + p.total_assessed_value * 3 * 0.15) AS milval_est,
      p.sell_score,
      ----------------------------------------------------------------
      -- LOR (anchor) — uses standardized column with fall-back to
      -- Remine's ownership_time so this works pre-ETL.
      ----------------------------------------------------------------
      COALESCE(p.length_of_residence_years, p.ownership_time) AS lor_years,

      ----------------------------------------------------------------
      -- Per-feature point contributions (used in feature_contributions
      -- JSON below + summed into raw_base).
      ----------------------------------------------------------------

      -- 1) LOR anchor — max 35 pts.
      (CASE
        WHEN COALESCE(p.length_of_residence_years, p.ownership_time) IS NULL THEN 0
        WHEN COALESCE(p.length_of_residence_years, p.ownership_time) < 5  THEN 0
        WHEN COALESCE(p.length_of_residence_years, p.ownership_time) < 10 THEN 10  -- low-medium
        WHEN COALESCE(p.length_of_residence_years, p.ownership_time) < 15 THEN 22  -- medium
        WHEN COALESCE(p.length_of_residence_years, p.ownership_time) <= 20 THEN 35 -- high
        WHEN COALESCE(p.length_of_residence_years, p.ownership_time) <= 30 THEN 33 -- high
        ELSE 28                                                                    -- 31+ decay
      END)::INTEGER AS pts_lor,

      -- 2) Equity tier — max 12 pts.
      (CASE
        WHEN COALESCE(p.equity_estimate_pct, p.equity_percentage) >= 80 THEN 12
        WHEN COALESCE(p.equity_estimate_pct, p.equity_percentage) >= 60 THEN 7
        WHEN COALESCE(p.equity_estimate_pct, p.equity_percentage) >= 40 THEN 3
        ELSE 0
      END)::INTEGER AS pts_equity,

      -- 3) Change-log signals — preserved from v1.
      (CASE WHEN cs.has_ownership_change THEN 25 ELSE 0 END)::INTEGER AS pts_ownership_change,
      (CASE WHEN cs.has_mailing_change   THEN 20 ELSE 0 END)::INTEGER AS pts_mailing_change,
      (CASE WHEN cs.has_title_change     THEN 20 ELSE 0 END)::INTEGER AS pts_title_change,
      (CASE WHEN cs.has_mortgage_change  THEN 10 ELSE 0 END)::INTEGER AS pts_mortgage_change,
      (CASE WHEN cs.has_score_change     THEN 15 ELSE 0 END)::INTEGER AS pts_score_change,

      -- 4) Absentee / trust ownership.
      (CASE WHEN p.is_absentee    THEN 5 ELSE 0 END)::INTEGER AS pts_absentee,
      (CASE WHEN p.is_trust_owned THEN 5 ELSE 0 END)::INTEGER AS pts_trust,

      -- 5) Sell_score (Remine) — demoted from anchor to secondary
      --    contributor in v2. Max 12 pts (was 30 in v1).
      (CASE
        WHEN p.sell_score = 'High'   THEN 12
        WHEN p.sell_score = 'Medium' THEN 6
        ELSE 0
      END)::INTEGER AS pts_remine_sell_score,

      ----------------------------------------------------------------
      -- PLACEHOLDER SLOTS — wired but currently 0-valued.
      -- Phase 2 ETLs will set the source columns; weights below will
      -- be tuned once we have data + feedback.
      ----------------------------------------------------------------

      -- 6) Permit activity (last 365d) — slot reserved; weight 0 in Phase 1.
      (CASE WHEN p.permit_activity_recent_bool THEN 0 ELSE 0 END)::INTEGER AS pts_permits,

      -- 7) Life event flags — slot reserved; weight 0 in Phase 1.
      (CASE WHEN COALESCE(p.life_event_flags, '{}'::jsonb) @> '{"probate": true}'      THEN 0 ELSE 0 END
       + CASE WHEN COALESCE(p.life_event_flags, '{}'::jsonb) @> '{"divorce": true}'    THEN 0 ELSE 0 END
       + CASE WHEN COALESCE(p.life_event_flags, '{}'::jsonb) @> '{"obit_match": true}' THEN 0 ELSE 0 END
       + CASE WHEN COALESCE(p.life_event_flags, '{}'::jsonb) @> '{"job_change": true}' THEN 0 ELSE 0 END
      )::INTEGER AS pts_life_events,

      -- 8) Neighborhood velocity — slot reserved; weight 0 in Phase 1.
      (CASE
         WHEN p.nbhd_velocity_pct IS NULL THEN 0
         WHEN p.nbhd_velocity_pct >= 8 THEN 0
         WHEN p.nbhd_velocity_pct >= 5 THEN 0
         ELSE 0
       END)::INTEGER AS pts_nbhd_velocity,

      ----------------------------------------------------------------
      -- Feedback modifier (carried forward from v1.5).
      ----------------------------------------------------------------
      (
        CASE
          WHEN lf.interest_level = 5 THEN 50
          WHEN lf.interest_level = 4 THEN 35
          WHEN lf.interest_level = 3 THEN 20
          WHEN lf.interest_level = 2 THEN -10
          WHEN lf.interest_level = 1 THEN -30
          WHEN lf.interest_level = 0 THEN -50
          WHEN lf.status = 'do_not_contact' THEN -100
          WHEN lf.status = 'listed' THEN 60
          ELSE 0
        END
        - LEAST(
            40,
            10 * GREATEST(
              0,
              COALESCE(fc.negative_contact_count, 0)
                - CASE WHEN lf.interest_level <= 1 THEN 1 ELSE 0 END
            )
          )
      ) AS feedback_modifier,

      lf.contact_date              AS last_contact,
      lf.interest_level            AS last_interest,
      COALESCE(lf.status, 'new')   AS last_status,
      lf.follow_up_date,
      COALESCE(fc.total_contacts, 0) AS total_contacts,
      COALESCE(p.owner1_full_name, 'Unknown') AS owner_name,
      p.ownership_time,
      p.equity_percentage,
      jsonb_build_object(
        'sell_score',         p.sell_score,
        'equity_pct',         p.equity_percentage,
        'equity_pct_canonical', p.equity_estimate_pct,
        'ownership_years',    p.ownership_time,
        'lor_years',          COALESCE(p.length_of_residence_years, p.ownership_time),
        'is_absentee',        p.is_absentee,
        'is_trust',           p.is_trust_owned,
        'is_corporate',       p.is_corporate_owned,
        'occupancy',          p.occupancy_status,
        'recent_changes',     COALESCE(cs.recent_changes, '[]'::JSONB),
        'mailing_city',       p.mailing_city,
        'mailing_state',      p.mailing_state,
        'document_type',      p.document_type,
        'recording_date',     p.recording_date,
        'permit_activity_recent', COALESCE(p.permit_activity_recent_bool, false),
        'life_event_flags',   COALESCE(p.life_event_flags, '{}'::jsonb),
        'nbhd_velocity_pct',  p.nbhd_velocity_pct,
        'signal_sources',     COALESCE(p.signal_sources, '[]'::jsonb),
        'signal_last_seen_at', p.signal_last_seen_at,
        'top_band_capped',    NOT v_top_band_validated,
        'negative_contact_count', COALESCE(fc.negative_contact_count, 0)
      ) AS signals,
      COALESCE(fc.history, '[]'::JSONB) AS feedback_history
    FROM remine_property_index p
    LEFT JOIN change_signals  cs ON cs.pin = p.pin
    LEFT JOIN latest_feedback lf ON lf.pin = p.pin
    LEFT JOIN feedback_counts fc ON fc.pin = p.pin
    WHERE (p_village IS NULL OR p.village = p_village)
      AND p.mls_status IS DISTINCT FROM 'Active'
      AND (p_status_filter IS NULL OR COALESCE(lf.status, 'new') = p_status_filter)
  ),
  raw AS (
    SELECT
      s.*,
      (
        s.pts_lor
        + s.pts_equity
        + s.pts_ownership_change
        + s.pts_mailing_change
        + s.pts_title_change
        + s.pts_mortgage_change
        + s.pts_score_change
        + s.pts_absentee
        + s.pts_trust
        + s.pts_remine_sell_score
        + s.pts_permits
        + s.pts_life_events
        + s.pts_nbhd_velocity
      )::INTEGER AS raw_base
    FROM scored s
  )
  SELECT
    r.pin,
    r.property_address,
    r.village,
    r.estimated_value,
    r.milval_est AS milval_estimate,
    r.sell_score,
    -- Capped (post-clamp) signal strength.
    CASE
      WHEN v_top_band_validated THEN r.raw_base
      ELSE LEAST(r.raw_base, 59)
    END::INTEGER AS signal_strength,
    r.raw_base::INTEGER AS raw_base_score,
    GREATEST(0,
      CASE
        WHEN v_top_band_validated THEN r.raw_base
        ELSE LEAST(r.raw_base, 59)
      END
      + r.feedback_modifier
    )::INTEGER AS feedback_adjusted_score,
    r.last_contact      AS last_contact_date,
    r.last_interest     AS last_interest_level,
    r.last_status,
    r.follow_up_date,
    r.total_contacts::INTEGER,
    r.owner_name,
    r.ownership_time    AS ownership_years,
    r.equity_percentage AS equity_pct,
    r.signals,
    -- feature_contributions: per-feature point breakdown for the
    -- dashboard "why this score?" tooltip.
    jsonb_build_object(
      'lor_anchor',          r.pts_lor,
      'equity_tier',         r.pts_equity,
      'ownership_change',    r.pts_ownership_change,
      'mailing_change',      r.pts_mailing_change,
      'title_change',        r.pts_title_change,
      'mortgage_change',     r.pts_mortgage_change,
      'sell_score_change',   r.pts_score_change,
      'absentee',            r.pts_absentee,
      'trust',               r.pts_trust,
      'remine_sell_score',   r.pts_remine_sell_score,
      'permits_recent',      r.pts_permits,
      'life_events',         r.pts_life_events,
      'nbhd_velocity',       r.pts_nbhd_velocity,
      'feedback_modifier',   r.feedback_modifier,
      'raw_base',            r.raw_base,
      'top_band_capped',     NOT v_top_band_validated
    ) AS feature_contributions,
    r.feedback_history
  FROM raw r
  WHERE (
      CASE
        WHEN v_top_band_validated THEN r.raw_base
        ELSE LEAST(r.raw_base, 59)
      END
      + r.feedback_modifier
    ) >= p_min_score
    AND COALESCE(r.last_status, 'new') != 'do_not_contact'
  ORDER BY
    CASE WHEN r.follow_up_date = CURRENT_DATE THEN 0
         WHEN r.follow_up_date < CURRENT_DATE AND r.follow_up_date IS NOT NULL THEN 1
         ELSE 2 END,
    (
      CASE
        WHEN v_top_band_validated THEN r.raw_base
        ELSE LEAST(r.raw_base, 59)
      END
      + r.feedback_modifier
    ) DESC,
    r.estimated_value DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VERIFICATION QUERIES (run after deploy)
-- ============================================================
-- SELECT pin, signal_strength, raw_base_score,
--        feature_contributions
--   FROM get_smart_predictability('Winnetka', 30, 30, NULL)
--   LIMIT 5;
-- Expected: feature_contributions JSONB shows non-zero pts_lor
--           wherever ownership_time (or LOR) is >= 5.

-- ============================================================
-- ROLLBACK
-- ============================================================
-- To revert to v1, re-run the CREATE OR REPLACE FUNCTION
-- get_smart_predictability(...) block from:
--   _archive/historical-assets/sql-setup/remine_feedback_setup.sql
-- (lines ~84-258)
--
-- To revert to v1.5, re-run:
--   sql-proposed/get_smart_predictability_reweight_2026-05-29.sql
--
-- Both are hot swaps. The RETURNS TABLE signature here adds two new
-- columns (raw_base_score, feature_contributions). Reverting will
-- drop those — any frontend reads on those columns will need to
-- handle their absence as NULL.
-- ============================================================
