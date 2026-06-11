# IVAE Marketing, Centro de Contenido v2 (enterprise)

App interna de gestion de contenido para los clientes de IVAE Marketing
(calendario editorial, tablero, aprobaciones de cliente, avisos y
automatizaciones). Vive bajo `/marketing/` en el mismo proyecto de
Cloudflare Pages que el sitio y la galeria. La autenticacion es propia
(cookie `mkt_session`, tablas `mkt_users`/`mkt_sessions`): comparte D1 con
la galeria pero jamas comparte login.

> **Mobile-first real.** El 99% del uso es en telefono: cada vista se diseña
> primero a 390px, touch targets de 44px o mas, `100dvh` y safe-areas.
> UI 100% en español (es-MX), sin em-dashes en texto visible.

## Stack (reglas duras)

- **Frontend:** vanilla ES modules. SIN build step, SIN npm, SIN frameworks.
  ~60 modulos cargados con `import()` lazy por vista.
- **Backend:** Cloudflare Pages Functions, un solo catch-all
  `functions/api/marketing/[[path]].js` + `_dashboard.js` importado
  (sin `export onRequest` propio).
- **Datos:** D1 (SQLite) `ivae-gallery-db` (compartida con la galeria),
  tablas con prefijo `mkt_`.
- **Cache:** `sw.js` v12 hace bypass total de `/marketing/*` (network-only,
  igual que `/gallery/*`). Obligatorio: los ES modules internos se importan
  sin `?v=`, solo los entry points de los HTML llevan `?v=4`.

## Arquitectura v2

```
marketing/
  index.html            login (usa js/api.js?v=4 desde un module inline)
  app.html              app de equipo (entry: js/main.js?v=4)
  client.html           portal del cliente (entry: js/portal/main.js?v=4)
  css/
    app.css             base v1 absorbida (+ rename .grid -> .dgrid, tokens --pri-*)
    tokens2.css         tokens v2 aditivos (nav, sheets, z-index, densidad)
    shell.css           chrome del shell (topbar, bottom-nav, sheets, toasts)
    dashboard|calendar|kanban|table|timeline|mywork|editor|portal.css
  js/
    api.js              cliente HTTP + helpers DOM + catalogos (compartido v1/v2)
    main.js             composition root: registra vistas lazy y shell.boot()
    shell/              shell singleton: router, store, prefs, topbar,
                        clientswitcher, bottomnav+FAB, sheet, toast, icons,
                        search, notifications
    ui/                 primitivas compartidas: pickers.js (tipados) y
                        dnd.js (UNICO motor drag por Pointer Events, move/resize)
    services/           dominio sin DOM: bulk, checklist, views, stats, automations
    lib/                dates.js (ISO es-MX) y effort.js (carga de trabajo)
    views/              dashboard, kanban, table, timeline, workload,
                        mywork, automations (+ dash-widgets)
    calendar/           vista flagship (mes/semana/agenda, backlog, quick-create)
    table/ kanban/      submodulos de sus vistas
    editor/             item card #/post/:id (5 tabs, autosave, plantillas)
    portal/             app AISLADA del cliente (store propio EventTarget)
    app.js              LEGACY v1 MUERTO (rollback; ningun HTML lo carga)
    client.js           LEGACY v1 MUERTO (rollback; ningun HTML lo carga)
  migrations/           001..005 (004 idempotente, 005 ALTERs)
functions/api/marketing/
  [[path]].js           catch-all unico (toda la API v1+v2)
  _dashboard.js         handleDashboard importado por el catch-all
.github/workflows/marketing-cron.yml   respaldo diario del lazySweep
```

Principios:

- **Un solo dueño por primitiva:** UN sheet (`js/shell/sheet.js`), UN store,
  UN pickers tipado, UN motor DnD (`js/ui/dnd.js`). Jamas HTML5 DnD; todo
  drag tiene fallback visible ("Mover a...").
- **Vistas = plugins.** `main.js` las registra con `import()` dinamico; si un
  modulo falla, la vista degrada a un empty state con Reintentar y el shell
  sigue vivo.
- **Mutaciones SIEMPRE optimistas:** snapshot, fetch, reconciliar con la
  respuesta o rollback + toast "No se pudo guardar, intenta de nuevo."
- **Degradacion limpia:** sin migracion 004 la campana y el tab Avisos se
  ocultan (404), `/search` cae a busqueda en memoria, `?scope=all` cae a
  multi-fetch por cliente, `/views` cae a modo local en prefs, los servicios
  bulk caen a PATCH/DELETE por post (API v1).
