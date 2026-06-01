-- ============================================================
-- PROPOSED RE-WEIGHTING: get_smart_predictability
-- File: get_smart_predictability_reweight_2026-05-29.sql
-- Author: assistant draft for Patrick review
-- Date:   2026-05-29
-- Status: DRAFT — DO NOT DEPLOY without Patrick's sign-off
-- ============================================================
--
-- WHY THIS EXISTS
-- ---------------
-- The accuracy check (get_predictability_accuracy) currently reports:
--
--   60+ (Very High) band: n=7 contacted
--                         0.0% interested  (interest_level >= 3)
--                         85.7% NOT interested (interest_level <= 1)
--                         Flag: "Weak signal — consider reducing weight"
--
-- The base-score formula in get_smart_predictability awards 30 pts for
-- sell_score='High' plus stackable bonuses for ownership/mailing/title/
-- mortgage changes, equity, ownership_time, absentee, trust. A property
-- with sell_score='High' + an ownership_change + 10y ownership + 80% equity
-- already hits 75 — well above 60 — purely from signals, with zero
-- validation against actual call outcomes.
--
-- HYPOTHESIS (small sample — n=7 — treat as preliminary)
-- ------------------------------------------------------
-- The top band is over-weighted relative to validated outcomes. Two
-- conservative dampeners:
--
--   1. CAP the raw base_score at 59 until the 60+ band has at least
--      n=25 contacts AND pct_interested >= 30%. This prevents the
--      dashboard from showing "Very High" confidence we haven't earned.
--      Implementation: clamp the SELECT-side base_score, but preserve
--      the raw uncapped value in a new column `raw_base_score` so we
--      can keep monitoring the underlying signal distribution.
--
--   2. FEEDBACK PENALTY MEMORY. Today the feedback_modifier only reads
--      the LATEST contact. A prospect contacted twice with interest_level
--      0/1 should be dampened MORE than one contacted once. Add a small
--      cumulative penalty: -10 per prior contact at interest_level <= 1.
--      Caps at -40 to avoid runaway negative scores.
--
-- Both changes are reversible — see ROLLBACK at bottom.
--
-- NOT IN SCOPE FOR THIS DRAFT
-- ---------------------------
-- - Re-weighting individual base-score component bonuses (ownership_change,
--   equity_pct, etc.). Need more data per band before tuning components.
-- - Removing the 30-pt sell_score='High' bonus. Same reason.
-- - Adjusting get_predictability_accuracy itself.
--
-- DEPLOYMENT NOTES
-- ----------------
-- - This is CREATE OR REPLACE, so it's a hot swap. No downtime, but the
--   backend.html dashboard will reflect new scoring on next refresh.
-- - The new `raw_base_score` column is ADDITIVE to the RETURNS TABLE
--   signature. Confirm any frontend consumers (backend.html, prospect
--   tracker) handle the extra column. PostgREST returns by name so an
--   extra column is non-breaking for existing select-by-name reads.
-- - If a consumer uses positional binding (rare), it will need updating.
--
-- ============================================================

CREATE OR REPLACE FUNCTION get_smart_predictability(
  p_village TEXT DEFAULT NULL,
  p_days_back INTEGER DEFAULT 30,
  p_min_score INTEGER DEFAULT 0,
  p_status_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  pin TEXT,
  property_address TEXT,
  village TEXT,
  estimated_value NUMERIC,
  milval_estimate NUMERIC,
  sell_score TEXT,
  signal_strength INTEGER,           -- capped (post-clamp) base score
  raw_base_score INTEGER,            -- NEW: uncapped raw score for monitoring
  feedback_adjusted_score INTEGER,
  last_contact_date DATE,
  last_interest_level INTEGER,
  last_status TEXT,
  follow_up_date DATE,
  total_contacts INTEGER,
  owner_name TEXT,
  ownership_years NUMERIC,
  equity_pct NUMERIC,
  signals JSONB,
  feedback_history JSONB
) AS $$
DECLARE
  -- Gate: should we still cap the top band? Yes until we have evidence.
  -- Evaluated once per call. Cheap.
  v_top_band_validated BOOLEAN;
