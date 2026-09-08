#!/usr/bin/env bash
# ============================================================================
# Conecta el generador de Video IA con Sora 2 de OpenAI.
#
# La llave se teclea aqui y viaja directo a Cloudflare. NO se ve en pantalla,
# NO queda en el historial del shell y NO pasa por el chat.
#
#   bash scripts/conectar-sora.sh
#
# De donde sale la llave:
#   1. platform.openai.com  -> iniciar sesion (es cuenta aparte de ChatGPT)
#   2. Settings -> Billing  -> cargar saldo (con 10 USD sobra para probar)
#   3. API keys -> Create new secret key -> copiar (empieza con sk-)
#
# Precio: 0.10 USD por segundo en vertical 720x1280. Un clip de 20 s = 2 USD,
# unos 40 pesos. El Pro cuesta 0.50 por segundo.
# ============================================================================
set -euo pipefail
PROYECTO_PAGES="ivaestudios-website"

printf 'Pega la llave de OpenAI y dale Enter (no se vera nada al pegar):\n> '
read -rs LLAVE
printf '\n'

LLAVE="$(printf %s "$LLAVE" | tr -d '[:space:]')"
if [ ${#LLAVE} -lt 20 ]; then
  echo "✗ Eso no parece una llave (llego muy corta). Vuelve a intentarlo."; exit 1
fi
case "$LLAVE" in
  sk-*) ;;
  *) echo "✗ Las llaves de OpenAI empiezan con 'sk-'. Revisa que copiaste la correcta."; exit 1;;
esac

echo "→ Comprobando la llave contra OpenAI…"
CODIGO=$(curl -s -o /dev/null -w '%{http_code}' https://api.openai.com/v1/models \
  -H "Authorization: Bearer $LLAVE")
case "$CODIGO" in
  200) echo "  ✓ la llave sirve";;
  401) echo "✗ OpenAI la rechaza (401). Esa llave no es valida o fue revocada."; exit 1;;
  429) echo "  ⚠ la llave sirve pero la cuenta no tiene saldo (429). Carga credito antes de generar.";;
  *)   echo "  ⚠ OpenAI respondio $CODIGO. Se guarda igual, pero revisa la cuenta.";;
esac

echo "→ Guardando el secreto OPENAI_API_KEY en Cloudflare Pages…"
printf %s "$LLAVE" | npx wrangler pages secret put OPENAI_API_KEY --project-name "$PROYECTO_PAGES"
unset LLAVE

echo
echo "✓ Secreto guardado."
echo "  Cloudflare aplica los secretos en el SIGUIENTE despliegue: avisame y redespliego."
