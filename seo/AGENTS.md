# IVAE Studios — Enterprise SEO Agent System

> **For any Claude session continuing this work:** this file documents the
> complete autonomous SEO agent system built 2026-05-06/07. Read this end-to-end
> before making changes. The user is Vianey Díaz, owner of IVAE Studios.

---

## TL;DR

11 autonomous agents run every Monday at 9:08 AM local time via a Claude
scheduled task. They pull real query data from Google Search Console, rotate
page titles in marker-delimited regions, validate schema/hreflang/sitemap,
audit performance, scout competitor SERP positions, hunt backlink
opportunities, and test whether AI assistants recommend IVAE Studios.

Cost: $0/month. Owner involvement: zero (system is fully autonomous).

---

## Quick context for a new Claude session

**Repo:** `/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/`
**Remote:** `github.com/ivaestudios/ivaestudios-website` (main branch)
**Hosting:** Cloudflare Pages (auto-deploys on push to main)
**Owner:** Vianey Díaz, `vianeydm07@gmail.com` (Google), Microsoft account (Bing)
**Wikidata:** `Q139689577` (IVAE Studios) + `Q139689736` (Vianey Díaz)
**Site age:** ~3 months in production (May 2026)
**Current GSC traffic:** ~42 clicks total, 91 distinct queries with impressions

**CRITICAL ACCOUNT NOTE:**
The user has multiple Google accounts in Chrome. Only ONE is correct for IVAE:
- `vianeydm07@gmail.com` (Vianey, **CORRECT** — owns ivaestudios.com everywhere)
- Other accounts at `authuser=0` and `authuser=2` belong to unrelated projects
  and must NEVER be used for IVAE work

When navigating Google services in browser, ALWAYS confirm `authuser=1` (Vianey)
before any action. Earlier in this project a Cloud Console flow accidentally
created a project under the wrong account because Chrome session-cookied through.
That project was deleted; the wrong-account project space is now clean.

---

## The 11 agents (full inventory)

### Agents that improve the site

| # | Script | What it does | Output |
|---|---|---|---|
| 1 | `scripts/keyword_refresh.py --source gsc` | Pulls last-30-day GSC top queries, scores by impressions × position-improvement-potential, filters by seo/keyword-seed.json | `seo/data/latest.json` (top 30 keywords) |
| 2 | `scripts/apply_keywords.py` | Reads latest.json and rotates `<!-- KW:title:start -->...<!-- KW:title:end -->` markers in 6 high-priority pages. **City-aware:** skips pages that don't have a matching-city keyword | Edits to index/cancun/rm/cabos/luxury-weddings titles |
| 3 | `scripts/internal_link_optimizer.py` | Builds Jaccard similarity graph of all pages and suggests new internal links between semantically related pages that don't already link | `seo/reports/internal-links-YYYY-WW.md` |

### Agents that protect the site

| # | Script | What it does | Output |
|---|---|---|---|
| 4 | `scripts/validate_schema.py --report-only` | Walks every JSON-LD `<script>` block, validates @context, @id resolution, required fields per @type, URL well-formedness, Wikidata Q-ID format | `seo/reports/schema-YYYY-WW.md` |
| 5 | `scripts/validate_hreflang.py --report-only` | Verifies en/es page pairs are reciprocally linked, html lang matches path-implied lang, x-default present, no conflicting URLs per language | `seo/reports/hreflang-YYYY-WW.md` |
| 6 | `scripts/update_sitemap.py` | Walks all HTMLs, computes priority + lastmod, pairs en/es URLs for hreflang, regenerates sitemap.xml only if content would change | `sitemap.xml` (idempotent) |
| 7 | `scripts/audit_seo.py` | Reports title/desc length, missing H1s, H1-keyword mismatch, missing OG/twitter tags | stdout |
| 8 | `scripts/audit_links.py` | Detects broken internal links, missing anchor targets | stdout (`/tmp/link-audit.log` in sweep) |

### Agents that measure the site

| # | Script | What it does | Output |
|---|---|---|---|
| 9 | `scripts/seo_report.py` | GSC top 50 queries with W-over-W deltas, opens GitHub Issue if any query drops >10 positions | `seo/reports/YYYY-WW.md` |
| 10 | `scripts/analyze_404s.py` | Reads GSC pages, cross-references local file tree + _redirects, identifies "ghost URLs" (have impressions but no live page or existing redirect), suggests new redirect targets via fuzzy match | `seo/reports/404-analysis-YYYY-WW.md` |
| 11 | `scripts/page_speed_monitor.py --strategy both` | PageSpeed Insights API on 5 key pages × mobile+desktop. Tracks LCP/INP/CLS/FCP/TBT, alerts on threshold breaches | `seo/reports/page-speed-YYYY-WW.md` + `seo/data/page-speed-trend.json` |

