#!/usr/bin/env bash
# ============================================================================
# Conecta el generador de Video IA con Google Vertex AI (el que gasta el
# crédito de 300 USD).
#
# Toma la llave JSON que Google acaba de descargar, la valida y la guarda como
# secreto GOOGLE_SA_JSON en Cloudflare Pages. El contenido de la llave NUNCA se
# imprime en pantalla: viaja por una tubería directa a wrangler.
#
#   bash scripts/conectar-veo.sh                 # busca la llave en ~/Downloads
#   bash scripts/conectar-veo.sh /ruta/llave.json
#
# Requisitos: `npx wrangler whoami` debe decir vianeydm07@gmail.com. Si no,
# correr `npx wrangler login` primero (la sesión caduca cada par de días).
# ============================================================================
set -euo pipefail

PROYECTO_PAGES="ivaestudios-website"
PROYECTO_GCP="project-079a5d99-32ca-410d-964"

# ── 1. Encontrar la llave ────────────────────────────────────────────────────
LLAVE="${1:-}"
if [ -z "$LLAVE" ]; then
  LLAVE=$(ls -t "$HOME/Downloads/${PROYECTO_GCP}"*.json 2>/dev/null | head -1 || true)
fi
if [ -z "$LLAVE" ] || [ ! -f "$LLAVE" ]; then
  echo "✗ No encontré la llave JSON."
  echo "  Búscala en Descargas (se llama algo como ${PROYECTO_GCP}-xxxxxxxx.json)"
  echo "  y pásamela así:  bash scripts/conectar-veo.sh ~/Downloads/esa-llave.json"
  exit 1
fi
echo "→ Llave encontrada: $(basename "$LLAVE")"

# ── 2. Validarla sin enseñar su contenido ────────────────────────────────────
python3 - "$LLAVE" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
faltan = [k for k in ('type','project_id','client_email','private_key') if not d.get(k)]
if faltan:
    sys.exit('✗ Al JSON le faltan campos: ' + ', '.join(faltan))
if d['type'] != 'service_account':
    sys.exit('✗ Ese JSON no es de una cuenta de servicio (type=%s).' % d['type'])
if 'BEGIN PRIVATE KEY' not in d['private_key']:
    sys.exit('✗ La private_key no tiene forma de PEM.')
print('→ Cuenta:  ' + d['client_email'])
print('→ Proyecto:' + d['project_id'])
PY

# ── 3. Guardarla en Cloudflare (el valor va por tubería, no por pantalla) ────
echo "→ Guardando el secreto GOOGLE_SA_JSON en Cloudflare Pages…"
tr -d '\n' < "$LLAVE" | npx wrangler pages secret put GOOGLE_SA_JSON \
  --project-name "$PROYECTO_PAGES"

echo
echo "✓ Secreto guardado."
echo
echo "OJO: Cloudflare aplica los secretos nuevos en el SIGUIENTE despliegue."
echo "     Haz un push vacío o espera al próximo deploy, y luego comprueba con:"
echo "       curl -s https://ivaestudios.com/api/marketing/video-ia/estado"
echo "     Debe responder  \"google\":\"vertex\"  y  \"pagando\":\"credito\"."