BEGIN
  -- Check whether the 60+ band has earned its keep yet.
  -- If we have >= 25 contacts in that band AND >= 30% report interest_level >= 3,
  -- lift the cap. Until then, clamp to 59.
  SELECT (cnt >= 25 AND pct_interested >= 30.0)
  INTO v_top_band_validated
  FROM (
    SELECT
      COUNT(*) AS cnt,
      100.0 * COUNT(*) FILTER (WHERE f.interest_level >= 3) / NULLIF(COUNT(*), 0) AS pct_interested
    FROM remine_prospect_feedback f
    JOIN remine_property_index p ON p.pin = f.pin
    WHERE f.interest_level IS NOT NULL
      AND (
        (CASE WHEN p.sell_score = 'High' THEN 30
              WHEN p.sell_score = 'Medium' THEN 15 ELSE 0 END
        + CASE WHEN p.equity_percentage >= 80 THEN 10
               WHEN p.equity_percentage >= 60 THEN 5 ELSE 0 END
        + CASE WHEN p.ownership_time >= 10 THEN 10
               WHEN p.ownership_time >= 7 THEN 5 ELSE 0 END
        + CASE WHEN p.is_absentee THEN 5 ELSE 0 END
        + CASE WHEN p.is_trust_owned THEN 5 ELSE 0 END
        ) >= 60
      )
  ) gate;
  v_top_band_validated := COALESCE(v_top_band_validated, FALSE);

  RETURN QUERY
  WITH change_signals AS (
    SELECT
      cl.pin,
      jsonb_agg(jsonb_build_object(
        'type', cl.change_type,
        'field', cl.field_name,
        'date', cl.change_date,
        'old', cl.old_value,
        'new', cl.new_value
      ) ORDER BY cl.change_date DESC) AS recent_changes,
      bool_or(cl.change_type = 'ownership_change') AS has_ownership_change,
      bool_or(cl.change_type = 'mailing_change') AS has_mailing_change,
      bool_or(cl.change_type = 'title_change') AS has_title_change,
      bool_or(cl.change_type = 'mortgage_change') AS has_mortgage_change,
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
    SELECT f.pin, COUNT(*) AS total_contacts,
      MAX(f.interest_level) AS max_interest_ever,
      -- NEW: count of "definitely not interested" prior contacts
      -- (drives the cumulative penalty below)
      COUNT(*) FILTER (WHERE f.interest_level <= 1) AS negative_contact_count,
      jsonb_agg(jsonb_build_object(
        'date', f.contact_date,
        'interest', f.interest_level,
        'status', f.status,
        'sentiment', f.owner_sentiment,
        'notes', f.notes
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
      ROUND(p.estimated_value * 0.9339 * 0.85 + p.total_assessed_value * 3 * 0.15) AS milval_est,
      p.sell_score,
      -- Raw base score (unchanged math) — preserved for monitoring.
      (
        CASE WHEN p.sell_score = 'High' THEN 30
             WHEN p.sell_score = 'Medium' THEN 15
             ELSE 0 END
        + CASE WHEN cs.has_ownership_change THEN 25 ELSE 0 END
        + CASE WHEN cs.has_mailing_change THEN 20 ELSE 0 END
        + CASE WHEN cs.has_title_change THEN 20 ELSE 0 END
        + CASE WHEN cs.has_mortgage_change THEN 10 ELSE 0 END
        + CASE WHEN cs.has_score_change THEN 15 ELSE 0 END
        + CASE WHEN p.equity_percentage >= 80 THEN 10
               WHEN p.equity_percentage >= 60 THEN 5 ELSE 0 END
        + CASE WHEN p.ownership_time >= 10 THEN 10
               WHEN p.ownership_time >= 7 THEN 5 ELSE 0 END
        + CASE WHEN p.is_absentee THEN 5 ELSE 0 END
        + CASE WHEN p.is_trust_owned THEN 5 ELSE 0 END
      )::INTEGER AS raw_base,
      -- Feedback modifier: original logic + cumulative negative-contact penalty.
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
        -- NEW penalty: -10 per prior "definitely not" contact, capped at -40.
        -- Excludes the latest contact (which is already counted above) by
        -- subtracting 1 when the latest itself is in the negative bucket.
        - LEAST(
            40,
            10 * GREATEST(
              0,
              COALESCE(fc.negative_contact_count, 0)
                - CASE WHEN lf.interest_level <= 1 THEN 1 ELSE 0 END
            )
          )
      ) AS feedback_modifier,
      lf.contact_date AS last_contact,
      lf.interest_level AS last_interest,
      COALESCE(lf.status, 'new') AS last_status,
      lf.follow_up_date,
      COALESCE(fc.total_contacts, 0) AS total_contacts,
      COALESCE(p.owner1_full_name, 'Unknown') AS owner_name,
      p.ownership_time,
      p.equity_percentage,
      jsonb_build_object(
        'sell_score', p.sell_score,
        'equity_pct', p.equity_percentage,
        'ownership_years', p.ownership_time,
        'is_absentee', p.is_absentee,
        'is_trust', p.is_trust_owned,
        'is_corporate', p.is_corporate_owned,
        'occupancy', p.occupancy_status,
        'recent_changes', COALESCE(cs.recent_changes, '[]'::JSONB),
        'mailing_city', p.mailing_city,
        'mailing_state', p.mailing_state,
        'document_type', p.document_type,
        'recording_date', p.recording_date,
        -- NEW: surface the cap state so the dashboard can show a badge.
        'top_band_capped', NOT v_top_band_validated,
        'negative_contact_count', COALESCE(fc.negative_contact_count, 0)
      ) AS signals,
      COALESCE(fc.history, '[]'::JSONB) AS feedback_history
    FROM remine_property_index p
    LEFT JOIN change_signals cs ON cs.pin = p.pin
    LEFT JOIN latest_feedback lf ON lf.pin = p.pin
    LEFT JOIN feedback_counts fc ON fc.pin = p.pin
    WHERE (p_village IS NULL OR p.village = p_village)
      AND p.mls_status IS DISTINCT FROM 'Active'
      AND (p_status_filter IS NULL OR COALESCE(lf.status, 'new') = p_status_filter)
  )
  SELECT
    s.pin,
    s.property_address,
    s.village,
    s.estimated_value,
    s.milval_est AS milval_estimate,
    s.sell_score,
    -- signal_strength = CAPPED base score (clamped at 59 until top band is validated)
    CASE
      WHEN v_top_band_validated THEN s.raw_base
      ELSE LEAST(s.raw_base, 59)
    END::INTEGER AS signal_strength,
    s.raw_base::INTEGER AS raw_base_score,
    GREATEST(0,
      CASE
        WHEN v_top_band_validated THEN s.raw_base
        ELSE LEAST(s.raw_base, 59)
      END
      + s.feedback_modifier
    )::INTEGER AS feedback_adjusted_score,
    s.last_contact AS last_contact_date,
    s.last_interest AS last_interest_level,
    s.last_status,
    s.follow_up_date,
    s.total_contacts::INTEGER,
    s.owner_name,
    s.ownership_time AS ownership_years,
    s.equity_percentage AS equity_pct,
    s.signals,
    s.feedback_history
  FROM scored s
  WHERE (
      CASE
        WHEN v_top_band_validated THEN s.raw_base
        ELSE LEAST(s.raw_base, 59)
      END
      + s.feedback_modifier
    ) >= p_min_score
    AND COALESCE(s.last_status, 'new') != 'do_not_contact'
  ORDER BY
    CASE WHEN s.follow_up_date = CURRENT_DATE THEN 0
         WHEN s.follow_up_date < CURRENT_DATE AND s.follow_up_date IS NOT NULL THEN 1
         ELSE 2 END,
    (
      CASE
        WHEN v_top_band_validated THEN s.raw_base
        ELSE LEAST(s.raw_base, 59)
      END
      + s.feedback_modifier
    ) DESC,
    s.estimated_value DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- To revert, re-run the canonical definition from:
--   _archive/historical-assets/sql-setup/remine_feedback_setup.sql
-- (the CREATE OR REPLACE FUNCTION get_smart_predictability block,
--  approximately lines 84–258).
--
-- A hot swap back to that version reverts both:
--   (1) the top-band cap
--   (2) the cumulative negative-contact penalty
-- and removes the `raw_base_score` column from the result set.
-- Frontend consumers that started reading raw_base_score will
-- need to handle its absence (treat as NULL).
-- ============================================================
