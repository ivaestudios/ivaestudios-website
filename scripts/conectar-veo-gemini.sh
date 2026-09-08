#!/usr/bin/env bash
# ============================================================================
# Conecta el generador de Video IA por la API de Gemini.
#
# Es la via rapida: no hace falta llave JSON ni tocar politicas de seguridad.
# OJO: el credito de 300 USD NO paga esta via; cada clip se le cobra a la
# tarjeta. Mismo precio por segundo que Vertex (8 pesos el clip Lite de 8 s).
#
# La llave se teclea aqui y viaja directo a Cloudflare. NO se imprime en
# pantalla, NO queda en el historial del shell y NO pasa por el chat.
#
#   bash scripts/conectar-veo-gemini.sh
#
# Donde sacar la llave:
#   https://console.cloud.google.com/apis/credentials?project=project-079a5d99-32ca-410d-964
#   -> "IVAE Video IA (Veo)" -> Mostrar clave -> copiar
# ============================================================================
set -euo pipefail
PROYECTO_PAGES="ivaestudios-website"

printf 'Pega la llave de API de Google y dale Enter (no se vera nada al pegar):\n> '
if [ -n "${ZSH_VERSION:-}" ]; then
  read -rs LLAVE
else
  read -rs LLAVE
fi
printf '\n'

LLAVE="$(printf %s "$LLAVE" | tr -d '[:space:]')"
if [ ${#LLAVE} -lt 20 ]; then
  echo "✗ Eso no parece una llave (llego muy corta). Vuelve a intentarlo."
  exit 1
fi
echo "→ Llave recibida (${#LLAVE} caracteres). Guardando en Cloudflare Pages…"

printf %s "$LLAVE" | npx wrangler pages secret put GEMINI_API_KEY --project-name "$PROYECTO_PAGES"
unset LLAVE

echo
echo "✓ Secreto GEMINI_API_KEY guardado."
echo "  Ahora avisame y yo redespliego para que tome efecto."