- **El portal es otra app.** `js/portal/*` con store propio; solo importa
  `api.js`, `js/shell/sheet.js` y `js/shell/toast.js`. Cero estado compartido.

## Contrato del shell (CONGELADO)

Registro de vista (en `main.js`, via `shell.registerView`, que re-exporta
`router.registerView`):

```js
registerView({ id, label, icon, mount(el, ctx), unmount?(), onParams?(params) });
// El modulo de vista exporta: export default { mount, unmount?, onParams? }
```

`ctx` entregado a cada `mount(el, ctx)`:

```js
{
  store,                       // getState/set/subscribe/optimistic/emit/on
                               // + acciones: loadPosts, patchPost, createPost,
                               //   removePost, upsertPost, reorder, loadUsers,
                               //   refreshClientCounts
  prefs,                       // get/set/remove namespaced mkt2.<userId>.*
  router: { navigate, current },
  sheet:  { openSheet, pickFrom, closeAll },
  pickers,                     // status, fecha, persona, plataforma, tipo,
                               // grabacion, aprobacion, prioridad, textExpand
  dnd,                         // motor Pointer Events, modos move y resize
  toast,                       // toast(msg, {type, ms, action:{label,onAction}})
  setFab, setViewControls, setTabBadge,
  openEditor(id, {tab, commentId}),
  selectClient(id),
  icons, params,
}
```

Eventos de dominio del store: `client:changed`, `posts:changed`,
`post:updated`, `post:created`, `post:deleted`, `mutated`,
`notifications:read`, `view:applied`, y de servicios: `bulk:selection`,
`checklist:changed`, `checklist:counts`, `views:changed`.

Reglas duras para vistas: nunca tocan `localStorage` ni `location.hash`
directo (todo via prefs y router); nunca importan otra vista ni el legacy;
dato de usuario siempre via `textContent` (`innerHTML` solo en
`icons.js`); el rol client jamas entra a `app.html` (gate en boot); el shell
centraliza `loadPosts` (boot y cambio de cliente).

## Rutas hash (app de equipo)

| Ruta | Vista | Modulo |
|---|---|---|
| `#/inicio` | Dashboard (scope cliente/agencia) | `js/views/dashboard.js` |
| `#/calendario` | Calendario (mes/semana desktop, agenda movil) | `js/calendar/index.js` |
| `#/tablero` | Kanban (8 columnas + Otros) | `js/views/kanban.js` |
| `#/tabla` | Tabla enterprise (grupos, bulk, quick-add) | `js/views/table.js` |
| `#/timeline` | Gantt ligero (work_start a publish_date) | `js/views/timeline.js` |
| `#/carga` | Carga semanal por persona | `js/views/workload.js` |
| `#/mi-trabajo` | Mi trabajo cross-cliente | `js/views/mywork.js` |
| `#/automatizaciones` | 8 recetas con switch | `js/views/automations.js` |
| `#/post/<id>` | Editor del post (deep-link de busqueda y avisos) | `js/editor/editor.js` |

Params de URL (espejados a `store.filters` por el shell): `cliente`, `q`,
`estado`, `tipo`, `persona`, `desde`, `hasta`; el editor agrega `tab` y
`comment`. `estado` y `tipo` aceptan multi-seleccion separada por comas
(`estado=idea,guion`). Portal del cliente: `/marketing/client#post=<id>`
(deep-link canonico, sin `.html`).

Bottom-nav (4 tabs): Inicio, Contenido (recuerda la ultima vista de contenido
usada), Mi trabajo, Avisos (overlay; se oculta si `/notifications` da 404).

## Catalogo de prefs (`mkt2.<userId>.*`)

Shell: `lastClient`, `lastView.<clientId>`, `recentSearches`, `density`,
`returnTo`. Vistas: `collapsedGroups.<view>.<clientId>`, `boardCols`,
`cardFields` (kanban), `calMode`, `calFilters`, `calMini`, `calBacklog`,
`tableGroupBy`, `tableSort`, `tableCols`, `tableCardFields`, `swimlane`,
`tlScale`, `tlCollapsed.<clientId>`, `dashScope`, `myworkShowDone`,
`savedViewActive.<clientId>`, `savedViewsLocal.<clientId>` (modo local de
vistas guardadas). `prefs.migrate()` copia una sola vez `mkt.view` /
`mkt.client` del legacy sin borrarlas. `sessionStorage mkt.jump` = drill-down
del dashboard (se consume una vez con `prefs.takeJump()`).