### Browser-based agents (run on Monday only — need real Chrome session)

These three live in the scheduled task prompt at
`~/.claude/scheduled-tasks/ivae-weekly-seo-sweep/SKILL.md`. They use my browser
tools (Chrome extension MCP) to query Google SERP, news publications, and AI
assistants from Vianey's logged-in Chrome session — avoiding bot detection
that would break scriptless scrapers.

| # | What it does | Output |
|---|---|---|
| SERP Scout | Searches 10 priority keywords on google.com.mx, captures top 20 results, extracts position of IVAE + 3 competitors | `seo/data/serp-snapshot-latest.json` → `serp_scout_report.py` → `seo/reports/serp-scout-YYYY-WW.md` |
| Mention Hunter | site: queries on 8 publications looking for competitor mentions; flags articles where competitor is mentioned but IVAE is not | `seo/data/mention-snapshot-latest.json` → `mention_hunter_report.py` → `seo/reports/backlinks-opportunities-YYYY-WW.md` |
| AI Recommendation Tester | Asks 4 control queries to ChatGPT/Claude/Perplexity/Gemini via web UI; parses response for IVAE Studios mentions and position | `seo/data/ai-mentions-snapshot-latest.json` → `ai_recommendation_report.py` → `seo/reports/ai-mentions-YYYY-WW.md` |

---

## Where to run / how to test

### Manual full sweep (any time)
```bash
cd "/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted"
source ~/.ivae-credentials

python3 scripts/keyword_refresh.py --source gsc
python3 scripts/apply_keywords.py
python3 scripts/validate_schema.py --report-only
python3 scripts/validate_hreflang.py --report-only
python3 scripts/update_sitemap.py
python3 scripts/audit_seo.py
python3 scripts/audit_links.py
python3 scripts/seo_report.py
python3 scripts/internal_link_optimizer.py
python3 scripts/analyze_404s.py
python3 scripts/page_speed_monitor.py --strategy both

git add -A
git commit -m "chore(seo): manual sweep $(date +%Y-W%V)"
git push "https://${GITHUB_TOKEN}@github.com/ivaestudios/ivaestudios-website.git" main
```

### Trigger the autonomous Monday cron immediately
The scheduled task is at `~/.claude/scheduled-tasks/ivae-weekly-seo-sweep/`.
In Claude Code, click "Run now" in the Scheduled section of the sidebar to
fire it manually. Otherwise it runs every Monday 9:08 AM local time
(cron `7 9 * * 1`).

### Test a single agent
Pass `--help` to any script to see flags.
- All validators support `--report-only` (always exits 0, writes md report)
- Page Speed supports `--strategy mobile|desktop|both` and `--pages <urls>`
- Keyword refresh supports `--source gsc|pytrends` (gsc is default)
- All agents support `--dry-run` (no network, no file writes)

---

## Credentials & secrets

### Local (on Vianey's Mac)
`~/.ivae-credentials` (chmod 600, gitignored, **DO NOT COMMIT**):
```
GITHUB_TOKEN=<PAT for ivaestudios org with repo + workflow scopes>
GITHUB_USER=ivaestudios
CLOUDFLARE_API_TOKEN=<for cache purges>
BING_INDEXNOW_KEY=9b2604886a0b6101495efe98adc54d943af80b18bbc852b25998a68a3df0668c
GOOGLE_INDEXING_SA_FILE=/Users/ivae/.ivae-credentials.d/google-sa.json
GOOGLE_INDEXING_SA_JSON=$(cat /Users/ivae/.ivae-credentials.d/google-sa.json)
PAGESPEED_API_KEY=<PSI API key restricted to PageSpeed Insights API>
```

`~/.ivae-credentials.d/google-sa.json` (chmod 600, separate file):
- Service account JSON for `ivaestudios-seo-bot@ivaestudios-seo.iam.gserviceaccount.com`
- Project: `ivaestudios-seo` (under vianeydm07@gmail.com)
- Has Owner permission on Search Console for `sc-domain:ivaestudios.com`
- Used by: `index_urls.py`, `keyword_refresh.py`, `seo_report.py`, `analyze_404s.py`

