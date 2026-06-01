# patrick.realestate · v11

The chapter-narrative v11 of [patrick.realestate](https://patrick.realestate) — Patrick Milhaupt's North Shore practice site, built on the v3.4 "Dazzle Edition" brand kit.

## Stack

- Vanilla HTML/CSS/JS (no build step)
- **three.js** + **lenis** + **gsap** + **ScrollTrigger** — local in `lib/` (vendored, no CDN dep)
- **Plotly** + custom `BrandCharts` theme — for the intelligence dashboard
- **Supabase** — live MLS data for the intelligence chapter (anon read-only)

## Structure

```
/
├── index.html                  ← keystone narrative, 7 chapters
├── intelligence.html           ← live Supabase dashboard, 4 chapters
├── properties.html, about.html, neighborhoods.html
├── buying.html, selling.html, contact.html
├── preview.html                ← internal iframe gallery of all 14 pages
├── neighborhoods/              ← 6 village pages
├── brand/                      ← v3.4 Dazzle Edition brand kit
│   ├── brand-shared.css        ← fonts, tokens, typography
│   ├── brand-dark.css          ← navy theme + foil em styling
│   ├── chapter.css             ← chapter shell + Lenis CSS overrides
│   ├── liquid-bg.js            ← painterly WebGL canvas
│   ├── charts/plotly-brand.js  ← canonical Plotly theme (BrandCharts)
│   └── assets/                 ← logos, imagery
└── lib/                        ← vendored animation libs (three, gsap, lenis, ScrollTrigger)
```

## Deploys

This repo is connected to **Cloudflare Pages**. Every push to `main` triggers a deploy at https://patrick.realestate (prod) and a preview URL for branches.

## Development

No build step. Open `index.html` via a local web server (`python -m http.server 8000`) — never directly via `file://`, which breaks Supabase fetches with `Origin: null`.

## Open backlog

- Phase C: wire per-village live KPIs to `mv_market_intelligence`
- Supabase anon-access audit: confirm `GRANT SELECT ON mv_market_intelligence TO anon` is in place
- Realist PDF autofill parser for backend cma-producer.html
