#!/bin/bash
# IVAE Gallery — production smoke test
# Run after each wave to catch regressions fast.
#
# Usage: bash scripts/smoke-test.sh
#
# Exits non-zero if any check fails. Output is human-readable.

set -uo pipefail

BASE="https://ivaestudios.com"
# (gallery.ivaestudios.com is a legacy subdomain pointing at the old standalone
#  Worker — kept around for any old shared links but not the canonical URL.
#  The site is served from the main domain at /gallery/ via Pages Functions.)
PASS=0
FAIL=0
WARN=0

ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1" >&2; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }
hdr()  { echo ""; echo "── $1 ──"; }

# ── 1. HTTP status of key public pages ──
hdr "Public page status codes"
for path in "/gallery/" "/gallery/galleries" "/gallery/portfolio" "/gallery/forgot-password" "/gallery/reset-password" "/gallery/register"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path")
  if [[ "$code" == "200" ]]; then ok "$path → 200"
  elif [[ "$code" == "302" || "$code" == "301" ]]; then warn "$path → $code (redirect)"
  else fail "$path → $code"
  fi
done

# ── 2. Cache-Control on the CACHE-BUSTED asset URLs (the ones the HTML
#       actually references). The bare URLs without ?v=... are still cached
#       as immutable from a previous misconfiguration — that's a known issue
#       being worked around via cache-busting query strings, so we test the
#       real URLs and only WARN on the legacy bare ones.
hdr "Cache-Control sanity (versioned URLs)"
VBUST="?v=20260424"
for path in "/gallery/js/api.js" "/gallery/js/cover-designs.js" "/gallery/css/gallery.css"; do
  cc=$(curl -sI "$BASE$path$VBUST" | awk -F': ' 'tolower($1)=="cache-control"{print $2}' | tr -d '\r\n')
  if [[ -z "$cc" ]]; then fail "$path$VBUST → no cache-control header"
  elif [[ "$cc" == *"immutable"* ]]; then fail "$path$VBUST → $cc (must NOT be immutable!)"
  else ok "$path$VBUST → $cc"
  fi
done
# Service worker — always tested without query string (registered by path)
cc=$(curl -sI "$BASE/gallery/sw.js" | awk -F': ' 'tolower($1)=="cache-control"{print $2}' | tr -d '\r\n')
if [[ "$cc" == *"no-cache"* || "$cc" == *"no-store"* ]]; then ok "/gallery/sw.js → $cc"
else fail "/gallery/sw.js → $cc (must be no-store/no-cache)"
fi
# Legacy bare URLs — warn only (cached as immutable from old _headers; not used)
hdr "Cache-Control on LEGACY bare URLs (warn only)"
for path in "/gallery/js/api.js" "/gallery/css/gallery.css"; do
  cc=$(curl -sI "$BASE$path" | awk -F': ' 'tolower($1)=="cache-control"{print $2}' | tr -d '\r\n')
  if [[ "$cc" == *"immutable"* ]]; then warn "$path → $cc (legacy stale cache; HTML now uses ?v=...)"
  else ok "$path → $cc"
  fi
done

# ── 3. API endpoints reachable (no auth required) ──
hdr "API public endpoints"
for path in "/api/gallery/auth/me"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path")
  if [[ "$code" == "401" || "$code" == "200" ]]; then ok "$path → $code (expected 401 without cookie)"
  else fail "$path → $code"
  fi
done

# ── 4. Forgot-password does NOT leak token ──
hdr "Security: forgot-password no token leak"
body=$(curl -s -X POST "$BASE/api/gallery/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody-test@example.com"}')
if echo "$body" | grep -q '"token"'; then
  fail "forgot-password leaked a token in response body!"
else
  ok "forgot-password did not leak token (body: $body)"
fi

# ── 5. CSP header present on /gallery/ ──
hdr "CSP header"
csp=$(curl -sI "$BASE/gallery/" | awk -F': ' 'tolower($1)=="content-security-policy"{print $2}')
if [[ -n "$csp" ]]; then ok "CSP present (${#csp} chars)"
else fail "CSP missing on /gallery/"
fi

# ── 6. HSTS ──
hdr "HSTS"
hsts=$(curl -sI "$BASE/" | awk -F': ' 'tolower($1)=="strict-transport-security"{print $2}' | tr -d '\r\n')
if [[ -n "$hsts" ]]; then ok "HSTS: $hsts"
else fail "HSTS missing"
fi

