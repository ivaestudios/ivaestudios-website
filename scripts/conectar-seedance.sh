#!/usr/bin/env bash
# ============================================================================
# Conecta el generador de Video IA con Seedance 2.5 (ByteDance) por Replicate.
#
# Se entra por Replicate y no por fal porque cobra la MITAD ($0.2312/s contra
# $0.473/s en 720p), y no por BytePlus porque ese pide alta de empresa.
#
#   bash scripts/conectar-seedance.sh
#
# De donde sale la llave:
#   1. replicate.com -> iniciar sesion (sirve con GitHub o correo)
#   2. Account settings -> Billing -> agregar tarjeta (cobra por uso)
#   3. Account settings -> API tokens -> copiar el token (empieza con r8_)
#
# Precio: 0.2312 USD por segundo en 720p. Un clip de 10 s = 2.31 USD, unos
# 46 pesos. Uno de 30 s = 6.94 USD, unos 139 pesos.
# ============================================================================
set -euo pipefail
PROYECTO_PAGES="ivaestudios-website"

printf 'Pega el token de Replicate y dale Enter (no se vera nada al pegar):\n> '
read -rs LLAVE
printf '\n'
LLAVE="$(printf %s "$LLAVE" | tr -d '[:space:]')"

if [ ${#LLAVE} -lt 20 ]; then
  echo "✗ Eso no parece un token (llego muy corto)."; exit 1
fi
case "$LLAVE" in
  r8_*) ;;
  *) echo "✗ Los tokens de Replicate empiezan con 'r8_'. Revisa cual copiaste."; exit 1;;
esac

echo "→ Comprobando el token contra Replicate…"
CODIGO=$(curl -s -o /dev/null -w '%{http_code}' https://api.replicate.com/v1/account \
  -H "Authorization: Bearer $LLAVE")
case "$CODIGO" in
  200) echo "  ✓ el token sirve";;
  401) echo "✗ Replicate lo rechaza (401). No es valido o fue revocado."; exit 1;;
  *)   echo "  ⚠ Replicate respondio $CODIGO. Se guarda igual, pero revisa la cuenta.";;
esac

echo "→ Guardando el secreto REPLICATE_API_TOKEN en Cloudflare Pages…"
printf %s "$LLAVE" | npx wrangler pages secret put REPLICATE_API_TOKEN --project-name "$PROYECTO_PAGES"
unset LLAVE
echo
echo "✓ Secreto guardado. Avisame y redespliego para que tome efecto."
