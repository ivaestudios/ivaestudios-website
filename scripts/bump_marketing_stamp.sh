#!/usr/bin/env bash
# =============================================================================
# IVAE Marketing — bumpea el sello ?v=AAAAMMDDhhmm de TODA la app.
#
# POR QUÉ EXISTE
# La app congela sus módulos con ?v=SELLO y el Service Worker los sirve
# cache-first (un asset con ?v= es inmutable: si cambia el contenido, cambia la
# URL). Si se despliega código sin bumpear el sello, la URL no cambia → el
# navegador y el SW siguen sirviendo el archivo VIEJO para siempre, y encima el
# indicador de versión dice "Actualizada ✓" en verde, porque el sello del
# servidor y el de la pantalla coinciden. Es peor que no tener indicador: es una
# afirmación falsa. Este script hace que eso no dependa de acordarse.
#
# USO
#   scripts/bump_marketing_stamp.sh          # bumpea a la hora de ahora
#   scripts/bump_marketing_stamp.sh --check  # NO toca nada; falla si hace falta
#                                            # bumpear o si hay sellos mezclados
#
# --check es lo que conviene correr antes de desplegar (o en un hook pre-push):
# sale con código 1 si marketing/ tiene cambios sin commitear/commiteados
# respecto a origin y el sello no se movió.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
APP_DIR="marketing"
# TZ fija: el sello se lee como hora LOCAL en el navegador (version.js), y las
# clientas están en Cancún. Sin esto, un CI en UTC mostraría "23:00" a las 6pm.
STAMP_TZ="America/Cancun"
STAMP_RE='[0-9]\{12\}'

if [ ! -d "$APP_DIR" ]; then
  echo "error: no encuentro $APP_DIR/ (corre esto desde el repo)" >&2
  exit 2
fi

# Archivos que llevan el sello.
files() {
  grep -rl "?v=$STAMP_RE" "$APP_DIR" \
    --include='*.js' --include='*.html' --include='*.css' --include='*.webmanifest' \
    2>/dev/null || true
}

# Todos los sellos presentes, sin repetir.
stamps() {
  grep -rho "?v=$STAMP_RE" "$APP_DIR" \
    --include='*.js' --include='*.html' --include='*.css' --include='*.webmanifest' \
    2>/dev/null | sed 's/^?v=//' | sort -u
}

CURRENT_STAMPS="$(stamps)"
N_STAMPS="$(printf '%s\n' "$CURRENT_STAMPS" | grep -c . || true)"

if [ "${1:-}" = "--check" ]; then
  fail=0

  # 1) Un solo sello en toda la app. Sellos mezclados = módulos de dos deploys
  #    distintos corriendo juntos, y el detector de versión comparando peras
  #    con manzanas.
  if [ "$N_STAMPS" -ne 1 ]; then
    echo "FALLA: hay $N_STAMPS sellos distintos en $APP_DIR/:" >&2
    printf '  %s\n' $CURRENT_STAMPS >&2
    fail=1
  fi

  # 2) Si cambió algo de la app, el sello TIENE que haberse movido.
  if git rev-parse --git-dir >/dev/null 2>&1; then
    base="$(git rev-parse --verify --quiet origin/HEAD || git rev-parse --verify --quiet origin/main || echo '')"
    if [ -n "$base" ]; then
      changed="$(git diff --name-only "$base" -- "$APP_DIR" ; git status --porcelain --untracked-files=all -- "$APP_DIR" | sed 's/^...//')"
      if [ -n "$(printf '%s' "$changed" | grep -c . || true)" ] && [ -n "$changed" ]; then
        old="$(git show "$base:$APP_DIR/app.html" 2>/dev/null | grep -o "?v=$STAMP_RE" | head -1 | sed 's/^?v=//' || true)"
        new="$(grep -o "?v=$STAMP_RE" "$APP_DIR/app.html" | head -1 | sed 's/^?v=//')"
        if [ -n "$old" ] && [ "$old" = "$new" ]; then
          echo "FALLA: $APP_DIR/ tiene cambios pero el sello sigue en $new." >&2
          echo "       Corre: scripts/bump_marketing_stamp.sh" >&2
          fail=1
        fi
      fi
    fi
  fi

  [ "$fail" -eq 0 ] && echo "OK: sello único ($CURRENT_STAMPS) y coherente con los cambios."
  exit "$fail"
fi

NEW="$(TZ="$STAMP_TZ" date +%Y%m%d%H%M)"
n=0
for f in $(files); do
  # -i '' es la forma de BSD/macOS; en Linux sería -i sin argumento.
  if sed -i '' "s/?v=$STAMP_RE/?v=$NEW/g" "$f" 2>/dev/null || sed -i "s/?v=$STAMP_RE/?v=$NEW/g" "$f"; then
    n=$((n + 1))
  fi
done

echo "Sello bumpeado a $NEW en $n archivos de $APP_DIR/."
echo "Antes: $CURRENT_STAMPS"
