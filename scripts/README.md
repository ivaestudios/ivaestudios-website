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

---

## `optimize-images.js` (Node.js)

Generates responsive image variants and an LQIP-aware manifest for `/images/`.

### What it does

For every `.jpg` / `.jpeg` / `.png` under `/images/` (excluding `/images/optimized/`):

- Generates variants in `/images/optimized/` at widths **480, 768, 1200, 1920, 2400** in three formats:
  - **AVIF** quality 50
  - **WebP** quality 75
  - **JPG** quality 80, mozjpeg, progressive
- Generates a **20px blurred base64 LQIP** (data URI) per source image.
- Writes `/images/manifest.json` mapping each source path to its variants, dimensions, aspect ratio, and LQIP.
- **Idempotent** — variants already on disk are skipped, so reruns are cheap.
- **Concurrent** — up to 6 sources processed in parallel via `p-limit`.
- **Never upscales** — a target width larger than the source is capped to the source width.

### Install

```bash
cd scripts
npm install
```

Requires Node.js **>= 18**. `sharp` ships with prebuilt binaries for macOS / Linux / Windows.

### Run

From the `scripts/` directory:

```bash
npm run optimize
# or
node optimize-images.js
```

Output:

- `/images/optimized/<subdir>/<name>-<width>.<ext>` for each variant
- `/images/manifest.json` for the lookup table

### Manifest shape

```json
{
  "generatedAt": "2026-05-10T12:00:00.000Z",
  "images": {
    "/images/hero.jpg": {
      "source": "/images/hero.jpg",
      "width": 4000,
      "height": 2667,
      "aspectRatio": 1.4998,
      "lqip": "data:image/jpeg;base64,...",
      "variants": [
        { "width": 480,  "format": "avif", "path": "/images/optimized/hero-480.avif",  "skipped": false },
        { "width": 768,  "format": "webp", "path": "/images/optimized/hero-768.webp",  "skipped": false },
        { "width": 1200, "format": "jpg",  "path": "/images/optimized/hero-1200.jpg",  "skipped": true  }
      ]
    }
  }
}
```

### Notes

- To force regeneration, delete the relevant files under `/images/optimized/` (or the whole directory) and rerun.
- Failures on individual images are logged and skipped; the rest of the run continues.