### GitHub Secrets (already set)
- `BING_INDEXNOW_KEY` — for `seo-indexnow.yml` workflow
- `CLOUDFLARE_TOKEN` — for `cf-purge.yml`
- `GOOGLE_INDEXING_SA_JSON` — same SA as local but stored as secret
- `INDEXNOW_KEY` — legacy, can ignore (vestigial from earlier setup)
- `IVAE_CRON_BEARER` — for gallery cron, unrelated to SEO

### Local PATH additions in `~/.zshrc`
```
export CLOUDSDK_PYTHON=/usr/bin/python3
[ -f '/Users/ivae/google-cloud-sdk/path.zsh.inc' ] && . '/Users/ivae/google-cloud-sdk/path.zsh.inc'
```

`gcloud` is installed but **not authenticated** (no credentialed accounts in `gcloud auth list`). The SA JSON is used directly via `GOOGLE_INDEXING_SA_FILE` env var, no gcloud needed.

---

## Repo layout (SEO-relevant only)

```
ivae-6-extracted/
├── _redirects                # Cloudflare Pages redirects (preserve, manual edits)
├── _headers                  # Cloudflare headers (preserve)
├── sitemap.xml               # Auto-regenerated by update_sitemap.py
├── llms.txt + llms-full.txt  # AI discovery files
├── humans.txt + ai.txt       # Authority signal files
├── api/facts.json            # Machine-readable facts (Wikidata Q-IDs, etc)
├── brand.html + es/marca.html # Canonical brand entity pages
├── index.html + es/index.html # Homepages with KW:title markers
├── cancun.html, riviera-maya.html, los-cabos.html, luxury-weddings.html
│   # Pillar pages, all with KW:title markers
├── couples-photography.html, luxury-family-photos.html
├── venues/{slug}/index.html  # 6 venue landing pages (en)
├── es/locaciones/{slug}/     # 6 venue landing pages (es)
├── comparison/luxury-photographers-cancun.html (+ es/comparativa/)
├── seo/
│   ├── AGENTS.md             # ← This file
│   ├── keyword-seed.json     # 24 root terms × 4 categories + filters
│   ├── data/
│   │   ├── latest.json                    # Last keyword refresh output
│   │   ├── trending-YYYY-MM-DD.json       # Timestamped snapshots
│   │   ├── page-speed-trend.json          # Append-only Lighthouse history
│   │   ├── serp-snapshot-latest.json      # Browser-captured SERP data
│   │   ├── mention-snapshot-latest.json   # Browser-captured publication crawls
│   │   ├── ai-mentions-snapshot-latest.json # Browser-captured AI responses
│   │   └── ai-mentions-trend.json         # Week-over-week AI mention rate
│   ├── reports/                           # All weekly markdown outputs
│   ├── playbooks/
│   │   ├── wikidata-seed.md               # Done, item lives at Q139689577
│   │   ├── rollback.md                    # Git revert procedure
│   │   ├── pr-assets.md                   # PR pitch ideas (manual outreach)
│   │   └── gbp-checklist.md               # Weekly GBP routine (manual)
│   └── backlinks/                         # Future: backlink tracking
├── scripts/
│   ├── keyword_refresh.py
│   ├── apply_keywords.py
│   ├── validate_schema.py
│   ├── validate_hreflang.py
│   ├── update_sitemap.py
│   ├── audit_seo.py
│   ├── audit_links.py
│   ├── seo_report.py
│   ├── internal_link_optimizer.py
│   ├── analyze_404s.py
│   ├── page_speed_monitor.py
│   ├── serp_scout_report.py        # Parser for browser snapshots
│   ├── mention_hunter_report.py    # Parser for browser snapshots
│   ├── ai_recommendation_report.py # Parser for browser snapshots
│   ├── index_urls.py               # Google Indexing API (legacy, on-push trigger)
│   └── indexnow_submit.py          # Bing IndexNow (on-push trigger)
└── .github/workflows/
    ├── index-urls.yml              # On every push to main
    ├── seo-indexnow.yml            # On every push to main
    ├── link-audit.yml              # On every PR + weekly schedule
    ├── cf-purge.yml                # Cache purge after deploys
    └── gallery-cron-sweep.yml      # Unrelated to SEO
```

---

## Marker contract (CRITICAL — never break)

The keyword refresh agent is **safety-bounded** by markers. It only edits between:

```html
<title><!-- KW:title:start -->Anything here can be rotated<!-- KW:title:end --> | IVAE Studios</title>
```

Hand-curated copy must NEVER be wrapped in markers. Once a marker is set,
the agent owns that region. The brand suffix " | IVAE Studios" is OUTSIDE
the markers and never gets touched.

