# IVAE Studios — Automation Scripts

Cloud-native scripts that run in GitHub Actions. No local machine required.

## `index_urls.py`
Submits URLs to the Google Indexing API for re-crawl.

- **Credentials:** reads service account JSON from the `GOOGLE_INDEXING_SA_JSON`
  environment variable (set as a GitHub Secret). Never commit the JSON file.
- **URL source (in order):** CLI args → `URLS_FILE` env var → built-in default list.
- **Quota:** 200 URLs / day / project.

Manual run (GitHub UI): Actions → **SEO: Index URLs** → **Run workflow**.

Auto run: fires on every push to `main` that touches `.html`, `sitemap.xml`, or `_redirects`.

## `audit_links.py`
Walks every `.html` in the repo and reports internal links whose target does
not exist as a file and is not covered by `_redirects`.

Manual run: Actions → **SEO: Link Audit** → **Run workflow**.

```bash
# Local, if you ever want it:
python scripts/audit_links.py --fail-on-broken
```

## Secrets required (GitHub → Settings → Secrets and variables → Actions)

| Secret                     | Required | Purpose                                          |
|----------------------------|----------|--------------------------------------------------|
| `GOOGLE_INDEXING_SA_JSON`  | ✅ yes   | Full JSON content of the Search Console key.    |

Optional future additions: `BING_WEBMASTER_KEY`, `INDEXNOW_KEY`.
