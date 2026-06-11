# Arquitectura final (juez sintetizador)

## Resumen
Arquitectura final que toma la ESTRUCTURA de la Propuesta A (shell v2 completo como host: router por hash, store singleton, prefs namespaced, topbar con switcher de cliente, bottom-nav de 4 tabs, sheets, toasts, busqueda y campana; cada vista es un plugin lazy registrado via shell.registerView y cargado con import() dinamico solo al navegar) y la DISCIPLINA DE RIESGO de la Propuesta B (legacy app.js y client.js quedan MUERTOS en el repo como rollback instantaneo hasta el paquete de integracion; deploy escalonado compatible: 004 -> 005 -> backend que no rompe el frontend viejo -> frontend con ?v=4; lazySweep como mecanismo primario de recetas de tiempo con cron de GitHub Actions como respaldo opcional; smoke tests que incluyen servir una foto de galeria privada, leccion del hotfix 57431945). DECISION CENTRAL RESUELTA: gana el shell v2 de A sobre el app.js-como-host de B porque mobile-first real a 390px con 7+ vistas no cabe en el seg legacy de 3 tabs; el bottom-nav (Inicio, Contenido, Mi trabajo, Avisos), el FAB por vista y las capas de history para el boton atras del telefono exigen chrome nuevo. El fallback-por-vista de B es incompatible con ese shell, asi que su espiritu se preserva de otra forma: rollback de 1 linea (re-apuntar app.html a js/app.js?v=3), backend 100% aditivo y degradacion limpia (si 004 no esta aplicada la campana se oculta y el resto funciona). DEDUPLICACION (mejor de B): UN solo sheet.js (js/shell/), UN solo store, UN solo pickers.js tipado y UN SOLO motor DnD por Pointer Events en js/ui/dnd.js con modos move y resize, que elimina los 3 motores de A (calendar/dnd.js queda solo como adaptador de dominio; kanban y timeline consumen el motor directo); jamas HTML5 DnD, siempre con fallback visible Mover a. Capa de SERVICIOS de dominio de A (bulk con 1 request y reconciliacion, checklist, stats con cache, catalogo de 8 recetas, vistas guardadas, fechas ISO, esfuerzo) entre el store y api.js, con el patron unico optimistic/snapshot/rollback/toast. Backend: el catch-all unico [[path]].js se extiende en secciones delimitadas + _dashboard.js importado (sin export onRequest); 8 recetas fijas de A (superset de las 6 de B) con dedupe diario por run_key; checklist con rutas ANIDADAS bajo el post (criterio B, re-check de ownership); publicPost endurecido a allowlist CLIENT_VISIBLE_FIELDS; el GET /stats de A se ELIMINA (redundante): /dashboard es el unico agregador y services/stats.js lo cachea. Migraciones consolidadas: 004 cien por ciento idempotente y re-ejecutable (ledger, notifications, automations+seed 8, runs, checklist, templates, saved_views, capacities, kv con tz_offset de B, indices correctivos) y 005 con los 6 ALTER de A (priority, tags, assignee_user_id, overdue, work_start, effort_points): el esquema nace completo porque re-migrar es lo caro, aunque tags no tenga UI en v1. Portal cliente reescrito como app aislada js/portal/* que reusa sheet/toast del shell por import directo, con store propio EventTarget; cero endpoints nuevos, asi que se construye en paralelo al backend. Mobile-first real: cada vista disenada primero a 390px, targets 44px, 100dvh, safe-areas, pickers full-width 48px, long-press siempre con fallback visible, sheets con asa, bypass /marketing/* en sw.js que mata la disciplina manual de ?v=N para los ES modules internos. La colision .grid se mata renombrando la tabla legacy a .dgrid al absorber el CSS inline de app.html. Cada archivo pertenece a exactamente UN paquete; shell-core y backend-api arrancan hoy en paralelo (cero archivos compartidos); calendario, kanban y portal solo dependen del shell (no del backend nuevo) para maximo paralelismo. UI 100% en espanol, sin em-dashes en texto visible; toda ruta del repo entre comillas en Bash.

## Tradeoffs
TOMADO DE A (estructura): (1) Shell v2 completo como host con registerView/import() lazy, router por hash con capas de history, bottom-nav de 4 tabs, prefs mkt2 namespaced por usuario, tokens2.css separado de app.css para que shell-core no genere conflictos de merge. Razon: 99% del uso es telefono y 7+ vistas no caben en el seg legacy; el boton atras del telefono, el FAB y la campana exigen chrome nuevo. (2) Las 8 recetas de automatizacion (superset de las 6 de B: suma aviso_revision_cliente y alerta_sin_aprobar con costo marginal cero porque el motor es el mismo). (3) Busqueda global GET /search y scope=all con swimlanes (B las diferia; el costo backend es de ~10 lineas segun la auditoria y el overlay ya esta pagado por la campana). (4) Vistas guardadas en D1 y migracion superset 005 con priority/tags (B las diferia; decision: el esquema nace completo porque re-migrar es lo caro; tags queda sin UI en v1). (5) Notificaciones con 4 tabs (Todas/No leidas/Menciones/Asignadas) y deteccion de menciones. (6) Editor por ruta #/post/:id del router en vez del pushState manual de B. (7) Paquete services-domain separado (contratos sin DOM que paralelizan editor, tabla y dashboard).
TOMADO DE B (disciplina y deduplicacion): (1) UN SOLO motor DnD js/ui/dnd.js con modos move y resize, eliminando los 3 de A (calendar/dnd.js queda solo como adaptador de drop targets; kanban/dnd-pointer.js y lib/dragbar.js desaparecen del plan). (2) lazySweep como mecanismo PRIMARIO de recetas de tiempo (throttle 15 min via mkt_kv) y el cron de GitHub Actions como respaldo opcional: la app funciona sin secretos nuevos. (3) Legacy app.js y client.js quedan MUERTOS e intactos como rollback instantaneo hasta integracion-release (A los borraba en el paquete portal); rollback = re-apuntar 1 linea de script en app.html/client.html. (4) Checklist con rutas anidadas bajo /posts/:id para re-check de ownership (A las tenia planas). (5) Orden de deploy compatible: 004 -> 005 -> backend (100% aditivo, el frontend viejo sigue funcionando) -> frontend ?v=4; smoke test obligatorio que incluye servir una foto de galeria privada (leccion del hotfix 57431945). (6) overdue como flag server-managed que el PATCH resuelve solo (nunca un status nuevo: el frontend viejo jamas oculta posts). (7) Seed tz_offset en mkt_kv. (8) Calendario, kanban y portal NO dependen del backend nuevo (solo endpoints existentes): arrancan en paralelo apenas termina shell-core.
CONTRADICCIONES RESUELTAS: (a) app.js-host con fallback por vista (B) vs shell v2 (A): gana A; el fallback por vista es imposible con shell nuevo y se sustituye por rollback de archivo completo + backend aditivo + degradacion 404. (b) GET /stats (A) vs solo /dashboard (B): gana B; /stats se elimina y services/stats.js cachea /dashboard (un solo agregador, cero divergencia en definiciones de pending/overdue). (c) 6 vs 8 recetas: 8. (d) 2 vs 4 tabs de avisos: 4. (e) tokens dentro de app.css (B) vs tokens2.css (A): tokens2.css, para que app.css solo reciba la absorcion del inline y el rename .grid->.dgrid. (f) Borrar legacy en el paquete portal (A) vs conservarlo (B): se conserva hasta integracion-release, unico dueno del retiro.
RIESGOS ACEPTADOS: ~60 modulos JS sin bundler (mitigado con import() lazy por vista y bypass SW /marketing/* OBLIGATORIO, no opcional); el catch-all crece a ~2400 lineas (restriccion dura de 1 archivo; secciones delimitadas + _dashboard.js importado; si crece mas, extraer _notifications.js con el mismo patron de import); 005 no es re-ejecutable (limitacion SQLite, separada de 004 y documentada en el ledger); polling 60s en vez de SSE (unico camino razonable en Pages Functions); ventana corta de doble codigo legacy/v2 hasta el corte final; sin virtualizacion de listas (la escala de agencia lo tolera, revisar a ~500 posts por cliente); los contratos ctx/openSheet/pickFrom/dnd se CONGELAN al terminar shell-core antes de paralelizar (acoplamiento deliberado a cambio de matar las 4-5 implementaciones duplicadas que proponian los modulos).

## File plan
- BASE = /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted (ruta con espacios: SIEMPRE entre comillas en Bash)
- === PAQUETE shell-core (primero; paralelo a backend-api, cero archivos compartidos) ===
- [EDITAR] BASE/marketing/app.html: esqueleto shell v2 (#boot #topbar #subhead #viewScroll>#view #bottomnav #fabHost #sheetHost #toastHost); links tokens2.css + shell.css + app.css?v=4; script unico type=module js/main.js?v=4; eliminar las ~295 lineas de CSS inline (migran a app.css)
- [EDITAR] BASE/marketing/index.html: pref returnTo post-login, flujo must_reset (cambio de contrasena forzado), destino /marketing/app, bump ?v=4
- [EDITAR] BASE/sw.js: bypass del fetch handler para /marketing/* (espejo del bypass /gallery/*); OBLIGATORIO porque los ES modules internos se importan sin ?v=
- [EDITAR] BASE/marketing/css/app.css: absorber el CSS inline de app.html; renombrar table.grid a .dgrid (mata la colision con la utilidad .grid); .seg con overflow-x y scroll-snap; tokens --pri-* aditivos
- [NUEVO] BASE/marketing/css/tokens2.css: tokens v2 aditivos (--nav-h --topbar-h2 --subhead-h --tap 44px --sheet-radius, escala fs-1..6, elevaciones e1..4, --client-accent + color-mix, z-index 15/90/138/140/150/160, [data-density=compact]); identidad violeta/rosa intacta
- [NUEVO] BASE/marketing/css/shell.css: topbar, sub-header segmented, bottom-nav + FAB, sheets con asa, toasts, overlays de busqueda y avisos, barra offline; mobile-first con safe-areas
- [NUEVO] BASE/marketing/js/main.js: composition root; importa shell, registra vistas con import() lazy (tabla, calendario, kanban, dashboard, timeline, workload, mywork, automations, avisos, editor #/post/:id), shell.boot()
- [NUEVO] BASE/marketing/js/shell/shell.js: boot (auth gate, carga paralela clients + unread best-effort, prefs.migrate, hash inicial), chrome montado UNA vez, --client-accent validado, interceptor 401 con returnTo, online/offline, API publica registerView/setFab/setViewControls/setTabBadge
- [NUEVO] BASE/marketing/js/shell/router.js: hash #/<vista>?params y #/post/:id; mount/unmount/onParams; capas de history para que el boton atras cierre sheets/overlays antes de navegar
- [NUEVO] BASE/marketing/js/shell/store.js: store reactivo singleton (getState/set/subscribe/optimistic/emit/on) + acciones canonicas loadPosts/patchPost/createPost/removePost/upsertPost/reorder/loadUsers (ver store_contract)
- [NUEVO] BASE/marketing/js/shell/prefs.js: localStorage mkt2.<userId>.*, JSON seguro, migracion unica desde mkt.view/mkt.client sin borrar las viejas
- [NUEVO] BASE/marketing/js/shell/topbar.js: switcher de cliente con dot de marca, lupa, campana con badge, avatar con sheet de cuenta; >=1024px tabs de vista + busqueda inline; parches quirurgicos sin re-render total
- [NUEVO] BASE/marketing/js/shell/clientswitcher.js: sheet de clientes con filtro si >8, badges pending, opcion Todos los clientes (staff), CTA Nuevo cliente
- [NUEVO] BASE/marketing/js/shell/bottomnav.js: 4 tabs Inicio/Contenido/Mi trabajo/Avisos con badges, safe-area, re-tap scroll-top, render del FAB configurable por vista
- [NUEVO] BASE/marketing/js/shell/sheet.js: UNICO bottom sheet movil / popover-modal desktop, modos menu/form/picker, asa drag-to-close, focus trap, backdrop-dismiss solo en menus, capa history, pickFrom() Promise, closeAll()
- [NUEVO] BASE/marketing/js/shell/toast.js: cola max 2, accion Deshacer que ejecuta rollback, aria-live, reposicionamiento visualViewport con teclado
- [NUEVO] BASE/marketing/js/shell/icons.js: SVG estaticos (unico innerHTML permitido en toda la app)
- [NUEVO] BASE/marketing/js/shell/search.js: overlay movil / dropdown desktop, fase memoria + GET /search (staff), recientes en prefs, navegacion a #/post/:id o cambio de cliente
- [NUEVO] BASE/marketing/js/shell/notifications.js: campana + panel Avisos (polling 60s encadenado + visibilitychange + evento mutated, tabs Todas/No leidas/Menciones/Asignadas, marcar leida optimista, deep-link #/post/:id, degradacion limpia si 404)
- [NUEVO] BASE/marketing/js/ui/pickers.js: pickers tipados sobre sheet.js (status, fecha + atajos Hoy/Manana/+7/Quitar, persona staff + texto libre, plataforma, tipo, grabacion, aprobacion, prioridad, textExpand); compartidos por TODAS las vistas
- [NUEVO] BASE/marketing/js/ui/dnd.js: MOTOR UNICO de drag por Pointer Events (consolidacion de B, elimina calendar/dnd engine + kanban/dnd-pointer + lib/dragbar de A): long-press 300-400ms touch cancelable a 10px, umbral 5-6px mouse, setPointerCapture, clon fixed translate3d, elementFromPoint, auto-scroll en bordes, vibrate, Esc/pointercancel limpio, modos move y resize, callbacks de dominio; sin conocimiento de posts
- === PAQUETE backend-api (paralelo a shell-core) ===
- [EDITAR] BASE/functions/api/marketing/[[path]].js: secciones delimitadas nuevas (notifications + lazySweep, search, posts/bulk-update, posts/bulk-delete, duplicate, checklist CRUD anidado, workload, capacities, automations 8 recetas, views CRUD, cron bearer antes del gate); hooks notify()/runEventAutomations() try/catch profundidad 1 tras commit; PATCH posts ampliado (priority/tags/assignee_user_id/work_start/effort_points, overdue server-managed, 409 opcional); GET /posts ?include=checklist y ?scope=all; GET /activity?post_id=; publicPost endurecido a CLIENT_VISIBLE_FIELDS; constantes PRIORITIES/sanitizeTags; contratos existentes INTACTOS
- [NUEVO] BASE/functions/api/marketing/_dashboard.js: handleDashboard importado por el catch-all (sin export onRequest), UN env.DB.batch Q1-Q10, fechas America/Cancun UTC-5, payload con allowlist postLite
- [NUEVO] BASE/marketing/migrations/004_enterprise.sql: 100% idempotente (ver migration_sql)
- [NUEVO] BASE/marketing/migrations/005_posts_v2_columns.sql: unico archivo con ALTER (ver migration_sql)
- [NUEVO] BASE/.github/workflows/marketing-cron.yml: cron diario -> POST /api/marketing/cron con Bearer MKT_CRON_SECRET (respaldo del lazySweep; patron gallery-cron-sweep.yml)
- === PAQUETE services-domain ===
- [NUEVO] BASE/marketing/js/services/bulk.js: bulkPatch/shiftDays/bulkDelete/duplicatePost; 1 request, snapshot, reconciliacion con res.posts, rollback total
- [NUEVO] BASE/marketing/js/services/checklist.js: load con cache por post, add encadenable, toggle/rename/remove/reorder optimistas, counts 2/5 para chips
- [NUEVO] BASE/marketing/js/services/stats.js: cache 60s del payload GET /dashboard por querystring, invalidate() tras mutaciones, statsFilterToQuery para drill-down (NOTA: GET /stats eliminado, este servicio envuelve /dashboard)
- [NUEVO] BASE/marketing/js/services/automations.js: catalogo RECIPES de 8 recetas (frases es-MX, huecos, defaults, espejo del backend) + list/toggle/update
- [NUEVO] BASE/marketing/js/services/views.js: vistas guardadas (list/save/update/remove/applyView que escribe filters al store y emite view:applied), espejo localStorage de la activa
- [NUEVO] BASE/marketing/js/lib/dates.js: addDays, diffDays, startOfISOWeek, weekKey, weekRangeLabel es-MX, isWeekend, monthGridRange; complementa parseDate/ymd de api.js
- [NUEVO] BASE/marketing/js/lib/effort.js: EFFORT_DEFAULTS por content_type (reel 3, tiktok 3, carrusel 2, pauta 2, experiencia 2, tratamientos 2, informativo 1, historia 1, foto 1), effortOf, normalizeAssignee, aggregateByPersonWeek, loadLevel 80/100
- === PAQUETE view-tabla ===
- [NUEVO] BASE/marketing/js/views/table.js + BASE/marketing/js/table/columns.js + BASE/marketing/js/table/groups.js + BASE/marketing/js/table/selection.js + BASE/marketing/js/table/quickadd.js + BASE/marketing/css/table.css: vista Tabla enterprise, namespace .etable, grupos colapsables con battery, edicion inline tipada, seleccion masiva, quick-add, tarjetas-fila a 390px
- === PAQUETE view-calendario (flagship) ===
- [NUEVO] BASE/marketing/js/calendar/index.js + state.js + data.js + month.js + week.js + agenda.js + minimonth.js + dnd.js (SOLO adaptador de drop targets sobre ui/dnd.js) + backlog.js + quickcreate.js + filters.js + BASE/marketing/css/calendar.css: Mes/Semana desktop, Agenda + mini-mes a 390px, backlog Sin fecha, quick-create, filtros persistentes, namespace .mcal-*
- === PAQUETE view-kanban ===
- [NUEVO] BASE/marketing/js/views/kanban.js + BASE/marketing/js/kanban/card.js + battery.js + quick-add.js + move-sheet.js + BASE/marketing/css/kanban.css: 8 columnas + bucket Otros, position sparse, battery sticky, colapso a rail, swimlanes en modo Todos, drag via ui/dnd.js compartido + sheet Mover a universal
- === PAQUETE view-dashboard ===
- [NUEVO] BASE/marketing/js/views/dashboard.js + BASE/marketing/js/views/dash-widgets.js + BASE/marketing/css/dashboard.css: vista Inicio/Resumen, GET /dashboard unico, drill-down universal, scope cliente/agencia, namespace .dash-
- === PAQUETE view-timeline-workload ===
- [NUEVO] BASE/marketing/js/views/timeline.js + BASE/marketing/js/views/workload.js + BASE/marketing/css/timeline.css: Timeline (Gantt CSS Grid desktop con drag/resize via ui/dnd.js solo pointer:fine; lista con pista de 7 celdas a 390px) + Carga (puntos por semana ISO, semaforo 80/100 siempre con numero, drill-down accionable, capacidades); namespaces .tl-/.wl-
- === PAQUETE feature-mywork-automations ===
- [NUEVO] BASE/marketing/js/views/mywork.js + BASE/marketing/js/views/automations.js + BASE/marketing/css/mywork.css: Mi trabajo por assignee_user_id cross-cliente con vencidos y badge via setTabBadge + pagina de 8 recetas con switch y config minima
- === PAQUETE editor-post ===
- [NUEVO] BASE/marketing/js/editor/editor.js + autosave.js + fields.js + tab-contenido.js + tab-guion.js + tab-checklist.js + tab-conversacion.js + tab-actividad.js + templates.js + actions.js + BASE/marketing/css/editor.css: item card #/post/:id, sheet full-screen movil / modal desktop, 5 tabs lazy, autosave parcial con keepalive y 409, chips rapidos, duplicar, plantillas builtin, eliminar; expone el deep-link que usan busqueda y avisos
- === PAQUETE portal-cliente ===
- [REESCRIBIR] BASE/marketing/client.html: shell estatico v2; carga css/app.css?v=4 + css/portal.css + js/portal/main.js; CSS inline eliminado; ya NO carga js/client.js
- [NUEVO] BASE/marketing/css/portal.css + BASE/marketing/js/portal/main.js + store.js (EventTarget aislado) + igcard.js + inbox.js + progress.js + agenda.js + detail.js + thread.js: portal premium (tarjetas IG, aprobar one-tap con celebracion en nodo vivo, pedir cambios con comentario obligatorio conservando Aprobar, progreso del mes, detalle ruta #post=, agenda con Sin fecha); reusa js/shell/sheet.js y toast.js por import, cero endpoints nuevos
- === PAQUETE integracion-release ===
- [EDITAR] BASE/marketing/README.md: arquitectura, contrato ctx, catalogo de prefs, orden de deploy (004 -> 005 -> secreto MKT_CRON_SECRET en CF Pages y GitHub -> backend -> frontend ?v=4), smoke tests (incluida foto de galeria privada)
- [ELIMINAR tras verificacion E2E] BASE/marketing/js/app.js y BASE/marketing/js/client.js: quedan MUERTOS e intactos durante toda la construccion como rollback de 1 linea (criterio B); solo este paquete los retira

## Build packages
### [shell-core] FUNDACION, se construye primero (en paralelo con backend-api, cero archivos compartidos). Shell v2 de A con la deduplicacion de B: app.html nuevo esqueleto, tokens2.css, shell.css, main.js, todo js/shell/* (shell, router por hash con capas de history, store con acciones canonicas, prefs mkt2 con migracion, topbar, clientswitcher, bottomnav+FAB, sheet UNICO, toast con Deshacer, icons, search, notifications UI) y las DOS primitivas compartidas js/ui/pickers.js y js/ui/dnd.js (motor unico Pointer Events, modos move/resize). Consolida app.css (absorbe el inline, .grid->.dgrid), api.js aditivo (PRIORITIES, priorityBadge, NOTIF_TYPE_LABELS), sw.js con bypass /marketing/*, index.html con returnTo y must_reset. CONGELA los contratos ctx/registerView/openSheet/pickFrom/dnd que consumen todos los demas paquetes. Degrada limpio si los endpoints nuevos no existen (campana oculta con 404). El legacy js/app.js NO se toca: rollback = re-apuntar app.html.
- files: /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/app.html, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/index.html, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/sw.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/css/app.css, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/css/tokens2.css, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/css/shell.css, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/api.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/main.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/shell/shell.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/shell/router.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/shell/store.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/shell/prefs.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/shell/topbar.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/shell/clientswitcher.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/shell/bottomnav.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/shell/sheet.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/shell/toast.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/shell/icons.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/shell/search.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/shell/notifications.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/ui/pickers.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/ui/dnd.js
- depende de: nada
### [backend-api] TODO el servidor, paralelo a shell-core (cero archivos en comun). Unico dueno del catch-all: notifications + lazySweep throttled (primario) con 4 filtros, search, bulk-update/bulk-delete con SELECT IN previo, duplicate, checklist CRUD anidado bajo el post, workload + capacities (POST no PUT), automations GET/PATCH de 8 recetas con hooks try/catch profundidad 1 y dedupe run_key, views CRUD, cron bearer antes del gate de sesion, dashboard via _dashboard.js importado (UN env.DB.batch, hora Cancun UTC-5), PATCH posts ampliado (priority/tags/assignee_user_id/work_start/effort_points, overdue server-managed, 409 opcional), GET /posts ?include=checklist y ?scope=all, GET /activity?post_id=, publicPost endurecido a CLIENT_VISIBLE_FIELDS. Migraciones 004 (idempotente) y 005 (ALTERs). 100% ADITIVO: el frontend viejo sigue funcionando tras este deploy. Smoke obligatorio post-deploy: foto de galeria privada, aprobar desde portal, GET /notifications con y sin 004.
- files: /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/functions/api/marketing/[[path]].js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/functions/api/marketing/_dashboard.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/migrations/004_enterprise.sql, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/migrations/005_posts_v2_columns.sql, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/.github/workflows/marketing-cron.yml
- depende de: nada
### [services-domain] Capa de servicios de dominio sobre store+api, solo contratos sin DOM: bulk (1 request masivo, snapshot, reconciliacion con res.posts), checklist con cache y counts, stats (cache 60s del payload GET /dashboard; decision: el GET /stats de A fue eliminado), catalogo de 8 recetas espejo del backend, vistas guardadas con applyView, matematica de fechas ISO es-MX (lib/dates) y regla de esfuerzo (lib/effort: EFFORT_DEFAULTS por tipo, loadLevel 80/100).
- files: /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/services/bulk.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/services/checklist.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/services/stats.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/services/automations.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/services/views.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/lib/dates.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/lib/effort.js
- depende de: shell-core, backend-api
### [view-tabla] Vista Tabla enterprise (namespace .etable, JAMAS .grid): grupos colapsables Mes/Estado con battery bar y bucket Otros, edicion inline tipada via ui/pickers, sort por columna client-side dentro de cada grupo, seleccion multiple (shift-click desktop, long-press movil con fallback visible) + barra de acciones masivas via services/bulk, quick-add por grupo con herencia de defaults, columnas de notas dinamicas por note_labels, tarjetas-fila a 390px con 2 chips configurables, chips de vistas guardadas via services/views.
- files: /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/views/table.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/table/columns.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/table/groups.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/table/selection.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/table/quickadd.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/css/table.css
- depende de: shell-core, services-domain
### [view-calendario] Vista Calendario flagship (namespace .mcal-*): Mes/Semana desktop, Agenda + mini-mes navegable a 390px, pills por status con label textual, quick-create inline y por FAB, backlog Sin fecha (panel desktop / sheet movil), filtros persistentes con chips removibles. El drag consume el motor js/ui/dnd.js del shell; calendar/dnd.js es SOLO el adaptador de dominio (drop targets celda/mini-mes/backlog, hover 600ms en flechas cambia de mes); fallback universal Mover a fecha. 100% endpoints EXISTENTES (posts, reorder, PATCH): NO depende de backend-api y arranca apenas termina shell-core. Durante drag activo suprime re-renders.
- files: /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/calendar/index.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/calendar/state.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/calendar/data.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/calendar/month.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/calendar/week.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/calendar/agenda.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/calendar/minimonth.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/calendar/dnd.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/calendar/backlog.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/calendar/quickcreate.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/calendar/filters.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/css/calendar.css
- depende de: shell-core
### [view-kanban] Tablero v2: 8 columnas desde STATUS_ORDER + bucket Otros (fix posts invisibles), position sparse pasos 1000 con renormalizacion en el mismo batch via store.reorder, battery bar sticky de navegacion sincronizada por IntersectionObserver, colapso a rail vertical persistido, quick-add encadenable, modo Todos los clientes con swimlanes en-columna (usa ?scope=all si existe, fallback multi-fetch), snap horizontal 88vw con peek a 390px. Drag via js/ui/dnd.js compartido (sin motor propio) + sheet Mover a como fallback universal y ruta de teclado. Endpoints existentes: NO depende de backend-api.
- files: /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/views/kanban.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/kanban/card.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/kanban/battery.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/kanban/quick-add.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/kanban/move-sheet.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/css/kanban.css
- depende de: shell-core
### [view-dashboard] Vista Inicio/Resumen (namespace .dash-): UN fetch a GET /dashboard via services/stats, contadores 2x2 tocables con drill-down (sessionStorage mkt.jump + navigate), pipeline battery con leyenda textual siempre visible, mini-listas Por aprobar / Proximos 7 dias / Atrasados con Reprogramar optimista, donut SVG por plataforma, racha de actividad, scope Cliente/Agencia con cards por cliente ordenadas por urgencia. Builders puros en dash-widgets.js.
- files: /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/views/dashboard.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/views/dash-widgets.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/css/dashboard.css
- depende de: shell-core, services-domain, backend-api
### [view-timeline-workload] Dos vistas staff (namespaces .tl-/.wl-): Timeline (Gantt ligero CSS Grid desktop con drag/resize via ui/dnd.js modo resize SOLO pointer:fine; a 390px lista agrupada por responsable con pista de 7 celdas, edicion via sheet con inputs date nativos; barras work_start->publish_date coloreadas por status; chip Sin fecha con Programar) y Carga (GET /workload, agregacion por semana ISO en lib/effort.js, barras verde/ambar/rojo SIEMPRE con numero visible, drill-down accionable Mover fecha / Reasignar / Abrir, sheet de Capacidades con upsert POST).
- files: /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/views/timeline.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/views/workload.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/css/timeline.css
- depende de: shell-core, services-domain, backend-api
### [feature-mywork-automations] Mi trabajo (posts cross-cliente por assignee_user_id via ?scope=all, seccion de vencidos, badge en bottom-nav via setTabBadge) + pagina de Automatizaciones (8 recetas fijas como cards con frase es-MX, switch 44px, select nativo days_before, PATCH optimista). Completa el pilar notificaciones+automatizaciones cuya UI de campana vive en shell-core y cuyo motor vive en backend-api.
- files: /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/views/mywork.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/views/automations.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/css/mywork.css
- depende de: shell-core, services-domain, backend-api
### [editor-post] Item card estilo Monday en ruta #/post/:id (el deep-link que usan busqueda y avisos): sheet full-screen movil / modal desktop, header con chips rapidos status/aprobacion/fecha (2 taps), 5 tabs lazy (Contenido, Guion con contadores IG, Checklist con plantillas por tipo y celebracion al 100%, Conversacion con toggle inequivoco Solo equipo / Visible para cliente, Actividad via GET /activity?post_id=), autosave parcial por campos dirty con debounce 800ms + flush keepalive en pagehide + manejo de 409, duplicar con switches, plantillas builtin, eliminar con confirm. Sustituye al drawer legacy.
- files: /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/editor/editor.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/editor/autosave.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/editor/fields.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/editor/tab-contenido.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/editor/tab-guion.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/editor/tab-checklist.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/editor/tab-conversacion.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/editor/tab-actividad.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/editor/templates.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/editor/actions.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/css/editor.css
- depende de: shell-core, services-domain, backend-api
### [portal-cliente] Portal premium v2 estilo Planable, app aislada: feed de tarjetas preview Instagram (placeholder tintado por tipo, caption real con line-clamp), aprobar one-tap con celebracion en nodo vivo ANTES del sync (fix bug v1), pedir cambios via sheet con comentario obligatorio CONSERVANDO el boton Aprobar, badge de progreso del mes con bateria, agenda con seccion Sin fecha (fix posts inalcanzables), detalle como ruta #post= con timeline de decisiones (data.approvals antes ignorado), hilo de comentarios. Store propio EventTarget; reusa js/shell/sheet.js y toast.js por import. CERO endpoints nuevos: NO depende de backend-api. js/client.js NO se toca (rollback inmediato re-apuntando client.html, criterio B).
- files: /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/client.html, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/css/portal.css, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/portal/main.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/portal/store.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/portal/igcard.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/portal/inbox.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/portal/progress.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/portal/agenda.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/portal/detail.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/portal/thread.js
- depende de: shell-core
### [integracion-release] Cierre y UNICO dueno del retiro del legacy: documentar en README la arquitectura, el contrato ctx y el catalogo de prefs; verificar bump ?v=4 en los 3 HTML y bypass SW activo; checklist de deploy (aplicar 004 y luego 005 a D1 remota con rutas entre comillas -> secreto MKT_CRON_SECRET en CF Pages y GitHub -> deploy backend -> deploy frontend); smoke tests E2E: login staff con must_reset, las 7 vistas a 390px, flujo aviso-abrir-responder, aprobar y pedir cambios desde portal, foto servida desde galeria privada (leccion hotfix 57431945), vista Tabla sin colision .grid, GET /notifications con y sin 004. Solo tras verificar TODO: eliminar js/app.js y js/client.js.
- files: /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/README.md, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/app.js, /Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted/marketing/js/client.js
- depende de: shell-core, backend-api, services-domain, view-tabla, view-calendario, view-kanban, view-dashboard, view-timeline-workload, feature-mywork-automations, editor-post, portal-cliente

## Store contract
js/shell/store.js, singleton ES module (estructura de A + acciones canonicas de B). ESTADO: { me:{id,email,name,role,client_id}, clients:[{id,name,slug,brand_color,instagram_handle,note_labels,archived,counts:{posts,pending}}], activeClientId:string|'todos', posts:[shapePost del cliente activo, + priority/tags/assignee_user_id/overdue/work_start/effort_points tras 005], users:null|[] (cache lazy GET /users), view:string, params:{}, filters:{}, search:'', unreadCount:int, online:bool, loading:bool, booted:bool }.

API: getState(); set(patch,{silent}); subscribe(keys[]|'*',fn)->unsub (notifica (key,value,prev)); optimistic(applyFn)->rollbackFn (snapshot superficial de las claves tocadas); emit(evt,payload)/on(evt,fn)->off.

ACCIONES (UNICA via de mutacion; patron oficial: optimista -> fetch -> exito: reconciliar con la respuesta + emit + refreshClientCounts best-effort | error: rollback + toast 'No se pudo guardar, intenta de nuevo.'): loadPosts(clientId|'todos'), patchPost(id,{solo campos dirty; mata el PATCH full-payload del drawer legacy}), createPost(d) (normaliza created.post||created), removePost(id), upsertPost(p), reorder(updates) (POST /posts/reorder; position sparse pasos de 1000, renormaliza en el mismo batch), loadUsers(). Bulk/checklist/stats/automations/views delegan en js/services/* que usan estas primitivas.

EVENTOS DE DOMINIO: 'client:changed', 'posts:changed' (ANTES de procesarlo la vista llama sheet.closeAll(): regla anti popovers huerfanos), 'post:updated' {id,fields}, 'post:created', 'post:deleted', 'mutated' (refetch unread-count), 'notifications:read', 'view:applied'.

PREFS (js/shell/prefs.js): namespace mkt2.<userId>.<clave>, JSON seguro. Shell: lastClient, lastView.<clientId>, recentSearches(max 8), density, returnTo. Reservadas para vistas: collapsedGroups.<view>.<clientId>, boardCols, calMode, calFilters, calMini, tableSort, tableCols, cardFields, swimlane, tlScale, tlCollapsed.<clientId>, dashScope, savedViewActive.<clientId>. migrate() copia UNA vez mkt.view/mkt.client sin borrar las viejas (rollback posible). sessionStorage mkt.jump (drill-down del dashboard, se consume y borra una vez).

EFIMERO (memoria del modulo, JAMAS en store ni localStorage): selecciones multiples, ancla shift-click, picker abierto, flag dragActive (durante drag activo la vista SUPRIME todo re-render y re-renderiza al soltar).

CONTRATO ctx entregado a cada vista en mount(el,ctx): { store, prefs, router:{navigate,current}, sheet:{openSheet,pickFrom,closeAll}, pickers, dnd (motor js/ui/dnd.js), toast, setFab, setViewControls, setTabBadge, openEditor(id,{tab,commentId}), selectClient(id), icons }. Firma de vista: registerView({id,label,icon,mount(el,ctx),unmount?(),onParams?(params)}).

REGLAS DURAS: las vistas nunca tocan localStorage ni location.hash directo (todo via prefs y router); nunca importan otra vista ni el app.js legacy; todo dato de usuario via textContent (patron el() de api.js; innerHTML SOLO los SVG de icons.js); el frontend nunca envia client_id para rol client; hrefs solo http/https validados con new URL(); rol client jamas entra a app.html (gate en boot).

PORTAL: store PROPIO js/portal/store.js (EventTarget) totalmente aislado; importa solo api.js + js/shell/sheet.js + js/shell/toast.js. Cero estado compartido entre app de equipo y portal.

## API spec
Todo bajo /api/marketing en el catch-all unico functions/api/marketing/[[path]].js (restriccion dura). Cookie mkt_session intacta, errores {error:string}, rutas literales ANTES de matchers :id (los ids son 32 hex: 'bulk-update' no colisiona), gate isStaff + re-check de client_id dentro de cada handler, escrituras multi-fila con env.DB.batch, logActivity best-effort. EXISTENTES INTACTOS: auth/* (PBKDF2, must_reset), clients CRUD, posts CRUD, reorder, approve, request-changes, comments, users, activity, definicion canonica de counts.pending.

== POSTS (extensiones) ==
POST /posts/bulk-update (staff): {ids:[1..100], patch:{status?,publish_date?,shift_days?,priority?,grabacion?,assignee?,assignee_user_id?,platform?,content_type?,client_visible?,tags_add?,tags_remove?}} | {updates:[{id,publish_date}]}. SELECT IN previo valida existencia y pertenencia a UN solo client_id (400 con ids invalidos, mejora sobre el no-op de reorder); enums validados; batch atomico; 1 logActivity -> {ok,updated,posts:[shapePost],missing_ids:[]}
POST /posts/bulk-delete (staff): {ids} -> {ok,deleted} (FK cascade limpia comments/approvals/checklist)
POST /posts/:id/duplicate (staff): {include_checklist?,include_script?} -> 201 shapePost (titulo + ' (copia)', status idea, approval pending, publish_date NULL, position al final, checklist done=0; NO copia comments/approvals)
GET /posts/:id EXTENDIDO: + checklist:[] ordenada por position para staff; respuesta a rol client SIN CAMBIOS
GET /posts EXTENDIDO: ?include=checklist agrega checklist_done/checklist_total; staff sin client_id (?scope=all) devuelve posts de todos los clientes no archivados (modo Todos + Mi trabajo); rol client sigue forzado por resolveClientScope
PATCH /posts/:id EXTENDIDO: acepta priority (enum), tags (sanitizeTags: max 12, 30 chars, dedupe NOCASE), assignee_user_id (debe existir activo o null; el server copia name a assignee texto para compat), work_start (regex fecha|null), effort_points (0-20|null); opcional expected_updated_at -> 409 {post}. overdue es SOLO lectura: el server lo limpia cuando el PATCH resuelve el atraso (status publicado o fecha futura)
GET /activity EXTENDIDO: ?post_id= (tab Actividad del editor); verbos nuevos post.duplicate, post.bulk_update, checklist.*

== CHECKLIST (staff; ANIDADO bajo el post para re-check de ownership, criterio B) ==
POST /posts/:id/checklist {label 1..200} -> 201 {item}
PATCH /posts/:id/checklist/:itemId {label?,done?:0|1,position?} (done=1 setea done_by/done_at; done=0 los limpia) -> {item}
DELETE /posts/:id/checklist/:itemId -> {ok}
POST /posts/:id/checklist/reorder {updates:[{id,position}]} -> {ok}
POST /posts/:id/checklist/bulk {items:[{label,position}]} -> {ok,items} (plantillas)

== NOTIFICACIONES (cualquier rol; scoped SIEMPRE a session.user_id, jamas del body) ==
GET /notifications?filter=all|unread|mentions|assigned&limit=50&before=<created_at> -> {notifications:[{id,type,body,link,post_id,comment_id,client_id,actor_name,read_at,created_at}], unread, next_before} (body YA resuelto server-side; corre lazySweep throttled)
GET /notifications/unread-count -> {unread} (polling 60s; tambien corre lazySweep throttled 15min via mkt_kv)
POST /notifications/read {ids:[]} | {all:true} | {ids,unread:true} -> {ok,marked}
POST /notifications/delete {ids:[]} -> {ok}
Si 404 (004 no aplicada): el shell oculta campana y tab Avisos (degradacion limpia)

== BUSQUEDA ==
GET /search?q= (staff, 403 a client) -> {posts:[postLite+client_name], clients:[{id,name,instagram_handle,brand_color}]} LIKE title/caption/name/handle LIMIT 20

== DASHBOARD / WORKLOAD (staff) ==
GET /dashboard?month=YYYY-MM[&client_id=] via _dashboard.js: UN env.DB.batch Q1-Q10, hora Cancun UTC-5 -> {scope,month,today,counters:{pending,week,overdue,monthTotal,noDate},pipeline,approvals:{count,items[postLite x5]},week,overdue:{count,items},platforms,activity:{streak,days[14]},clients?:[solo scope global]}. postLite = allowlist {id,title,publish_date,status,approval_state,platform,content_type,client_id}. NOTA: UNICO agregador; el GET /stats de la propuesta A se ELIMINA y services/stats.js cachea este payload
GET /workload?from=&to= (cap 12 semanas) -> {from,to,posts[+client_name,brand_color,work_start,effort_points],undated[cap 100],capacities[]}; agregacion por semana SOLO en frontend (una fuente de la regla de reparto)
GET /capacities -> [{assignee,weekly_points}]; POST /capacities {assignee<=60,weekly_points 0-100} upsert ON CONFLICT (POST y no PUT: el preflight CORS actual no lista PUT)

== AUTOMATIZACIONES (staff; 8 recetas fijas, cero builder) ==
GET /automations -> [{recipe_key,enabled,config,updated_at}]
PATCH /automations/:recipe_key {enabled?,config?} (key contra catalogo de 8; config sanitizada, days_before solo 1|2) -> {automation}
Recetas: aprobado_mueve_estado, aviso_cambios, aviso_comentario, aviso_asignacion (solo si cambio assignee_user_id, nunca autoasignacion), recordatorio_publicacion (config days_before), marcar_atrasado (overdue=1 + aviso 1/dia), aviso_revision_cliente, alerta_sin_aprobar
Hooks internos (no rutas; try/catch tras commit, profundidad 1 anti-loop, dedupe diario run_key INSERT OR IGNORE): handleApprovalDecision, handleAddComment (cliente internal=0, comentario truncado 140), handlePatchPost. notifyUsers() fan-out: assignee_user_id + admins activos, excluye actor, dedupe; rol client no recibe avisos en v1
lazySweep(env) (mecanismo PRIMARIO, throttle 15 min via mkt_kv, colgado de notifications/unread-count): recordatorios, marcado overdue, pruning (notifications >120d, runs >30d, sesiones expiradas)

== VISTAS GUARDADAS (staff) ==
GET /views?client_id= -> {views: propias + compartidas}; POST /views {name 1..60,view_type,client_id|null,config<=8KB,is_shared?} -> 201 (user_id SIEMPRE de la sesion); PATCH /views/:id (owner, o admin si is_shared) -> {view}; DELETE /views/:id -> {ok}

== CRON ==
POST /cron (SIN sesion; Authorization: Bearer env.MKT_CRON_SECRET; rama ANTES del gate de sesion, junto a /auth/login): ejecuta lazySweep completo + poda -> {ok,ran,pruned}. Respaldo del lazySweep: la app funciona sin el

== ENDURECIMIENTO ==
publicPost -> allowlist explicita CLIENT_VISIBLE_FIELDS (id, client_id, title, content_type, publish_date, platform, caption, hook, body, cta, hashtags, video_url, client_visible, approval_state, position, created_at, updated_at). Cierra la fuga actual de status/grabacion/assignee/inspo_url al portal; priority/tags/overdue/work_start/effort_points/checklist JAMAS viajan al cliente. Nada nuevo entra al portal por accidente.

## Migration SQL (borrador del juez)
```sql
-- ============================================================
-- 004_enterprise.sql  (100% IDEMPOTENTE y re-ejecutable: solo CREATE IF NOT EXISTS / INSERT OR IGNORE, cero ALTER)
-- Aplicar (ruta con espacios SIEMPRE entre comillas):
--   wrangler d1 execute ivae-gallery-db --remote --file="marketing/migrations/004_enterprise.sql"
-- ============================================================
CREATE TABLE IF NOT EXISTS mkt_schema_migrations(name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')));
INSERT OR IGNORE INTO mkt_schema_migrations(name) VALUES ('001_init'),('002_seed_demo'),('003_per_person_notes'),('004_enterprise');

-- Notificaciones: body RESUELTO al escribir; client_id/post_id/comment_id SIN FK (criterio mkt_activity: sobreviven borrados)
CREATE TABLE IF NOT EXISTS mkt_notifications(
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES mkt_users(id) ON DELETE CASCADE,
  client_id TEXT, post_id TEXT, comment_id TEXT,
  type TEXT NOT NULL, actor_name TEXT, body TEXT NOT NULL, link TEXT,
  read_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_mkt_notif_user ON mkt_notifications(user_id, read_at, created_at);
CREATE INDEX IF NOT EXISTS idx_mkt_notif_created ON mkt_notifications(created_at);

-- 8 recetas fijas con toggle (catalogo de frases en codigo, keys identicas back/front)
CREATE TABLE IF NOT EXISTS mkt_automations(
  recipe_key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  config TEXT NOT NULL DEFAULT '{}',
  updated_by TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
INSERT OR IGNORE INTO mkt_automations(recipe_key, enabled, config) VALUES
 ('aprobado_mueve_estado',1,'{}'),('aviso_cambios',1,'{}'),('aviso_comentario',1,'{}'),('aviso_asignacion',1,'{}'),
 ('recordatorio_publicacion',1,'{"days_before":1}'),('marcar_atrasado',1,'{}'),('aviso_revision_cliente',1,'{}'),('alerta_sin_aprobar',1,'{}');

-- Dedupe: run_key = '<recipe>:<post_id>:<YYYY-MM-DD>'; INSERT OR IGNORE y solo notificar si inserto
CREATE TABLE IF NOT EXISTS mkt_automation_runs(
  run_key TEXT PRIMARY KEY, post_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));

-- Checklist interna por post (JAMAS viaja al portal cliente)
CREATE TABLE IF NOT EXISTS mkt_checklist_items(
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  post_id TEXT NOT NULL REFERENCES mkt_posts(id) ON DELETE CASCADE,
  label TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL DEFAULT 0,
  done_by TEXT REFERENCES mkt_users(id) ON DELETE SET NULL, done_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_mkt_checklist_post ON mkt_checklist_items(post_id, position);

-- Plantillas custom por cliente (builtin viven en codigo; tabla habilita v1.5 sin re-migrar)
CREATE TABLE IF NOT EXISTS mkt_templates(
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  client_id TEXT REFERENCES mkt_clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL, content_type TEXT NOT NULL DEFAULT 'reel', config TEXT NOT NULL DEFAULT '{}',
  created_by TEXT REFERENCES mkt_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_mkt_templates_client ON mkt_templates(client_id);

-- Vistas guardadas (persistencia confiable en D1; localStorage solo cachea la activa)
CREATE TABLE IF NOT EXISTS mkt_saved_views(
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES mkt_users(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES mkt_clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL, view_type TEXT NOT NULL DEFAULT 'tabla', config TEXT NOT NULL DEFAULT '{}',
  is_shared INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_mkt_saved_views_user ON mkt_saved_views(user_id, position);
CREATE INDEX IF NOT EXISTS idx_mkt_saved_views_client ON mkt_saved_views(client_id, is_shared);

-- Capacidad semanal por persona (vista Carga)
CREATE TABLE IF NOT EXISTS mkt_capacities(
  assignee TEXT PRIMARY KEY COLLATE NOCASE,
  weekly_points INTEGER NOT NULL DEFAULT 10,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')));

-- KV utilitaria: 'lazy_sweep_at' (throttle 15 min) y 'tz_offset' (Cancun UTC-5 fijo, sin DST)
CREATE TABLE IF NOT EXISTS mkt_kv(key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '');
INSERT OR IGNORE INTO mkt_kv(key, value) VALUES ('tz_offset', '-300 minutes');

-- Indices correctivos (auditoria: full-scan de /activity, sweep cross-cliente, N+1 de clientCounts)
CREATE INDEX IF NOT EXISTS idx_mkt_posts_publish ON mkt_posts(publish_date);
CREATE INDEX IF NOT EXISTS idx_mkt_activity_created ON mkt_activity(created_at);
CREATE INDEX IF NOT EXISTS idx_mkt_activity_post ON mkt_activity(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mkt_posts_pending ON mkt_posts(client_id) WHERE approval_state IN ('pending','changes') AND client_visible = 1;

-- ============================================================
-- 005_posts_v2_columns.sql  (UNICO archivo con ALTER, aplicar DESPUES de 004)
-- Re-run muere en "duplicate column name" = ya estaba aplicada (inofensivo, mismo caveat que 003)
-- ============================================================
ALTER TABLE mkt_posts ADD COLUMN priority TEXT NOT NULL DEFAULT 'media';        -- enum JS baja|media|alta|urgente, sin CHECK SQL (patron status)
ALTER TABLE mkt_posts ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';               -- JSON array sanitizado server-side; UI en v1.1, esquema listo hoy
ALTER TABLE mkt_posts ADD COLUMN assignee_user_id TEXT REFERENCES mkt_users(id) ON DELETE SET NULL; -- assignee TEXT libre se CONSERVA (compat)
ALTER TABLE mkt_posts ADD COLUMN overdue INTEGER NOT NULL DEFAULT 0;            -- server-managed, NUNCA editable por HTTP; flag y no status (el frontend viejo jamas oculta posts)
ALTER TABLE mkt_posts ADD COLUMN work_start TEXT;                               -- YYYY-MM-DD o NULL (timeline)
ALTER TABLE mkt_posts ADD COLUMN effort_points INTEGER;                         -- 0-20 o NULL = default por tipo (workload)
CREATE INDEX IF NOT EXISTS idx_mkt_posts_assignee ON mkt_posts(assignee_user_id, publish_date);
INSERT OR IGNORE INTO mkt_schema_migrations(name) VALUES ('005_posts_v2_columns');
```