# ── 7. Service worker reachable + Service-Worker-Allowed header ──
hdr "Service worker"
sw_allowed=$(curl -sI "$BASE/gallery/sw.js" | awk -F': ' 'tolower($1)=="service-worker-allowed"{print $2}' | tr -d '\r\n')
if [[ "$sw_allowed" == "/" ]]; then ok "Service-Worker-Allowed: /"
else warn "Service-Worker-Allowed missing or wrong: '$sw_allowed'"
fi

# ── 8. Wave-B endpoints (Pic-Time parity) ──
# B1: Public share-token API (no auth required). Returns 404 for unknown
#     tokens, 200 for valid ones. Anything else (esp. 401) means the route
#     fell through to authenticated handlers — broken.
hdr "Wave B endpoints"
TOK="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"  # 32-hex shape but won't exist
b1_body=$(curl -sS "$BASE/api/gallery/galleries/share/$TOK")
if echo "$b1_body" | grep -q '"error":"Gallery not found"'; then
  ok "B1 share-token endpoint public + 404 for unknown token"
elif echo "$b1_body" | grep -q '"error":"Unauthorized"'; then
  fail "B1 share-token endpoint requires auth (route not matching!) — body: $b1_body"
else
  warn "B1 share-token unexpected body: $b1_body"
fi

# B2: Admin downloads endpoint must require auth.
b2_code=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/gallery/admin/downloads")
if [[ "$b2_code" == "401" ]]; then ok "B2 admin/downloads → 401 (auth required)"
else fail "B2 admin/downloads → $b2_code (expected 401)"
fi

# B3: Per-size /web/{sm|md|lg} route exists. Should 404 (not 405/500) for
#     a fake photo id since the route matches but the photo doesn't exist.
b3_code=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/gallery/photos/00000000000000000000000000000000/web/md")
if [[ "$b3_code" == "404" ]]; then ok "B3 /photos/{id}/web/md → 404 (route live)"
else fail "B3 /photos/{id}/web/md → $b3_code (expected 404)"
fi

# B4: Per-photo OG endpoint as a crawler — 404 expected for unknown photo.
b4_code=$(curl -sS -A "facebookexternalhit/1.1" -o /dev/null -w "%{http_code}" \
  "$BASE/gallery/p/00000000000000000000000000000000")
if [[ "$b4_code" == "404" ]]; then ok "B4 /gallery/p/{id} crawler-fetch → 404 (route live)"
else fail "B4 /gallery/p/{id} → $b4_code (expected 404)"
fi

# B1+/g: Pages Function for /gallery/g/{token} — must 302 for valid-shape
#       tokens (with share param in Location) and 404 for malformed ones.
#       Older _redirects rule used to 308 → /gallery/gallery losing the param.
g_loc=$(curl -sS -D - -A "Mozilla/5.0" -o /dev/null "$BASE/gallery/g/abc123def456" \
  | awk -F': ' 'tolower($1)=="location"{print $2}' | tr -d '\r\n')
if [[ "$g_loc" == *"share=abc123def456"* ]]; then
  ok "/gallery/g/{token} (user) 302 → $g_loc"
else
  fail "/gallery/g/{token} (user) broken redirect (Location: '$g_loc')"
fi

# B6: Same /gallery/g/{token} but as a crawler — should serve OG-rich HTML
#     (no redirect), with og:image and og:title meta tags so previews on
#     WhatsApp / IG / FB show the gallery cover instead of a generic card.
b6_html=$(curl -sS -A "facebookexternalhit/1.1" "$BASE/gallery/g/abc123def456")
if echo "$b6_html" | grep -q 'property="og:image"' && echo "$b6_html" | grep -q 'twitter:card'; then
  ok "B6 /gallery/g/{token} crawler-fetch returns OG meta tags"
else
  fail "B6 /gallery/g/{token} crawler-fetch missing OG tags"
fi

# C2: Admin proof-review endpoint exists and requires auth.
c2_code=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" -d '{"status":"approved"}' \
  "$BASE/api/gallery/admin/proofs/00000000000000000000000000000000/review")
if [[ "$c2_code" == "401" ]]; then ok "C2 admin/proofs/{id}/review → 401 (auth required)"
else fail "C2 admin/proofs/{id}/review → $c2_code (expected 401)"
fi

# ── Summary ──
hdr "SUMMARY"
echo "  PASS: $PASS    FAIL: $FAIL    WARN: $WARN"
if [[ "$FAIL" -gt 0 ]]; then
  echo ""
  echo "  ✗ smoke test failed"
  exit 1
fi
echo ""
echo "  ✓ smoke test passed"