## API v2 (todo bajo `/api/marketing`, mismo catch-all)

Sin cambios: `auth/*`, `clients` CRUD, `posts` CRUD, `reorder`, `approve`,
`request-changes`, `comments`, `users`, `activity`. Nuevo o extendido:

- **Posts:** `POST /posts/bulk-update` `{ids, patch}` o
  `{updates:[{id, publish_date}]}` (mismo cliente, max 100, devuelve
  `{ok, updated, posts, missing_ids}`); `POST /posts/bulk-delete` `{ids}`;
  `POST /posts/:id/duplicate`; `GET /posts?include=checklist` agrega
  `checklist_done/checklist_total`; `GET /posts?scope=all` (staff, modo
  Todos y Mi trabajo); `PATCH /posts/:id` acepta ademas `priority`, `tags`,
  `assignee_user_id`, `work_start`, `effort_points` y opcional
  `expected_updated_at` (responde `409 {post}` si hubo conflicto);
  `overdue` es server-managed (solo lectura).
- **Checklist (staff, ANIDADA bajo el post):**
  `GET|POST /posts/:id/checklist` (`{label, position}`),
  `PATCH|DELETE /posts/:id/checklist/:itemId` (`{label?|done?|position?}`),
  `POST /posts/:id/checklist/reorder` `{updates}`,
  `POST /posts/:id/checklist/bulk` (plantillas). No existe
  `/checklist/counts`: los conteos salen de `GET /posts?include=checklist`.
- **Notificaciones (cualquier rol, scoped a la sesion):**
  `GET /notifications?filter=all|unread|mentions|assigned&limit=&before=`
  devuelve `{notifications, unread, next_before}`;
  `GET /notifications/unread-count` (polling 60s, corre el lazySweep
  throttled 15 min); `POST /notifications/read` `{ids}|{all:true}|{ids,
  unread:true}`; `POST /notifications/delete` `{ids}`. Tipos: aprobacion,
  cambios_solicitados, comentario, mencion, asignacion, recordatorio,
  vencido, revision_pendiente. Links de aviso: `#/post/<id>`.
- **Busqueda:** `GET /search?q=` (staff) devuelve `{posts, clients}`.
- **Dashboard:** `GET /dashboard?month=YYYY-MM[&client_id=]` (staff), UNICO
  agregador (no existe `GET /stats`), un solo `env.DB.batch`, hora Cancun
  UTC-5.
- **Carga:** `GET /workload?from=&to=` (cap 12 semanas) devuelve
  `{posts, undated, capacities}` con `client_name` y `brand_color`;
  `GET /capacities`; `POST /capacities` `{assignee, weekly_points}` upsert
  (POST y no PUT a proposito: el preflight CORS no lista PUT).
- **Automatizaciones:** `GET /automations` y
  `PATCH /automations/:recipe_key` `{enabled?, config?}`. 8 recetas fijas:
  `aprobado_mueve_estado`, `aviso_cambios`, `aviso_comentario`,
  `aviso_asignacion`, `recordatorio_publicacion` (config `days_before` 1|2),
  `marcar_atrasado`, `aviso_revision_cliente`, `alerta_sin_aprobar`.
  Motor: hooks try/catch tras commit + lazySweep como mecanismo PRIMARIO
  (throttle 15 min via `mkt_kv`); el cron de GitHub es solo respaldo.
- **Vistas guardadas:** `GET /views?client_id=`, `POST /views`
  `{name, view_type, client_id|null, config, is_shared?}`,
  `PATCH /views/:id`, `DELETE /views/:id`. El frontend
  (`js/services/views.js`) traduce `base/filters` a `view_type/config`.
- **Cron:** `POST /cron` con `Authorization: Bearer MKT_CRON_SECRET` (rama
  antes del gate de sesion). Sin el secreto configurado responde 503 y no
  pasa nada: el lazySweep cubre todo.
- **Endurecimiento:** las respuestas a rol client usan la allowlist
  `CLIENT_VISIBLE_FIELDS`; `status`, `grabacion`, `assignee`, `inspo_url`,
  `priority`, `tags`, `overdue`, `work_start`, `effort_points` y la
  checklist JAMAS viajan al portal.

## Migraciones

La base es la MISMA D1 de la galeria. Ruta con espacios: SIEMPRE entre
comillas.

