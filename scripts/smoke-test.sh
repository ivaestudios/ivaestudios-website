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
