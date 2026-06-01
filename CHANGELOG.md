# CHANGELOG

Append entries to the top. Bump the version per the rules in EDIT_WORKFLOW.md.

---

## v10 — 2026-05-06 — Initial consolidation

**What this version is**: A clean, deploy-ready snapshot of the canonical patrick.realestate site. Built by mirroring the live deployed Cloudflare version (deemed canonical) and pairing it with the byte-identical local design system files.

**Pages included**:
- Home (`index.html`)
- About (`about.html`)
- Properties (`properties.html`)
- Intelligence (`intelligence.html`) — Supabase live data
- Neighborhoods grid (`neighborhoods.html`)
- 6 village pages (Lake Forest, Winnetka, Kenilworth, Glencoe, Wilmette, Highland Park)
- Buying (`buying.html`)
- Selling (`selling.html`)
- Contact (`contact.html`)

**Design system**:
- `css/tokens.css` (design tokens)
- `css/core.css` (shared styles)
- `js/core.js` (nav, reveal, constellation canvas)

**Cleanup performed**:
- Removed Cloudflare runtime-injected analytics scripts (Cloudflare auto-injects them on serve, no need in source)
- Verified all pages have closing `</body>` and `</html>` tags
- Confirmed Supabase REST endpoints respond (HTTP 200) with daily_snapshots through 2026-05-06 and 27,456 raw_sales records

**Archived from prior versions** (in `Website Design/_archive/`):
- `patrick-realestate-v9` and `patrick-realestate-v9-prod` — Apr 21 deploy packages with `/assets/` folder structure (superseded by current flat structure)
- Old zip backups (`milhaupt-site-v8.zip`, `patrick-realestate-DEPLOY.zip`, etc.)
- Logo-bead-speaker experiments (Apr 27–28)
- `private-listings.html`, `meet.html` (404 on deployed site)
- Earlier index.html variants

**Known gaps** — see README.md "Known gaps and next steps":
1. Neighborhood pages don't yet pull live `daily_snapshots` data — recipe in EDIT_WORKFLOW.md
2. No `private-listings.html` or `meet.html` (in archive)
3. Backend/admin tools live in parent folder, not deployed publicly
