#!/usr/bin/env python3
"""
build-listing.py — generate a static property site per listing from the proven
1330 W. Whitmore design + data/listings.json.

Approach: the 1330 page is the canonical template. For each registry entry we
clone it and substitute the listing's data (title, OG, hero, specs, price,
gallery, asset slug). The gallery block is regenerated to fit any photo count.

Run:  python tools/build-listing.py <slug>        # one listing
      python tools/build-listing.py --all         # every entry with build:true
      python tools/build-listing.py --verify       # regenerate 1330 to a temp + diff

Reads/writes paths relative to the repo root (parent of this tools/ dir).
"""
import json, os, re, sys, difflib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE = os.path.join(ROOT, "listings", "1330-w-whitmore.html")
REGISTRY = os.path.join(ROOT, "data", "listings.json")
TPL_SLUG = "1330-w-whitmore"

# The exact 1330 literals the generator swaps. (Template markers.)
TPL = {
    "title":      "1330 W. Whitmore Court &middot; Lake Forest &middot; Milhaupt &middot; Jakaitis",
    "meta_desc":  "1330 W. Whitmore Court — a stately stone manor on a private cul-de-sac in Lake Forest, Illinois. Listed at $3,250,000 by Patrick Milhaupt of Jameson Sotheby's International Realty.",
    "og_title":   "1330 W. Whitmore Court · Lake Forest, IL · $3,250,000",
    "og_desc":    "A stately stone manor on a private cul-de-sac in Lake Forest — 5 bedrooms, 5.5 baths, 7,200 sq ft on 1.2 acres. Presented by Patrick Milhaupt, Jameson Sotheby's International Realty.",
    "og_url":     "https://patrick.realestate/listings/1330-w-whitmore.html",
    "og_image":   "https://patrick.realestate/listings/1330-w-whitmore/og.jpg",
    "headline":   "A stone manor on a <em>private</em><br>cul-de-sac.",
    "addr_line":  "1330 W. Whitmore Court &middot; Lake Forest, Illinois 60045",
    "bed_stat":   '<div class="hero-stat"><span class="lbl">Bedrooms</span><div class="val" data-count="5">—</div></div>',
    "bath_stat":  '<div class="hero-stat"><span class="lbl">Bathrooms</span><div class="val">5.5</div></div>',
    "sqft_stat":  '<div class="hero-stat"><span class="lbl">Square Feet</span><div class="val"><span data-count="7200">—</span></div></div>',
    "lot_stat":   '<div class="hero-stat"><span class="lbl">Lot</span><div class="val">1.2 ac</div></div>',
    "year_stat":  '<div class="hero-stat"><span class="lbl">Year Built</span><div class="val">2002</div></div>',
    "price":      "$3,250,000",
    "slug":       TPL_SLUG,
}

def money(n):
    return "$" + format(int(n), ",") if n else "Price upon request"

def baths(full, half):
    if full is None: return "—"
    return f"{full}.5" if half else f"{full}"

def gallery_block(slug, gallery):
    """Regenerate the .gallery inner to fit N photos (reuses g-1..g-N grid classes)."""
    if not gallery:
        return ""
    def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    items = []
    for i, g in enumerate(gallery, start=1):
        delay = f" delay-{min(((i-2)//2)+1,4)}" if i > 1 else ""
        src, cap = g["src"], esc(g.get("cap", ""))
        if i == 1:
            items.append(
                f'      <div class="g-item g-1 reveal" data-img="hero">\n'
                f'        <img src="{src}" onerror="this.src=\'../lf-market-assets/{slug}.jpg\'" alt="{cap}">\n'
                f'        <div class="g-cap">{cap}</div>\n      </div>')
        else:
            items.append(
                f'      <div class="g-item g-{i} reveal{delay}"><img src="{src}" loading="lazy" alt="{cap}">'
                f'<div class="g-cap">{cap}</div></div>')
    return "\n".join(items)

