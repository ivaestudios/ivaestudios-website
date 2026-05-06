# Admin Focal-Points Auth — Oleada 5 reference

Maintained by: Agent 09 (Oleada 5 admin-focal-auth).
Touches: `admin.html`, `focal-admin.js`, `functions/api/focal.js`,
`functions/api/focal/login.js`, `functions/api/focal/logout.js`,
`functions/api/focal/_auth.js`, `_headers`.

## Why this exists

Before this oleada the admin password was hard-coded as a string
literal in three public files: `admin.html`, `focal-admin.js`, and
`functions/api/focal.js`. Anyone opening DevTools — or anyone reading
the public GitHub repo — could read the password and POST arbitrary
focal-points data to KV.

This refactor moves the secret entirely server-side. The browser never
sees the password after the form submit, and the API authorizes writes
by verifying an HMAC-signed cookie set during login.

## Auth model (server-set HMAC cookie)

```
                                 ┌────────────────────────────┐
admin.html  ──POST /api/focal/login──►  POST /api/focal/login │
  { password }                         constant-time compare  │
                                       vs ADMIN_PASSWORD      │
                                       │                       │
                                       ├─ mismatch ─► sleep    │
                                       │              250–500ms │
                                       │              → 401     │
                                       │                       │
                                       └─ match    ─► Set-Cookie│
                                                      ivae_admin_session=
                                                      <expiry>.<HMAC(expiry, ADMIN_HMAC_KEY)>
                                                      HttpOnly, Secure,
                                                      SameSite=Strict,
                                                      Max-Age=14400 (4h)
                                 └────────────────────────────┘

focal-admin.js  ──POST /api/focal──►   POST /api/focal
  credentials:'include'                read Cookie: ivae_admin_session
                                       split on `.` → expiry, sig
                                       reject if expired
                                       recompute HMAC(expiry, ADMIN_HMAC_KEY)
                                       constant-time compare with sig
                                       │
                                       ├─ valid   ─► write KV, 200
                                       └─ invalid ─► 401
```

- Cookie name: `ivae_admin_session`
- Cookie value format: `<expiry-unix-seconds>.<base64url-hmac-sha256>`
- HMAC key: `ADMIN_HMAC_KEY` secret (32+ random chars recommended)
- Lifetime: 4 hours (`Max-Age=14400`)
- Flags: `HttpOnly; Secure; SameSite=Strict; Path=/`

The cookie is **HttpOnly**, so client JavaScript cannot read or forge
it. The server is the only authority on whether a request is admin.

`focal-admin.js` still uses a `sessionStorage` flag
(`ivae_admin_auth=true`) to decide whether to paint the editor UI.
This flag is **UI-only** — faking it client-side just paints the
editor on a public page, but the editor's POST calls will still be
rejected with 401 because the HMAC cookie is missing.

## Setting the secrets

Both must be configured in the Pages project before the admin can
log in. Until then `/api/focal/login` returns 500
(`Auth not configured`) — fail-closed, by design.

```bash
# Strong random password (or pick one and store it in 1Password):
npx wrangler pages secret put ADMIN_PASSWORD --project-name ivaestudios-website

# 32+ random chars; rotating this invalidates every active session:
npx wrangler pages secret put ADMIN_HMAC_KEY --project-name ivaestudios-website
```

Suggested generators:

```bash
# 32 random hex chars (16 bytes) — use for ADMIN_HMAC_KEY
openssl rand -hex 32
```

## Routes

| Method | Path                  | Auth    | What it does                          |
|--------|-----------------------|---------|---------------------------------------|
| GET    | `/api/focal`          | public  | Returns the focal-points JSON map     |
| POST   | `/api/focal`          | cookie  | Replaces the focal-points JSON in KV  |
| POST   | `/api/focal/login`    | password| Issues `ivae_admin_session` cookie    |
| POST   | `/api/focal/logout`   | none    | Clears `ivae_admin_session` cookie    |

The legacy `X-Admin-Key` header is no longer accepted.

## Files

- `functions/api/focal.js` — bare `/api/focal`, GET (public) + POST (cookie-auth)
- `functions/api/focal/login.js` — POST `/api/focal/login`
- `functions/api/focal/logout.js` — POST `/api/focal/logout`
- `functions/api/focal/_auth.js` — shared HMAC + cookie helpers
  (Pages Functions ignore files starting with `_` — not a route)
- `admin.html` — login form posts to `/api/focal/login`
- `focal-admin.js` — admin-mode editor; all writes use `credentials: 'include'`
- `_headers` — `/api/focal` and `/api/focal/*` set to `no-store`

## Caching

Both `/api/focal` and `/api/focal/*` are pinned to
`no-store, no-cache, must-revalidate, max-age=0` in `_headers`.
The Functions themselves also return `Cache-Control: no-store` on auth
responses. Set-Cookie headers must never be cached by intermediaries.

## Verifying the cookie locally

After a successful login the response carries:

```
Set-Cookie: ivae_admin_session=1714946400.k4Jh9...; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=14400
```

Subsequent POSTs to `/api/focal` must include this cookie via
`credentials: 'include'` (same-origin, so SameSite=Strict is fine).

## Rotating credentials

- **Rotate password only**: `wrangler pages secret put ADMIN_PASSWORD`.
  Existing sessions stay valid until they expire (≤ 4h).
- **Force-logout all admins**: rotate `ADMIN_HMAC_KEY`. Every
  outstanding cookie's signature stops verifying immediately.

## Threat model

- **Repo / DevTools snooping** → password no longer in client code.
- **Brute-force login** → 250–500ms random delay on each 401, plus
  Cloudflare's edge rate limiting on the login endpoint.
- **Cookie theft via XSS** → cookie is HttpOnly; JS cannot read it.
- **CSRF** → SameSite=Strict prevents the browser from sending the
  cookie on cross-site requests.
- **Replay after timeout** → expiry is signed; expired tokens are
  rejected before the HMAC check is even made.

## Out of scope (future work)

- Per-admin user accounts, audit log of writes, IP allowlist.
- Two-factor (TOTP) on top of password.
- Dedicated rate-limit rule on `/api/focal/login` at the Cloudflare
  edge (currently relies on the random delay only).
