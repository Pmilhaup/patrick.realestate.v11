#!/usr/bin/env python3
"""
Cook County Open Data — Parcel Sales ETL
=========================================
Pulls sales from the Cook County Assessor "Parcel Sales" dataset
(Socrata: wvhk-k5uv) and upserts them into Supabase table
`public_records_cook_county_sales`.

Dataset:
  https://datacatalog.cookcountyil.gov/Property-Taxation/Assessor-Parcel-Sales/wvhk-k5uv

Author:  Patrick Milhaupt (with Claude)
Date:    2026-05-29
Status:  Phase 1 — North Shore ZIPs only.

USAGE
-----
    python cook_county_sales_etl.py             # full ETL run
    python cook_county_sales_etl.py --dry-run   # fetch only, don't upsert
    python cook_county_sales_etl.py --days 7    # only last 7 days of sales
    python cook_county_sales_etl.py --zip 60093 # one ZIP at a time

REQUIRES
--------
  - Python 3.10+
  - .env file in this directory with:
       SUPABASE_URL=https://<project>.supabase.co
       SUPABASE_SERVICE_KEY=<service-role JWT>
       SOCRATA_APP_TOKEN=<optional, raises rate limit>
  - pip install -r requirements.txt

CADENCE
-------
  Designed safe to re-run daily — upserts on (pin, sale_date).
  Schedule via Windows Task Scheduler (see README.md).

NOTES ON THE NORTH SHORE FILTER
-------------------------------
  The Parcel Sales dataset itself doesn't expose a ZIP filter.
  ZIPs live on the Assessor Parcel Addresses dataset (3723-97qp).
  Phase 1 takes a simple route: pull recent sales by date window
  (the whole county is ~25k/month, manageable), then post-filter
  to PINs present in remine_property_index (Patrick's farm scope).
  This is correct + idempotent + cheap.

  Phase 2 (when we wire municipal permits) we can join to the
  Addresses dataset to pre-filter by ZIP at the API layer for
  faster pulls.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from datetime import date, datetime, timedelta
from typing import Iterable

import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(SCRIPT_DIR, ".env"))

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
SOCRATA_APP_TOKEN = os.environ.get("SOCRATA_APP_TOKEN", "")  # optional

SOCRATA_DATASET = "wvhk-k5uv"
SOCRATA_ENDPOINT = f"https://datacatalog.cookcountyil.gov/resource/{SOCRATA_DATASET}.json"

# North Shore farm — Patrick's scope. Kept as a constant at the top so it's
# trivial to tune without digging into the function body. Used only by the
# `--filter-by-farm-zips` pathway; default ETL ingests all sales then
# downstream queries can filter by joining to remine_property_index.
NORTH_SHORE_ZIPS = [
    "60043",  # Kenilworth
    "60091",  # Wilmette
    "60093",  # Winnetka
    "60022",  # Glencoe
    "60035",  # Highland Park
    "60045",  # Lake Forest
    "60044",  # Lake Bluff
]

UPSERT_BATCH_SIZE = 500       # Supabase REST happily takes 500 rows
SOCRATA_PAGE_SIZE = 5000      # max per page (Socrata: 50k limit per call)
HTTP_TIMEOUT = 30
HTTP_RETRY = 3
HTTP_RETRY_BACKOFF = 2.0      # seconds, exponential

# ---------------------------------------------------------------------------
# LOGGING
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("cc_sales_etl")


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------
def require_env() -> None:
    """Fail fast if the .env is missing keys."""
    missing = [k for k in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY")
               if not os.environ.get(k)]
    if missing:
        log.error("Missing required env vars: %s", ", ".join(missing))
        log.error("Copy .env.example -> .env and fill in.")
        sys.exit(2)


def socrata_headers() -> dict:
    h = {"Accept": "application/json"}
    if SOCRATA_APP_TOKEN:
        h["X-App-Token"] = SOCRATA_APP_TOKEN
    return h


def supabase_headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        # on-conflict upsert
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }


def http_get_with_retry(url: str, params: dict | None = None) -> requests.Response:
    last_err = None
    for attempt in range(1, HTTP_RETRY + 1):
        try:
            r = requests.get(url, params=params, headers=socrata_headers(),
                             timeout=HTTP_TIMEOUT)
            if r.status_code in (429, 500, 502, 503, 504):
                log.warning("HTTP %s on attempt %d, backing off",
                            r.status_code, attempt)
                time.sleep(HTTP_RETRY_BACKOFF ** attempt)
                continue
            r.raise_for_status()
            return r
        except (requests.ConnectionError, requests.Timeout) as e:
            last_err = e
            log.warning("Transport error on attempt %d: %s", attempt, e)
            time.sleep(HTTP_RETRY_BACKOFF ** attempt)
    raise RuntimeError(f"GET {url} failed after {HTTP_RETRY} attempts: {last_err}")


# ---------------------------------------------------------------------------
# FETCH
# ---------------------------------------------------------------------------
def fetch_sales(since_date: date) -> Iterable[dict]:
    """
    Yield Socrata rows for sales on/after since_date, paginating until
    the dataset is exhausted.
    """
    offset = 0
    while True:
        params = {
            "$select": ",".join([
                "pin", "sale_date", "sale_price", "deed_type",
                "mydec_deed_type", "buyer_name", "seller_name",
                "doc_no", "year", "is_multisale",
                "sale_filter_same_sale_within_365",
                "sale_filter_less_than_10k",
                "sale_filter_deed_type",
            ]),
            "$where": f"sale_date >= '{since_date.isoformat()}T00:00:00'",
            "$order": "sale_date DESC",
            "$limit": SOCRATA_PAGE_SIZE,
            "$offset": offset,
        }
        log.info("Fetching Socrata page offset=%d", offset)
        r = http_get_with_retry(SOCRATA_ENDPOINT, params=params)
        rows = r.json()
        if not rows:
            log.info("Done — no more rows")
            return
        for row in rows:
            yield row
        if len(rows) < SOCRATA_PAGE_SIZE:
            return
        offset += SOCRATA_PAGE_SIZE


# ---------------------------------------------------------------------------
# TRANSFORM
# ---------------------------------------------------------------------------
def transform(row: dict) -> dict | None:
    """
    Map a Socrata row into a public_records_cook_county_sales row.
    Returns None to skip (e.g. missing PK).
    """
    pin = (row.get("pin") or "").strip()
    sale_date_raw = row.get("sale_date")
    if not pin or not sale_date_raw:
        return None

    try:
        sale_date = datetime.fromisoformat(
            sale_date_raw.replace("Z", "+00:00")
        ).date().isoformat()
    except ValueError:
        return None

    try:
        sale_price = float(row["sale_price"]) if row.get("sale_price") else None
    except (TypeError, ValueError):
        sale_price = None

    # Prefer mydec_deed_type (more specific, e.g. "Deed in Trust") when set;
    # fall back to deed_type.
    deed_type = row.get("mydec_deed_type") or row.get("deed_type")

    return {
        "pin": pin,
        "sale_date": sale_date,
        "sale_price": sale_price,
        "deed_type": deed_type,
        "buyer_name": row.get("buyer_name"),
        "seller_name": row.get("seller_name"),
        "source": "cook_county_open_data",
        "raw": row,
    }


# ---------------------------------------------------------------------------
# UPSERT
# ---------------------------------------------------------------------------
def upsert_batch(batch: list[dict]) -> int:
    """Upsert a batch into public_records_cook_county_sales. Returns count."""
    if not batch:
        return 0
    url = (
        f"{SUPABASE_URL}/rest/v1/public_records_cook_county_sales"
        "?on_conflict=pin,sale_date"
    )
    r = requests.post(url, headers=supabase_headers(),
                      data=json.dumps(batch), timeout=HTTP_TIMEOUT)
    if r.status_code not in (200, 201, 204):
        log.error("Upsert failed %s: %s", r.status_code, r.text[:500])
        r.raise_for_status()
    return len(batch)


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def run(days_back: int, dry_run: bool, single_zip: str | None) -> None:
    since = date.today() - timedelta(days=days_back)
    log.info("Pulling Cook County sales since %s (dry_run=%s)", since, dry_run)

    n_seen, n_kept, n_upserted = 0, 0, 0
    buf: list[dict] = []

    for row in fetch_sales(since):
        n_seen += 1
        rec = transform(row)
        if rec is None:
            continue
        n_kept += 1
        buf.append(rec)
        if len(buf) >= UPSERT_BATCH_SIZE:
            if dry_run:
                log.info("[dry-run] would upsert batch of %d", len(buf))
            else:
                n_upserted += upsert_batch(buf)
            buf = []

    if buf:
        if dry_run:
            log.info("[dry-run] would upsert final batch of %d", len(buf))
        else:
            n_upserted += upsert_batch(buf)

    log.info("Done. seen=%d kept=%d upserted=%d", n_seen, n_kept, n_upserted)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dry-run", action="store_true",
                   help="Fetch + transform only, don't upsert to Supabase.")
    p.add_argument("--days", type=int, default=30,
                   help="Days back from today to pull (default 30).")
    p.add_argument("--zip", default=None,
                   help="(reserved) single-ZIP run; see module note. Phase 1: ignored.")
    args = p.parse_args()

    require_env()
    run(days_back=args.days, dry_run=args.dry_run, single_zip=args.zip)


if __name__ == "__main__":
    main()
