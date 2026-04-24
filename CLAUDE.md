# IVAE Studios — Cloud-Native Site

Static site for [ivaestudios.com](https://ivaestudios.com) — luxury destination
photography in Cancún / Riviera Maya / Los Cabos. Bilingual (EN / ES).

## Hosting

- **Cloudflare Pages** auto-deploys on every push to `main`.
- Cloudflare reads `_redirects` and `_headers` at the repo root.
- `netlify.toml` is a historical artifact — **Cloudflare ignores it**, so do
  not put redirects or headers there.

## Repo layout

```
/                     → root HTML pages (index, about, blog, 404, etc.)
/es/                  → Spanish mirror
/blog/ (via redirect) → post-*.html at the repo root are rewritten to /blog/<slug>
/images/              → assets
/js/                  → small client scripts (lang-switcher, analytics, etc.)
/styles/              → shared CSS
/scripts/             → Python automation (runs in GitHub Actions, not in the browser)
/.github/workflows/   → CI
_redirects            → Cloudflare redirect/rewrite rules
_headers              → Cloudflare response headers (incl. CSP + HSTS)
sitemap.xml, robots.txt, llms.txt
```

## Cloud-only workflow — the rules

1. **All work happens from git.** No local-machine dependency. Editing in
   GitHub.dev, Codespaces, or any Claude session with repo access is fine.
2. **Never commit secrets.** Anything in `.gitignore` is kept out of the repo
   on purpose. Secrets live in GitHub → Settings → Secrets and variables →
   Actions.
3. **Push to `main` = live in ~1 minute.** Cloudflare auto-deploys. The
   `SEO — Index URLs` workflow fires the same push and asks Google to recrawl
   the changed pages.

## GitHub Secrets required

| Secret | Required | What it's for |
|---|---|---|
| `GOOGLE_INDEXING_SA_JSON` | ✅ | Full JSON content of the Search Console service-account key. Used by `scripts/index_urls.py` to call the Google Indexing API. |

Optional (plumbing exists, not wired yet): `BING_WEBMASTER_KEY`, `INDEXNOW_KEY`.

## Workflows

- **`SEO — Index URLs`** (`.github/workflows/index-urls.yml`)
  - Auto-fires on push to `main` when any `*.html`, `sitemap.xml`, or
    `_redirects` changes.
  - Manual run: Actions → *SEO — Index URLs* → *Run workflow* — optionally paste
    a space-separated list of URLs, or leave blank for the default 21-URL set.

- **`SEO — Link Audit`** (`.github/workflows/link-audit.yml`)
  - Runs on every PR that touches HTML or `_redirects` (fails CI if any broken
    internal link is introduced).
  - Weekly schedule + manual trigger for report-only runs.

## Open follow-ups (handoff notes)

### Tier 0 — needs real data from the owner (Vianey)
- Phone: `+52 990 204 6514` uses an impossible Mexican area code (990). Replace
  with the real GBP phone.
- Coordinates: schema currently uses Cancún (21.1619, -86.8515) but the GBP pin
  may be in Riviera Maya (20.4785722, -87.0756298). Pick one canonical address.
- `AggregateRating` is normalized to 5.0 / 42 reviews across the site — verify
  against the live GBP and update in a single pass.
- Session rates in FAQ schema ($650–$3,500+) are placeholders.
- No street address in Organization schema yet.

### Tier 2/3 — content
- Replace the three placeholder testimonials in `index.html` + `es/index.html`
  (Samantha Whitfield, Marco Benedetti, Priya Raghavan) with real reviews.
- Pricing blocks on `cancun.html` + `riviera-maya.html`.
- `/vianey-diaz/` bio page for E-E-A-T.
- `Product` + `Offer` schema with `priceValidUntil`.
- Landing pages: `/cancun-wedding-photographer-cost-2026` + 6 keyword-first
  pages + 8–10 venue-specific pages.

## Useful commands

```bash
# Run the link audit locally (no credentials needed):
python scripts/audit_links.py --fail-on-broken

# Submit a custom URL list to Google from your machine
# (only works if GOOGLE_INDEXING_SA_JSON or GOOGLE_INDEXING_SA_FILE is set):
python scripts/index_urls.py https://ivaestudios.com/ https://ivaestudios.com/es/
```
