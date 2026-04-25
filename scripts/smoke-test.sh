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

# ── 2. Cache-Control headers on static assets ──
hdr "Cache-Control sanity"
for path in "/gallery/js/api.js" "/gallery/js/cover-designs.js" "/gallery/css/gallery.css" "/gallery/sw.js"; do
  cc=$(curl -sI "$BASE$path" | awk -F': ' 'tolower($1)=="cache-control"{print $2}' | tr -d '\r\n')
  if [[ -z "$cc" ]]; then fail "$path → no cache-control header"
  elif [[ "$cc" == *"immutable"* ]]; then fail "$path → $cc (must NOT be immutable!)"
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
