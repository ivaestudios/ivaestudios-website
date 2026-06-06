# IVAE Marketing — Content Calendar App

Multi-tenant content-calendar web app for **IVAE Marketing** (the social-media
agency sub-brand of IVAE Studios). Replaces a basic Notion calendar. It is a
static front end (vanilla HTML/CSS/JS, no build step) served by Cloudflare Pages
with a single catch-all Pages Function for the API, backed by Cloudflare D1.

This README covers the **backend API** (`functions/api/marketing/[[path]].js`),
its bindings, the migration command, the URL map, and how to bootstrap the
first admin. The front-end pages (`marketing/index.html`, `app.html`,
`client.html`) are built separately.

---

## Architecture

- **Static assets** live under `marketing/` (login, team app, client portal).
- **API** is ONE catch-all Pages Function at
  `functions/api/marketing/[[path]].js`, mounted at `/api/marketing/*`. The
  `onRequest` entry point strips the `/api/marketing` prefix and routes the
  rest (e.g. `/api/marketing/auth/login` → internal route `/auth/login`).
- **Database** is Cloudflare D1 — the **same** database as the gallery app
  (`ivae-gallery-db`). All of this app's tables are namespaced `mkt_*` so they
  never collide with the gallery tables. Schema:
  `marketing/migrations/001_init.sql`.
- **Auth is fully isolated from the gallery.** This app uses its own cookie
  name **`mkt_session`** (the gallery uses `session`), its own users
  (`mkt_users`) and sessions (`mkt_sessions`). The two apps share a database
  but never share a login.
- Crypto (PBKDF2 password hashing, `randomId`, the cookie/JSON helpers) is
  copied verbatim from the proven gallery function.

---

## Bindings (Cloudflare Pages → Settings → Functions)

| Binding | Type | Value / default | Purpose |
|---|---|---|---|
| `DB` | D1 database | `ivae-gallery-db` | Shared D1; this app uses the `mkt_*` tables. |
| `ADMIN_EMAIL` | env var (plain) | `vianeydm07@gmail.com` | The only email allowed to bootstrap the first admin via `POST /auth/register`. |
| `SESSION_EXPIRY_SECONDS` | env var (plain) | `604800` (7 days) | Session lifetime. Code defaults to `'604800'` if unset. |

No secrets are required by this API (no R2, no Resend, no API keys). Do not put
secrets in code.

> The gallery function already binds `DB`, `ADMIN_EMAIL`, and
> `SESSION_EXPIRY_SECONDS` for the same Pages project, so in practice these are
> already configured. Confirm `ADMIN_EMAIL` is `vianeydm07@gmail.com`.

---

## Migration

Apply the schema to the remote D1 database (run from the repo root):

```bash
wrangler d1 execute ivae-gallery-db --remote --file=marketing/migrations/001_init.sql
```

The migration is idempotent (`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF
NOT EXISTS`), so re-running it is safe. For a local dev DB drop `--remote`.

---

## URL map

| URL | Serves | Audience |
|---|---|---|
| `/marketing/` (`index.html`) | Login page | Everyone |
| `/marketing/app.html` | Team dashboard (calendar + board + list + editor + clients + team mgmt) | admin / team |
| `/marketing/client.html` | Client portal (their calendar, approve / request-changes / comment) | client |
| `/api/marketing/*` | JSON API (this Pages Function) | All roles (server-enforced) |

Every page should carry `<meta name="robots" content="noindex,nofollow">` — the
app is behind login and must never be indexed.

---

## Bootstrapping the admin

Open registration is **disabled**. The very first account is created by a
one-time bootstrap:

1. Deploy with `ADMIN_EMAIL=vianeydm07@gmail.com` bound.
2. Apply the migration (above).
3. Register exactly once:

   ```bash
   curl -X POST https://ivaestudios.com/api/marketing/auth/register \
     -H 'Content-Type: application/json' \
     -d '{"name":"Vianey","email":"vianeydm07@gmail.com","password":"<choose-a-strong-password>"}'
   ```

   This succeeds **only if** the email equals `ADMIN_EMAIL` **and** no admin row
   exists yet. The first admin is auto-logged-in (a `mkt_session` cookie is set
   in the response). Any later attempt (different email, or admin already
   exists) returns `403`.

4. From then on, the admin (or any `team` user) creates the rest of the team and
   the client logins via `POST /api/marketing/users`. When you create a user
   without a password, the API generates a temporary one (`ivae-xxxxx`) and
   returns it **once** in the response so it can be shared; that user is flagged
   `must_reset=1` and should change it on first login.

---

## Roles & access (enforced server-side)

The API is the security boundary; the front end is not trusted.

- **admin** — everything: manage clients, team, all posts.
- **team** — manage all clients + posts; can also invite team members and
  create client logins.
