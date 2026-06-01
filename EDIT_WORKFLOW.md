# EDIT_WORKFLOW — How to make changes to the site

This is the rule book for editing the site. Following these conventions keeps the codebase clean, the deploys reversible, and Claude able to help you efficiently across sessions.

## The hybrid model

You said you want a hybrid workflow: **structural changes in the folder, visual experiments in Claude Design, then synced to the folder.** Here's exactly how that works.

```
              ┌─────────────────────────────────────┐
              │  CLAUDE DESIGN (artifacts canvas)   │
              │   - Visual experiments              │
              │   - Layout prototypes               │
              │   - One-off mockups                 │
              └──────────────┬──────────────────────┘
                             │ approve & sync
                             ▼
┌──────────────────────────────────────────────────────┐
│  patrick.realestate.v10/  (this folder)              │
│   - Canonical site                                   │
│   - All edits land here                              │
│   - Versioned (v10 → v10.1 → v10.2 …)                │
└──────────────┬───────────────────────────────────────┘
               │ drag-drop
               ▼
        ┌──────────────────┐
        │  Cloudflare Pages │
        │  patrick.realestate │
        └──────────────────┘
```

## When to use which

| Task | Where | Why |
|---|---|---|
| Change copy/text on a page | Folder, direct edit | Trivial, no need for visual iteration |
| Update Supabase fetch logic | Folder, direct edit | Code, not visual |
| Add live data to a page | Folder, direct edit | Code |
| Try a new hero animation | Claude Design first | Iterate visually, no risk |
| Redesign a card layout | Claude Design first | Iterate visually |
| Brand-color tweak (e.g., gold tone) | Folder — edit `css/tokens.css` | One-line change cascades site-wide |
| New page from scratch | Claude Design → folder | Mock first, then convert to file |
| Fix a typo in nav | Folder, direct edit | Trivial |
| New marketing one-pager (e.g., listing report) | Either, but keep separate from v10 | Not part of the site |

## Versioning rules — when to bump v10 → v10.x vs v11

These rules keep the version number meaningful and the rollback path clear.

| Change type | Bump | Example |
|---|---|---|
| Typo, content tweak, single-page copy edit | none — edit in place | "fix typo on about page" |
| Bug fix, broken link, color adjustment | `v10` → `v10.1` (rename folder) | "fix broken link in footer" |
| New feature on existing page (live data added, new section) | `v10.x` → `v10.(x+1)` | "wire daily_snapshots into lake-forest page" |
| New page added, nav changed | `v10.x` → `v10.(x+1)` | "add private-listings.html back" |
| Major redesign, design-system overhaul, new architecture | `v10` → `v11` (new folder) | "switch to logo-intro hero", "move to React" |

**Rule of thumb**: if you can describe the change in one bullet on a deploy note, it's a `.x` bump. If it needs a paragraph or breaks something old, it's a major version.

**Always**: update `CHANGELOG.md` in the same edit.

## How to bump versions

### Minor bump (v10 → v10.1)

```powershell
# Open the Website Design folder in File Explorer
# Right-click "patrick.realestate.v10" → Rename → "patrick.realestate.v10.1"
```

Or in PowerShell:
```powershell
cd "C:\Users\PMilh\OneDrive\Documents\Claude\Projects\Website Design"
Rename-Item "patrick.realestate.v10" "patrick.realestate.v10.1"
```

Edit `CHANGELOG.md`, deploy, done.

### Major bump (v10 → v11)

Don't rename — copy. The old version stays as a fallback.

```powershell
cd "C:\Users\PMilh\OneDrive\Documents\Claude\Projects\Website Design"
Copy-Item -Recurse "patrick.realestate.v10.x" "patrick.realestate.v11"
# Move old to archive
Move-Item "patrick.realestate.v10.x" "_archive\patrick.realestate.v10.x"
```

Then make the major changes inside `patrick.realestate.v11/`.

## How Claude should help

When you ask Claude to make a change to the site, the conversation should follow this shape:

1. **You**: describe the change ("add a 30-day price trend chart to the lake-forest page")
2. **Claude**: confirms what version it's editing (always the highest v10.x or v11), reads the current file, plans the change
3. **Claude**: makes the edit, updates `CHANGELOG.md`, tells you what to deploy
4. **You**: drag the folder to Cloudflare → verify