**Pages currently with KW:title markers:**
- `index.html` + `es/index.html`
- `cancun.html`, `riviera-maya.html`, `los-cabos.html`
- `luxury-weddings.html`

To enable rotation on a new page:
1. Wrap a portion of the title in markers
2. Add the page to `PAGE_CATEGORY` in `apply_keywords.py`
3. Add city-token mapping to `pick_keyword()` if location-specific

---

## Wikidata items (created 2026-05-06)

### Q139689577 — IVAE Studios (organization)
URL: https://www.wikidata.org/wiki/Q139689577
Statements:
- P31 (instance of): photographic studio (Q3257138)
- P17 (country): Mexico (Q96)
- P159 (HQ location): Cancún (Q8806)
- P407 (language of work or name): English + Spanish
- P571 (inception): 2023
- P856 (official website): https://ivaestudios.com

### Q139689736 — Vianey Díaz (person)
URL: https://www.wikidata.org/wiki/Q139689736
Statements:
- P31 (instance of): human (Q5)
- P21 (sex/gender): female (Q6581072)
- P27 (country of citizenship): Mexico (Q96)
- P106 (occupation): photographer (Q33231)
- P108 (employer): IVAE Studios (Q139689577)
- P1412 (languages): Spanish + English

**Pending (rate-limit blocked):** P112 founded by + P169 CEO on Q139689577
pointing at Q139689736. The autonomous sweep retries this every Monday;
will succeed eventually as the anonymous-edit rate limit resets.

Wikidata Q-IDs are linked from schema in:
- `index.html`, `es/index.html`
- `brand.html`, `es/marca.html`
- `api/facts.json`
- `humans.txt`, `llms.txt`

---

## Schema architecture (consolidated)

The site uses Schema.org JSON-LD `@graph` arrays where all entities reference
each other by `@id`:
- `https://ivaestudios.com/#organization` — Organization + LocalBusiness + ProfessionalService
- `https://ivaestudios.com/#brand` — Brand entity with disambiguation properties
- `https://ivaestudios.com/#vianey-diaz` — Person (founder)
- `https://ivaestudios.com/#term-ivae-studios` — DefinedTerm for AI assistants
- `https://ivaestudios.com/#website` — WebSite

**E-E-A-T signals embedded:**
- `Organization.foundingDate: "2023"` + `foundingLocation: Cancún, Mexico`
- `Person.description` mentions "10+ years professional experience"
- `Person.hasOccupation` with `yearsOfExperience: 10` + skills array
- `Person.knowsLanguage` + `nationality`

**Disambiguation from ivaestudio.com (the unrelated European agency):**
- `Brand.additionalProperty[notIdenticalTo]: "ivaestudio.com (singular, unrelated European agency)"`
- `Brand.additionalProperty[spelling]: "IVAE Studios (with S, plural)"`
- `Brand.additionalProperty[wikidata_id]: "Q139689577"`
- `DefinedTerm.description` includes the disambiguation paragraph
- `Organization.disambiguatingDescription` field

---

## What was already broken when we started (now fixed)

1. ✅ pytrends rate-limited by Google → swapped to GSC API as primary source
2. ✅ Index URLs workflow failed on 429 quota days → fixed to soft-pass on quota exhaustion
3. ✅ luxury-weddings hero image was 10.79 MB → mobile LCP was 146 seconds → swapped to local optimized image (372 KB)
4. ✅ `/destination-wedding-cancun` returned 404 (22 imp/mo lost) → 301 redirect added
5. ✅ Sitemap was missing 16 URLs (venue + comparison pages) → auto-updater fixed
6. ✅ ivaestudios.com not in Bing Webmaster Tools → added + verified
7. ✅ No Wikidata items → both created with full statements
8. ✅ Schema not consolidated → @graph pattern across all key pages
9. ✅ No AI discovery files → llms.txt, ai.txt, humans.txt all live

---

## Known issues / pending

### Currently active in reports (not broken, just informational)
- Schema Validator: 225 findings, mostly stub patterns (WebPage speakable nodes
  without url, Brand inline references, nested LocalBusiness in author.worksFor).
  Validator is too strict on these patterns; consider relaxing for stub nodes.
- Hreflang Validator: 170 findings, mostly URL targets that exist via _redirects
  rewrites the validator doesn't know about. Should teach validator the rewrite
  table.

### Pending fixes (not yet done)
- `/brand` CLS 0.262 mobile, 0.309 desktop (font-loading FOUT)
  → fix: preload Cormorant Garamond, set size-adjust on fallback
