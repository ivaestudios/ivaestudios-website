# Conector Claude ↔ IVAE Marketing (MCP)

**Estado: FUNCIONANDO** (verificado 2026-07-03). Si algo falla, sigue este documento tal cual.

## Qué es

Un conector MCP que deja a Claude (claude.ai, en cualquier chat) leer y escribir el
calendario de contenido de la app de marketing. Código en
`functions/api/mcp/[[path]].js` (Cloudflare Pages Function, se despliega solo con
cada push a `main`). Versión actual: **1.3.0**.

Herramientas que expone (5):

| Herramienta | Qué hace |
|---|---|
| `list_brands` | Lista las marcas disponibles |
| `list_posts` | Posts del calendario por marca/mes (da el ID de cada post) |
| `get_post` | Lee UN post completo: hook, body, cta, caption, hashtags, fecha, estado |
| `create_post` | Crea un post/guion nuevo |
| `update_post` | Edita un post existente por ID (solo los campos que envíes) |

## Cómo está conectado (NO cambiar)

- En claude.ai (cuenta vianeydm07) hay **UN SOLO** conector "IVAE Marketing",
  conectado con la **capability URL global**: `https://ivaestudios.com/api/mcp/<token>`.
- El `<token>` es el de la fila **"TODAS (equipo)"** de la tabla `mkt_mcp_keys` en la
  D1 `ivae-gallery-db`. **El token es un secreto: no va en este repo.** Para
  recuperarlo: consultar la tabla con la API de D1 (token CF en
  `ivae-6-extracted/.cloudflare-token-d1`):
  `SELECT token, label FROM mkt_mcp_keys WHERE label='TODAS (equipo)'`
- Esa clave es global (todas las marcas). También existen 6 claves fijadas por marca
  (una por cliente) por si se quiere dar acceso limitado a alguien del equipo.
- La conexión por capability URL **no caduca** (no depende de OAuth).

## Reglas de oro

1. **Nunca debe haber DOS entradas "IVAE Marketing"** en Ajustes → Conectores de
   claude.ai. Un duplicado (aunque esté "sin conectar") hace que los chats no
   expongan NINGUNA herramienta. Eso fue la falla del 2026-07-03: había quedado un
   intento viejo de OAuth con URL corta `https://ivaestudios.com/api/mcp` — se
   eliminó. Si reaparece un duplicado: eliminarlo y dejar solo el de URL larga.
2. Si un chat dice que "no tiene herramientas": revisar el menú **+ → Conectores**
   del chat y prender "IVAE Marketing" (claude.ai a veces lo trae apagado).
3. Si dice "este conector está fijado a la marca X": ese chat usa una clave por
   marca; usar la global o la de la marca correcta.
4. Las claves se pueden revocar poniendo `revoked=1` en `mkt_mcp_keys` (y crear una
   nueva fila si hace falta rotar).

## Si hay que reconectar desde cero

1. Recuperar la capability URL global (paso de arriba).
2. claude.ai → Ajustes → Conectores → Agregar conector personalizado → pegar la URL
   completa (`https://ivaestudios.com/api/mcp/<token>`) → Conectar. No pide OAuth.
3. Probar en un chat nuevo: "dime qué posts de Meli en julio no tienen caption".

## Si Claude NO ve una tool o un campo nuevo (refrescar el schema)

claude.ai **cachea la lista de herramientas** cuando el conector se conecta y NO
la vuelve a bajar con un "refresh" dentro del chat ni al abrir un chat nuevo. Si
agregas/cambias una tool o un campo (y el server ya lo expone — verifícalo con el
curl de abajo), hay que forzar que claude.ai reinicie la conexión:

- **Fix seguro:** claude.ai → Ajustes → Conectores → quitar "IVAE Marketing" y
  volver a agregarlo con la misma capability URL. Al reconectar re-baja tools/list
  y ya ve los campos nuevos.
- Ojo: `serverInfo.version` sí cambia en `initialize` (curl lo confirma), pero por
  sí solo NO hace que claude.ai refresque; necesita la reconexión.

## Prueba de salud rápida (curl)

```bash
TOKEN=<token de mkt_mcp_keys>
curl -s -X POST "https://ivaestudios.com/api/mcp/$TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
# Debe devolver las 5 herramientas. initialize debe reportar version 1.4.0.
```

## Historial

- 2026-06-29: creado (4 tools) + claves en `mkt_mcp_keys` (migración 013).
- 2026-06-30: conectado en claude.ai con la capability URL global. El intento de
  OAuth (migración 014, `/api/mcp-oauth/*`) funciona por curl pero la UI de
  claude.ai lo dejó colgado — quedó como vía secundaria.
- 2026-07-03: v1.3.0 — se agregó `get_post` (leer guion completo) y error claro
  cuando una clave fijada pide otra marca. Se eliminó el conector duplicado muerto
  en claude.ai (causa de "no me deja trabajar"). Probado end-to-end (Meli):
  listar, leer, crear, editar, por capability URL y por OAuth Bearer.
- 2026-07-06: v1.4.0 — create_post/update_post ahora aceptan `inspo_url` (columna
  "Inspo") y `video_url` ("Video final"); get_post los muestra. Verificado con
  tools/list en vivo. RECORDATORIO: reconectar el conector en claude.ai para que
  vea los campos nuevos (cachea tools/list).
