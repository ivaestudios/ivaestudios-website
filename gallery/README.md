# Gallery sub-app

The IVAE client gallery (formerly `gallery.ivaestudios.com`, now mounted at
`ivaestudios.com/gallery/`).

This folder is one of two halves of the gallery system:

- **`/gallery/`** (this folder) — static assets served by Cloudflare Pages.
  `gallery.html`, `admin/*.html`, `js/*.js`, `css/*.css`, `images/`, etc.
- **`/functions/api/gallery/[[path]].js`** — the catch-all Pages Function
  that handles every request to `/api/gallery/*`. Holds all the routing,
  auth, D1 queries, R2 ops, email rendering, and so on.

## URLs

| Public-facing                                          | Behind the scenes                |
| ------------------------------------------------------ | -------------------------------- |
| `ivaestudios.com/gallery/` (login)                     | `gallery/index.html`             |
| `ivaestudios.com/gallery/gallery.html?id=...`          | `gallery/gallery.html`           |
| `ivaestudios.com/gallery/admin/`                       | `gallery/admin/index.html`       |
| `ivaestudios.com/gallery/admin/galleries.html`         | `gallery/admin/galleries.html`   |
| `ivaestudios.com/api/gallery/admin/stats?period=30`    | catch-all → `handleAdminStats`   |
| `ivaestudios.com/api/gallery/galleries/{id}`           | catch-all → `handleGetGallery`   |

## Bindings

Configured in **Cloudflare Pages → Settings → Functions → Bindings**:

- D1: `DB` → `ivae-gallery-db` (id `5b40b96a-e3f6-4ba3-87d6-4fed5b3911b9`)
- R2: `R2_BUCKET` → `ivae-gallery-photos`

## Env vars / secrets

In **Cloudflare Pages → Settings → Environment variables**:

| Name                       | Type    | Value                                           |
| -------------------------- | ------- | ----------------------------------------------- |
| `ADMIN_EMAIL`              | plain   | `vianeydm07@gmail.com`                          |
| `SESSION_EXPIRY_SECONDS`   | plain   | `604800`                                        |
| `DROPBOX_APP_KEY`          | plain   | `y0vvdpb7u421pia`                               |
| `GOOGLE_DRIVE_CLIENT_ID`   | plain   | (same id as before)                             |
| `RESEND_API_KEY`           | secret  | (the Resend key — encrypted)                    |
| `JWT_SECRET`               | secret  | (session signing key — encrypted)               |
| `CRON_SECRET`              | secret  | (bearer token for the cron-sweep endpoint)      |
| `DROPBOX_APP_SECRET`       | secret  | (optional — only if Dropbox import is used)     |
| `GOOGLE_DRIVE_CLIENT_SECRET` | secret| (optional — only if Drive import is used)       |

The same `CRON_SECRET` must also be set as `GALLERY_CRON_SECRET` in **GitHub
→ Repo Settings → Secrets and variables → Actions** so the daily workflow
`.github/workflows/gallery-cron-sweep.yml` can authenticate.

## Migrations

Apply against the production D1 database with:

```bash
wrangler d1 execute ivae-gallery-db --remote \
  --file=gallery/migrations/00X_name.sql
```

Migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, `INSERT OR IGNORE`,
`ALTER TABLE ADD COLUMN`). Already-applied migrations replay safely.

## Cron

The daily 12:00 UTC sweep (expiry warnings + scheduled emails) is triggered
by `.github/workflows/gallery-cron-sweep.yml`, which POSTs to
`https://ivaestudios.com/api/gallery/admin/cron-sweep` with bearer auth.

## Companion daemon

High-throughput uploads use the standalone Electron daemon in the separate
repo `ivaestudios/ivae-uploader`. The daemon talks to the gallery API via
the public endpoints documented inline in
`functions/api/gallery/[[path]].js`.