def render(entry, template):
    slug = entry["slug"]
    html = template
    addr = entry["address"]; city = entry["city"]; st = entry["state"]; zp = entry.get("zip", "")
    price_str = money(entry.get("price"))
    # --- head / OG ---
    title = entry.get("title", f"{addr} &middot; {city} &middot; Patrick Milhaupt")
    html = html.replace(TPL["title"], title)
    html = html.replace(TPL["meta_desc"], entry.get("meta_desc",
        f"{addr} — {entry.get('headline_plain','')} {city}, {st}. Presented by Patrick Milhaupt, Jameson Sotheby's International Realty."))
    html = html.replace(TPL["og_title"], f"{addr} · {city}, {st} · {price_str}")
    html = html.replace(TPL["og_desc"], entry.get("og_desc", entry.get("meta_desc", "")))
    html = html.replace(TPL["og_url"], f"https://patrick.realestate/listings/{slug}.html")
    html = html.replace(TPL["og_image"], f"https://patrick.realestate/listings/{slug}/og.jpg")
    # --- hero ---
    html = html.replace(TPL["headline"], entry.get("headline_html", entry.get("headline", "")))
    html = html.replace(TPL["addr_line"], entry.get("addr_line", f"{addr} &middot; {city}, {st} {zp}".strip()))
    # specs (rebuild each stat with target values, keeping markup)
    beds = entry.get("beds")
    html = html.replace(TPL["bed_stat"],
        f'<div class="hero-stat"><span class="lbl">Bedrooms</span><div class="val" data-count="{beds}">—</div></div>'
        if beds else TPL["bed_stat"].replace('data-count="5">—','—'))
    html = html.replace(TPL["bath_stat"],
        f'<div class="hero-stat"><span class="lbl">Bathrooms</span><div class="val">{baths(entry.get("baths_full"),entry.get("baths_half"))}</div></div>')
    sqft = entry.get("sqft")
    html = html.replace(TPL["sqft_stat"],
        f'<div class="hero-stat"><span class="lbl">Square Feet</span><div class="val"><span data-count="{int(sqft)}">—</span></div></div>'
        if sqft else TPL["sqft_stat"])
    lot = entry.get("lot_acres")
    html = html.replace(TPL["lot_stat"],
        f'<div class="hero-stat"><span class="lbl">Lot</span><div class="val">{(str(lot)+" ac") if lot else "—"}</div></div>')
    html = html.replace(TPL["year_stat"],
        f'<div class="hero-stat"><span class="lbl">Year Built</span><div class="val">{entry.get("year_built","—")}</div></div>')
    # --- price (all occurrences) ---
    html = html.replace(TPL["price"], price_str)
    # --- gallery: replace the inner of <div class="gallery"> ... </div> ---
    gb = gallery_block(slug, entry.get("gallery", []))
    if gb:
        html = re.sub(r'(<div class="gallery">)(.*?)(\n    </div>)',
                      lambda m: m.group(1) + "\n" + gb + m.group(3), html, count=1, flags=re.S)
    # --- asset slug paths (hero bg, gallery, og, video poster) ---
    html = html.replace(f"{TPL_SLUG}/", f"{slug}/")
    return html

def main():
    reg = json.load(open(REGISTRY, encoding="utf-8"))
    template = open(TEMPLATE, encoding="utf-8").read()
    args = sys.argv[1:]
    if args and args[0] == "--verify":
        e = next(l for l in reg["listings"] if l["slug"] == TPL_SLUG)
        out = render(e, template)
        diff = list(difflib.unified_diff(template.splitlines(), out.splitlines(), lineterm="", n=0))
        print(f"VERIFY 1330: {len(diff)} differing lines (0 = perfectly faithful template)")
        for d in diff[:40]: print(d)
        return
    targets = [l for l in reg["listings"] if (args and l["slug"] in args) or (not args and l.get("build"))]
    if not targets:
        print("No targets. Pass a slug, --all (entries with build:true), or --verify."); return
    for e in targets:
        if e["slug"] == TPL_SLUG:
            print(f"skip {e['slug']} (canonical template — edit directly)"); continue
        out = render(e, template)
        dst = os.path.join(ROOT, "listings", e["slug"] + ".html")
        open(dst, "w", encoding="utf-8").write(out)
        print(f"built listings/{e['slug']}.html  ({len(out)} bytes, {len(e.get('gallery',[]))} photos)")

if __name__ == "__main__":
    main()
