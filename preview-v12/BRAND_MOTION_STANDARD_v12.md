# patrick.realestate v12 — "Atelier" Brand & Motion Standard

**Version:** v12.0 · **Date:** 2026-06-10 · **Author:** Claude Fable 5
**The promise:** *a ride at Disneyland entering the world of luxury real estate.* Every page should feel like stepping into something exclusive and alive. This doc is the law every v12 page inherits so the magic is consistent, not one-off.

---

## 0. The single idea
**The gold is a material, not a color. The navy is the night; the gold is the light moving through it.** Restraint is what separates "Notre-Dame gold" from AI slop: one hero, one bloom, one specular sweep — never glitter everywhere. Luxury whispers.

---

## 1. Palette (canonical — in `brand/brand-v12.css`)

| Token | Hex | Use |
|---|---|---|
| `--void` | `#02060F` | page base (the night) |
| `--navy-0…3` | `#050E26 → #1A3470` | surfaces, cards, depth |
| `--gold-shadow…specular` | `#6E4B14 → #FFF8E2` | the foil ramp (shadow→base→light→specular) |
| `--gold-base` | `#C79A3E` | the "true gold" midpoint |
| `--ink-1…5` | `#FFFFFF → #36425C` | text |
| `--royal / --indigo` | `#2563FF / #6E6CFF` | cool counterpoint + **Zenlist** sub-brand |

**Gold is always a gradient** (`--foil`), never a flat fill. Flat `#FFD700` is banned — it reads cheap.

## 2. Type
- **Display / headlines:** Cormorant Garamond (italic `<em>` for the gold phrase). Big, confident, airy.
- **UI / body:** Inter (300–600).
- **Every numeral:** JetBrains Mono, tabular (`.data`). Data is part of the brand — make numbers feel engineered.

## 3. The foil system (how gold is rendered)
- `.foil` — gradient clipped to text + a 7s specular sweep. Use on **one** hero phrase per section, not every word.
- `.foil--still` — same gold, sweep paused — for inline `<em>` accents inside headlines.
- `.mark-foil` — paints a **real Sotheby's PNG mark** in gold via CSS `mask` (`--mark:url(...)`). The trademark shape is never altered; only its fill becomes foil. Masks live in `brand/assets/logos/*-mark.png` (white-on-transparent, generated from the official marks).
- `.shimmer` — a single diagonal specular pass. Hero logo + medallion only. Never on body copy.
- `.foil-surface` / `.btn-gold` — foil on surfaces (primary CTA, hairline rules).

## 4. The WebGL hero (`js/hero-gold.js`)
- Modern **three.js r0.160** (importmap, no build step). PBR gold (`metalness 1`, `roughness ~0.16`) lit primarily by a **RoomEnvironment PMREM** — that env reflection is what makes gold read as metal. One **UnrealBloom** pass = the sparkle. Drifting additive **gold-dust** points = light, not glitter.
- **Capability gate (mandatory on every hero):** full WebGL only when `webgl2 && width≥820 && !prefers-reduced-motion`. Otherwise a **2D gold-dust canvas fallback** loads instantly. This protects mobile load + SEO. Never ship a hero that can hang a phone.
- Scroll hands the hero **off** to content: the gold seal recedes/dims as the first chapter rises. The hero is the doorway, not a wall.

## 5. Motion vocabulary (one set of timings — `--ease-*`, `--t-*`)
- `--ease-ignite` for reveals, `--ease-silk` for settles, `--ease-glide` for travel/sweeps.
- Durations: `--t-fast .45s` (hover), `--t-med .9s` (reveal), `--t-slow 1.6s` (hero beats), `--t-cine 2.8s` (camera).
- **Reveal-on-scroll:** `.rise` + `.rise.d1…d4` stagger, toggled `.in` by GSAP ScrollTrigger. Smooth scroll via **Lenis**.
- **Always** honor `prefers-reduced-motion`: reveals snap in, sweeps stop, hero is static. (Built into the CSS + JS.)
- Hover language: cards lift 4px + gold border + a pointer-tracked radial glow (`.card-glow`). Buttons lift 2px.

## 6. Sotheby's brand compliance (non-negotiable)
- Use the **official assets only** (`brand/assets/logos/`): `wordmark-white.png` (nav/footer), the EST-1744 seal + SIR mark (foil-masked). **Never** redraw or distort the logo; the gold treatment only re-fills the existing shape.
- Footer must carry: *"Jameson Sotheby's International Realty. Each office is independently owned and operated. Equal Housing Opportunity."*
- "Est. 1744" is heritage signal — use it; it's a moat.

## 7. Zenlist co-brand (separate, embedded)
- Zenlist gets its **own identity inside the gold world**: the `.zen` scope swaps the accent to **indigo/royal**, uses the `.chip` pill, and is visually walled off in a `.zen-band`. It should read as "a powerful tool I bring you," distinct from Patrick's gold brand — never gold-on-gold confusion. One Zenlist zone per page max.

## 8. Data is brand
Every page should prove the site is **alive**: pull at least one live number from Supabase (publishable key, read-only) — the homepage hero pulse does this (hottest village, live median). Stale = off-brand. The map (`market-map.html`) is the flagship proof and should be reachable/embedded on key pages.

## 9. Page inheritance checklist (use when building any new v12 page)
- [ ] `brand/brand-v12.css` linked; tokens used (no hardcoded hex).
- [ ] Capability-gated hero OR a quieter foil header (not every page needs WebGL).
- [ ] One foil phrase per section; numerals in mono.
- [ ] `.rise` reveals + Lenis; reduced-motion honored.
- [ ] Live Supabase touchpoint.
- [ ] Sotheby's footer compliance; Zenlist (if present) walled in indigo.
- [ ] Mobile: hero falls back, grids collapse to 1 column, fonts clamp.

---

## 10. Deploy note
v12 lives in `06_Website & Backend/patrick.realestate.v12/` — a **separate folder** from the live v11 repo, so it is NOT auto-deployed yet. **Preview locally:** `cd` into the folder, run `python -m http.server 8000`, open `http://localhost:8000` (never `file://` — it breaks Supabase + ES modules). When approved, we point Cloudflare Pages at v12 (new repo or branch) and it becomes production.