- **client** — **read-only** on their own `client_id`'s posts where
  `client_visible=1`, **except** they may approve / request-changes / comment.
  A client:
  - is auto-scoped to their own `client_id` from the session — passing a
    different `?client_id` returns **403**;
  - never sees other clients, internal team notes (`notes_team`), or internal
    comments (`internal=1`) — these are stripped from every client response;
  - gets **403** on any post create / edit / delete / reorder.

`team`/`admin` may pass `?client_id=` to scope reads.

---

## API contract

All endpoints are under `/api/marketing`, return JSON, and use the
`mkt_session` cookie. Errors return `{ "error": "..." }` with an appropriate
status (400 / 401 / 403 / 404 / 409 / 500).

### Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/login` | `{email,password}` | Returns `{id,email,name,role,client_id,must_reset}` + `Set-Cookie: mkt_session`. `401` on bad creds, `403` if deactivated. |
| POST | `/auth/register` | `{name,email,password}` | Only if `email===ADMIN_EMAIL` and no admin exists yet, else `403`. Auto-logs in the first admin. |
| POST | `/auth/logout` | — | `{ok:true}`, clears the cookie. |
| GET | `/auth/me` | — | `{id,email,name,role,client_id}` or `401`. |
| POST | `/auth/change-password` | `{current,next}` | `{ok:true}` for any logged-in user. |

### Clients (admin/team unless noted)
| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/clients` | — | `[{id,name,slug,brand_color,logo_url,instagram_handle,archived,counts:{posts,pending}}]`. A **client** gets only their own client object. |
| POST | `/clients` | `{name,brand_color?,instagram_handle?,logo_url?}` | Creates a client; slug is auto-generated and uniqued. |
| PATCH | `/clients/:id` | `{...fields}` | Updates editable fields. |
| DELETE | `/clients/:id` | — | Archives (`archived=1`); never hard-deletes. |

### Users (admin/team only)
| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/users` | — | `[{id,email,name,role,client_id,active,last_login}]`. |
| POST | `/users` | `{name,email,role,client_id?,password?}` | `role ∈ {team,client}`; `client` needs `client_id`. If no `password`, one is generated and returned **once** (`{...,password}`) with `must_reset=1`. |
| PATCH | `/users/:id` | `{name?,active?,role?}` | Only an admin may assign the `admin` role. |
| POST | `/users/:id/reset-password` | — | `{password}` — generates a new temp password, returns it once, sets `must_reset=1`. |

### Posts
| Method | Path | Body / query | Notes |
|---|---|---|---|
| GET | `/posts?client_id=&from=&to=&status=` | — | `[post...]`. Client role auto-scoped + only `client_visible=1`; internal fields (`notes_team`) stripped. |
| POST | `/posts` | `{client_id,title,...}` | Creates a post (team/admin only). |
| GET | `/posts/:id` | — | `{post, comments:[...], approvals:[...]}`. Client sees only non-internal comments and a stripped post. |
| PATCH | `/posts/:id` | `{editable fields}` | Updates (team/admin only; client → 403). |
| DELETE | `/posts/:id` | — | Deletes (team/admin only). |
| POST | `/posts/:id/approve` | `{comment?}` | Sets `approval_state='approved'`, logs `mkt_approvals` + activity (client OR team). |
| POST | `/posts/:id/request-changes` | `{comment}` | Sets `approval_state='changes'` (comment required), logs (client OR team). |
| POST | `/posts/:id/comments` | `{body, internal?}` | Adds a comment. A client can never set `internal=1`. |
| POST | `/posts/reorder` | `{updates:[{id,status?,position,publish_date?}]}` | Bulk drag/drop move, applied as a D1 batch (team/admin only). |

**Post object fields:** `id, client_id, title, content_type, grabacion,
publish_date, assignee, platform, status, caption, inspo_url, video_url, hook,
body, cta, hashtags, notes_team, client_visible, approval_state, position,
created_at, updated_at`. For the client role, `notes_team` and any internal
comments are removed.

### Activity (admin/team only)
| Method | Path | Notes |
|---|---|---|
| GET | `/activity?client_id=&limit=` | Recent activity rows (newest first). `limit` defaults to 50, capped at 200. |

Every mutating action appends an `mkt_activity` row (best-effort; logging
failures never fail the request).

---

## Enums

- **content_type:** `reel, tiktok, informativo, carrusel, experiencia, pauta,
  tratamientos, historia, foto`
- **status** (pipeline order): `idea, guion, grabacion, edicion, revision,
  aprobado, programado, publicado`
- **grabacion:** `1..5` (recording priority, nullable)
- **platform:** `Instagram, TikTok, Facebook, YouTube, LinkedIn`
- **approval_state:** `pending, approved, changes`

---

## Notes / constraints

- Vanilla Workers-runtime JS only (Web APIs); no npm, no imports, no build step.
- All SQL is parameterized (no string interpolation of user input into queries).
- The function only touches `mkt_*` tables; it does not read or write any
  gallery table.
- Do not edit `_redirects` / `_headers` / `sitemap*` for this app — routing for
  `/marketing/` and `/api/marketing/*` is handled separately by the site owner.
