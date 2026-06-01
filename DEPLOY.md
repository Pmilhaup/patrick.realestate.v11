# DEPLOY — Cloudflare drag-and-drop

This folder is shaped so you can drop it directly into Cloudflare Pages without any setup. No Git, no build step, no Wrangler.

## First-time deploy (only if there's no Cloudflare Pages project yet)

1. Sign in at https://dash.cloudflare.com
2. Sidebar → **Workers & Pages** → **Create application** → **Pages** tab → **Upload assets**
3. Project name: `patrick-realestate` (must be lowercase, no dots)
4. Drag the `patrick.realestate.v10/` folder onto the upload area
5. Click **Deploy site**
6. After first deploy, go to **Custom domains** and add:
   - `patrick.realestate` (apex)
   - `www.patrick.realestate` → set up redirect to apex
7. **Settings → Functions → Compatibility flags**: leave default
8. **Settings → Build & deployments → Production branch**: leave blank (direct upload mode)

## Subsequent deploys (the normal flow)

1. Open the existing project in Cloudflare → Pages → patrick-realestate
2. Click **Create deployment** → **Direct upload**
3. Drag the `patrick.realestate.v10/` folder onto the drop zone
4. Cloudflare scans, uploads, and promotes to production
5. **Verify**: visit `https://patrick.realestate` and hard-refresh (Ctrl+Shift+R / Cmd+Shift+R) to bypass browser cache

Cloudflare keeps the previous deployment for instant rollback. If something breaks: **Deployments → previous version → Rollback to this deployment**.

## What gets uploaded

Everything in this folder EXCEPT the markdown documentation. Cloudflare Pages serves whatever file structure you upload, so:

- `index.html` → served at `/`
- `intelligence.html` → served at `/intelligence` (Cloudflare auto-strips `.html`)
- `neighborhoods/lake-forest.html` → served at `/neighborhoods/lake-forest`
- `css/tokens.css` → served at `/css/tokens.css`

The `.md` documentation files (README, DEPLOY, EDIT_WORKFLOW, CHANGELOG) get uploaded too, but Cloudflare won't serve them as HTML — they're harmless. If you want them excluded, you can delete them before zipping (or keep them; total size is trivial).

## Recommended Cloudflare settings (one-time)

In the Cloudflare dashboard for `patrick.realestate`:

1. **SSL/TLS → Overview**: Full (strict)
2. **SSL/TLS → Edge Certificates**: Always Use HTTPS = ON, Automatic HTTPS Rewrites = ON
3. **Speed → Optimization**: Auto Minify HTML/CSS/JS = ON, Brotli = ON, Early Hints = ON
4. **Security → Bots**: Bot Fight Mode = ON
5. **Caching → Configuration**: Browser Cache TTL = 4 hours
6. **Analytics & Logs → Web Analytics**: enabled (already wired in deployed pages)
7. **Custom Domains**: apex + www redirect

## Verifying the deploy worked

After every deploy, sanity-check these in a browser:

| URL | What to confirm |
|---|---|
| `https://patrick.realestate/` | Hero loads, name animates, ZenList comparison bars animate when scrolling |
| `https://patrick.realestate/intelligence` | Charts render, KPIs show real numbers (not "—"), no console errors |
| `https://patrick.realestate/neighborhoods/lake-forest` | Page renders with shared nav |
| `https://patrick.realestate/css/tokens.css` | Returns CSS (HTTP 200) |

If intelligence page shows "—" everywhere, Supabase fetch is failing — check the URL/key in `intelligence.html` and verify the anon key is still valid in Supabase dashboard.

## Rolling back

If a deploy breaks something:

1. Cloudflare → Pages → patrick-realestate → Deployments
2. Find the previous good deployment
3. Click the `…` menu → **Rollback to this deployment**
4. Confirm. Live in ~30 seconds.

## Cache busting

If a CSS or JS change isn't showing up after deploy:

1. Cloudflare → Caching → Configuration → **Purge everything** (apex domain)
2. Hard-refresh in browser

## Optional: ZIP upload instead of folder

If your browser doesn't support folder drag-and-drop:

```
cd "C:\Users\PMilh\OneDrive\Documents\Claude\Projects\Website Design"
Compress-Archive -Path "patrick.realestate.v10\*" -DestinationPath "patrick.realestate.v10.zip"
```

Then drag the `.zip` onto the Cloudflare upload area.