- Most pages have LCP 2.87–4.14s (above 2.5s target)
  → fix: PR 6 Core Web Vitals (AVIF/WebP conversion, hero preload links)
- `/privacy-policy` and `/accessibility-statement` 404 (no content)
  → either create stubs or accept (low impressions)
- Schema validator should know about `_redirects` rewrite table

### Manual owner tasks (out of scope for agents)
- Weekly Google Business Profile checklist (`seo/playbooks/gbp-checklist.md`)
- Outreach using `seo/reports/backlinks-opportunities-YYYY-WW.md`
- Content writing (blog posts, new venue pages)
- PR pitches per `seo/playbooks/pr-assets.md`

---

## Costs

**$0/month recurring.**

- Google Search Console API: free
- Google Indexing API: free (200/day quota)
- PageSpeed Insights API: free (25,000/day with API key)
- Bing IndexNow: free (10,000/day)
- GitHub Actions: free (public repo or under free tier)
- Cloudflare Pages: free
- Wikidata: free
- Claude scheduled tasks: covered by user's Claude subscription

The infrastructure could absorb 10× the current traffic without any cost change.

---

## When to escalate to the owner

The autonomous sweep is **silent on success**. It only escalates if:
- GSC API auth completely broken (cred rotation needed)
- git push rejected (token expired or force-overwrite required)
- Critical regression: any tracked query drops >10 positions
- Schema validator finds new ERROR-level issues (not the 225 known ones)
- Page speed degrades: LCP > 5s on homepage or pillar pages
- 404 analyzer finds a new ghost URL with >50 impressions/month

If you're a fresh Claude session and you see anything in `seo/reports/sweep-error-*.md`, that's the escalation channel.

---

## How to extend

### Add a new agent
1. Write `scripts/your_agent.py` (stdlib + google-api-python-client only)
2. Output to `seo/reports/your-agent-YYYY-WW.md` (markdown)
3. Add a step to the scheduled task at `~/.claude/scheduled-tasks/ivae-weekly-seo-sweep/SKILL.md`
4. Test locally first: `python3 scripts/your_agent.py`
5. Commit + push

### Add a new tracked keyword
Edit `seo/keyword-seed.json` and add to the relevant category. The next
sweep will pick it up automatically.

### Add a new page to keyword rotation
1. Add `<!-- KW:title:start -->...<!-- KW:title:end -->` markers to the title
2. Add to `PAGE_CATEGORY` in `apply_keywords.py`
3. Add city-token mapping to `pick_keyword()` if location-specific

### Add a new tracked competitor for SERP Scout
Edit `TRACKED_DOMAINS` in `scripts/serp_scout_report.py`.

---

## How to disable / pause

### Pause the entire weekly sweep
```bash
# Through Claude Code UI: Scheduled section → ivae-weekly-seo-sweep → Disable
# Or programmatically (in a Claude session with scheduled-tasks tool):
mcp__scheduled-tasks__update_scheduled_task(taskId="ivae-weekly-seo-sweep", enabled=false)
```

### Disable specific agents
Comment out the relevant `python3 scripts/X.py` line in
`~/.claude/scheduled-tasks/ivae-weekly-seo-sweep/SKILL.md`.

### Roll back a bad keyword rotation
The agent commits each rotation as one git commit. To roll back:
```bash
git log --oneline | grep "weekly enterprise sweep"
git revert <sha>
git push
```
Cloudflare redeploys in ~1 minute.

---

## Last sweep status (2026-05-07)

Successful manual test run from a Claude session:
- 11 pure-code agents executed cleanly
- 91 GSC queries pulled, 30 written to latest.json
- 4 page titles rotated (index, es/index, cancun, luxury-weddings)
- 2 critical bugs fixed mid-session: luxury-weddings LCP 146s → 8.5s, /destination-wedding-cancun 404 → redirect
- Phase 2 (browser-based: SERP Scout, Mention Hunter, AI Recommendation Tester) skipped — runs Monday automatically with full quota

Next autonomous run: **Monday 2026-05-11 at 9:08 AM local**.

---

## Contact (last user-confirmed details)

- Phone: +52 990 204 6514 (verify before use — has been flagged as impossible area code)
- Email: hello@ivaestudios.com
- Instagram: @ivaestudios.cancun
- GBP / Google Maps: https://maps.app.goo.gl/aX7jiVbLzwurMmX19

---

*Last updated: 2026-05-07 by Claude Opus 4.7 in a session with Vianey Díaz.*
*If significant changes are made to the agent system, update this file in the same commit so future sessions stay aligned.*