Tell Claude: *"Always edit `patrick.realestate.v10` (or whatever the current version is). Don't edit the parent Website Design folder for site changes — only for marketing materials and dev artifacts."*

## Specific recipes

### Adding live data to a page

The intelligence page is the model — it loads data on DOM ready and updates KPI elements with live values. To add live data to, say, `neighborhoods/lake-forest.html`:

1. Add data placeholder elements to the HTML, each with a unique ID:
   ```html
   <div class="kpi-row">
     <div class="kpi"><span class="kpi-num" id="lf-median">—</span><span class="kpi-lbl">Median Price</span></div>
     <div class="kpi"><span class="kpi-num" id="lf-dom">—</span><span class="kpi-lbl">Avg Days</span></div>
     <div class="kpi"><span class="kpi-num" id="lf-supply">—</span><span class="kpi-lbl">Months Supply</span></div>
   </div>
   ```

2. Add this script just before `</body>`:
   ```html
   <script>
   (async function () {
     const URL='https://itupjrknklzvmmqicuyc.supabase.co';
     const KEY='eyJhbGciOiJIUzI1NiI...'; // anon key from intelligence.html
     const village = 'Lake Forest'; // change per page
     const r = await fetch(URL+'/rest/v1/daily_snapshots?village=eq.'+encodeURIComponent(village)+'&order=snapshot_date.desc&limit=1',
       { headers: { apikey: KEY, Authorization: 'Bearer '+KEY }});
     const [s] = await r.json();
     if (!s) return;
     const fmt = n => n ? '$'+(n/1000).toFixed(0)+'k' : '—';
     document.getElementById('lf-median').textContent = fmt(s.trailing30_median_price);
     document.getElementById('lf-dom').textContent = s.trailing30_median_dom || '—';
     document.getElementById('lf-supply').textContent = (s.months_supply || 0).toFixed(1);
   })();
   </script>
   ```

3. Bump version (v10 → v10.1), update CHANGELOG, deploy.

### Changing site colors globally

1. Open `css/tokens.css`
2. Edit the value (e.g., `--gold: #c9a96e;` → `#d4b87a;`)
3. Save. Every page using the shared design system updates automatically.
4. Bump v10 → v10.1, deploy.

### Adding a new page

1. Use `about.html` as the template — it's already on the shared design system
2. Save as new file (e.g., `services.html`) in the v10 folder
3. Add it to the nav in EVERY page (search-replace approach):
   - Open Claude → "add a 'Services' link to the nav of every page in patrick.realestate.v10, between About and Contact"
4. Add it to `sitemap.xml`
5. Bump v10 → v10.1, deploy.

## What NOT to do

- ❌ Don't edit individual pages with hardcoded hex colors — always use tokens
- ❌ Don't add jQuery, React, Vue, or any framework — vanilla JS only
- ❌ Don't deploy from `Website Design/` directly — that folder has marketing materials, dev tools, and experiments mixed in. Always deploy from `patrick.realestate.v10` (or current version)
- ❌ Don't deploy `backend.html`, `data-uploader.html`, `daily-snapshot-tool.html` publicly — they're admin tools
- ❌ Don't put Supabase service-role keys in any file — only the anon key (it's safe to publish)
- ❌ Don't break the `</body>` and `</html>` closing tags when editing — some browsers are forgiving but Cloudflare's HTML minifier sometimes isn't
- ❌ Don't remove the HubSpot pixel script — it's how you track visitors

## Connecting Claude Design to this folder

Claude Design (artifacts) lives in the chat. To sync a Claude Design artifact into v10:

1. Build/iterate the artifact in Claude Design until you like it
2. Tell Claude: *"Take the artifact above and integrate it into `patrick.realestate.v10/about.html` replacing the existing `about-engine` section"*
3. Claude reads the current file, surgically replaces the section, preserves everything else
4. You verify, bump version, deploy

For new pages: *"Take the artifact above and save it as `patrick.realestate.v10/services.html`, using the about.html nav and footer."*

## Marketing content kept separate

The parent `Website Design/` folder contains marketing one-pagers (999 Lake Road BOV, Newhouse listing plan, Lake Forest SEO audit, etc.). These are NOT part of the website — they're standalone client deliverables. Keep them out of `patrick.realestate.v10/`.

If you ever want one of those one-pagers to live on the public site, copy it into v10/, add a nav link, bump version, deploy.