```bash
# 004: 100% idempotente y re-ejecutable (solo CREATE IF NOT EXISTS / INSERT OR IGNORE)
wrangler d1 execute ivae-gallery-db --remote --file="marketing/migrations/004_enterprise.sql"

# 005: los 6 ALTER de mkt_posts (priority, tags, assignee_user_id, overdue,
# work_start, effort_points). NO es re-ejecutable: si truena con
# "duplicate column name" es que ya estaba aplicada (inofensivo).
wrangler d1 execute ivae-gallery-db --remote --file="marketing/migrations/005_posts_v2_columns.sql"
```

004 crea: `mkt_notifications`, `mkt_automations` (+seed 8 recetas),
`mkt_automation_runs`, `mkt_checklist_items`, `mkt_templates`,
`mkt_saved_views`, `mkt_capacities`, `mkt_kv` (+`tz_offset`), indices
correctivos y el ledger `mkt_schema_migrations`.

## Release escalonado (checklist)

El backend es 100% aditivo: cada paso deja el sistema funcionando con el
paso anterior. Orden obligatorio:

1. **Aplicar 004** (comando arriba). Verificar:
   `wrangler d1 execute ivae-gallery-db --remote --command="SELECT name FROM mkt_schema_migrations"`.
2. **Aplicar 005.**
3. **Secreto `MKT_CRON_SECRET`** (opcional pero recomendado): mismo valor en
   CF Pages (env vars Production) y en GitHub
   (`gh secret set MKT_CRON_SECRET`). Sin el, `/cron` responde 503 y el
   lazySweep sigue siendo el mecanismo primario.
4. **Limpiar artefactos de construccion antes del push:** borrar
   `_staging-shell-core/`, `_staging-portal-cliente/` y los `*.bak-pre-*`
   (NO deben llegar a Pages: todo lo que se commitea se publica).
5. **Deploy backend + frontend** (mismo push: `[[path]].js`, `_dashboard.js`,
   los 3 HTML con `?v=4`, `sw.js` v12 y todo `marketing/js|css`). El sw.js
   v12 debe salir junto con (o antes de) los HTML.
6. **Smoke tests obligatorios post-deploy** (leccion del hotfix 57431945:
   el proyecto Pages es COMPARTIDO con la galeria):
   - **Foto servida desde una galeria PRIVADA / email-gated** (no solo
     endpoints publicos de galeria).
   - Login staff (y un usuario con `must_reset`) llega a `/marketing/app`.
   - Las 7 vistas cargan a 390px; tabla sin colision `.grid` (usa `.etable`).
   - `GET /api/marketing/notifications` responde 200 con 004 aplicada
     (y 404 limpio si se prueba un entorno sin 004: la campana se oculta).
   - Flujo aviso: campana, abrir aviso, llega a `#/post/<id>`, responder.
   - Portal: login cliente, listar, aprobar un post, pedir cambios con
     comentario; verificar que la respuesta JSON NO incluye `status` ni
     `grabacion` ni `assignee` ni `inspo_url`.
   - PATCH legacy de un post sin campos v2 (compat v1).
   - Crear/marcar un item de checklist desde el editor.
7. **Solo despues de verificar TODO:** retirar `js/app.js` y `js/client.js`
   (hoy quedan muertos en el repo como rollback; ningun HTML los carga).

## Rollback

- **Frontend:** `git revert` de `marketing/app.html`, `marketing/client.html`
  y `marketing/index.html` completos (el esqueleto v2 cambio: NO basta
  re-apuntar la linea del script). El legacy `js/app.js` / `js/client.js`
  sigue intacto en el repo y volveria a funcionar con los HTML viejos.
  Tambien revertir `marketing/css/app.css` y `marketing/js/api.js` si se
  quiere el estado v1 exacto (la version v2 es aditiva y no estorba).
- **Backend:** `git revert` de `functions/api/marketing/[[path]].js` al
  commit `f0cfec6` (router legacy) y borrar `_dashboard.js`. Las tablas 004
  y columnas 005 pueden quedarse: el backend v1 las ignora.
- **SW:** revertir `sw.js` re-cachea `/marketing/*`; mientras el frontend
  sea v1 con `?v=3` no hay conflicto.

## Desarrollo local

```bash
cd "/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted"
wrangler pages dev . --d1=DB=ivae-gallery-db --local
# Verificacion rapida de sintaxis de todos los modulos:
for f in $(find marketing/js functions/api/marketing -name "*.js"); do
  node --input-type=module --check < "$f" || echo "FALLA: $f"; done
```

Probar SIEMPRE primero a 390px (iPhone) y despues a 1024px o mas.
