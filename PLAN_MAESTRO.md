# IVAE Gallery — Plan Maestro de Pulido + Pic-Time Parity

Generado: 2026-04-24. Ámbito: cerrar TODOS los partials de Fases 1–3 y cubrir las 8 brechas vs Pic-Time identificadas en doc técnico.

## Estado tras audit (líneas exactas verificadas)

### Fase 1 — Paridad visual: **5/6 DONE, 1 PARTIAL**
- ✅ Landing cinematográfica (`gallery.html:559`, `enterGallery()` línea 883)
- ✅ Scene navigation con IntersectionObserver (`gallery.html:702-770`)
- ✅ Justified-row layout (`gallery/js/justified-layout.js`, llamado en `gallery.html:810`)
- ✅ Lightbox completo: pinch-zoom (1059), wheel zoom (1012), pan (1022), keyboard (1122), preload (964), tap-toggle (1114), counter (1134)
- ✅ Daemon dimensions (`ivae-uploader/src/main.js:65 sharp.metadata()`)
- ⚠️ **Backfill route**: existe `POST /api/photos/backfill-dimensions` (público) y `POST /api/galleries/:id/repair-dims` (admin), pero **falta** `POST /api/admin/backfill-dimensions` que barra todas las galerías.

### Fase 2 — Cover designer + branding: **6/7 DONE, 1 PARTIAL**
- ✅ Tab "Cover" con 10 plantillas clickeables (`gallery-edit.html:1496`)
- ✅ Color pickers bg/txt en vivo (líneas 1525-1532)
- ✅ Focal point drag (línea 1697)
- ✅ Watermark UI completo (líneas 475-495)
- ✅ Logo per-gallery con white/dark auto (`cover-designs.js:31-42`)
- ✅ Live preview sin save+reload
- ⚠️ **Duplicación**: admin embebe `DESIGNS` en `gallery-edit.html:1176-1445`, cliente usa `cover-designs.js`. Riesgo de drift.

### Fase 3 — Engagement: **5/6 DONE, 1 PARTIAL**
- ✅ Email gate con cookie `pic_visit_{galleryId}` (`gallery.html:382-393`, worker `952-974`)
- ✅ Visitor log table + admin view (`schema.sql:115-125`, `proofs.html:495`)
- ✅ Slideshow con audio + autoplay 4s (`gallery.html:398-419`, worker `881-920`)
- ✅ Proofing workflow completo (worker `977-1019`, `proofs.html`)
- ✅ Resend integrado (3 templates: invite, reset, expiry)
- ⚠️ **Cron**: `handleExpiryWarn` existe (worker `2564-2595`) pero no hay scheduler. Solo manual `POST /api/admin/cron-sweep`.

### 8 brechas vs Pic-Time (no implementadas)
| # | Gap | Effort | Impacto cliente |
|---|-----|--------|-----------------|
| 1 | Token-share URL `/g/{token}` (link público sin login) | S | Alto |
| 2 | ZIP download (selected/all) | M | Alto |
| 3 | Hotlink protection con TTL de signed URLs | M | Medio |
| 4 | Audit log de descargas en `gallery_events` | XS | Medio |
| 5 | OG tags per shared photo | S | Medio |
| 6 | On-the-fly burned watermark | M | Bajo (ya hay overlay CSS) |
| 7 | WebP/AVIF + responsive srcset | S | Alto (perf) |
| 8 | AI Search by face (Cloudflare AI) | L | Diferir |

---

## Olas de ejecución

### OLA A — Cerrar partials (paralelo, 3 agentes, riesgo BAJO)
- **A1 — Dedupe cover-designs**: admin importa `cover-designs.js`, eliminar `DESIGNS` inline en `gallery-edit.html`. Test: editar plantilla en cover-designs.js → admin y cliente cambian igual.
- **A2 — Cron expiración**: Cloudflare Pages Functions no soporta cron nativo. Opciones: (a) crear Worker auxiliar con cron trigger, (b) GitHub Actions cron diario que llame `/api/admin/cron-sweep` con bearer. Recomendado: (b) por simplicidad.
- **A3 — Admin backfill global**: añadir `POST /api/admin/backfill-dimensions` que itera galerías, llama lógica de `handleRepairGalleryDims` por cada una. Botón en admin/settings.

### OLA B — Top 5 gaps Pic-Time (paralelo, 5 agentes, riesgo MEDIO)
- **B1 — Token-share URL**: generar `gallery.share_token` (random 16 chars), ruta pública `/gallery/g/{token}` que renderea galería sin login. Existe `/api/galleries/{id}/by-link` ya — extender.
- **B2 — Download audit log**: `gallery_events` ya existe. Agregar event_type `download` cada vez que se descarga foto/zip. Vista admin en `/admin/analytics.html`.
- **B3 — WebP/AVIF + srcset**: en `handleConfirmUpload` generar variantes `web.webp` además de `.jpg`. Cliente: `<picture><source type="image/webp" srcset="..."></picture>`.
- **B4 — OG tags per shared photo**: ruta `/gallery/p/{photoId}` que sirve HTML con `<meta og:image>` apuntando a la foto. Útil para WhatsApp/Instagram share.
- **B5 — Hotlink protection**: las URLs `/api/photos/{id}/full` ya van por worker. Añadir TTL de 5 min en signed URLs y verificar `Referer` header coincide con dominio del gallery owner.

### OLA C — Heavy gaps (secuencial, riesgo ALTO)
- **C1 — ZIP download**: stream zip desde worker via `archiver` o `fflate`. Limit 500 fotos / 2GB. Async background job recomendado.
- **C2 — Burned watermark on-the-fly**: añadir `?wm=1` a URL `/api/photos/{id}/web`, worker compone watermark con Canvas (Cloudflare Workers no tiene Canvas nativo; usar `@cloudflare/workers-types` con Photon Wasm).
- **C3 — AI face search**: DEFERIR. Requiere indexación previa con Cloudflare AI o Rekognition. Fase 5+.

---

## Verificación end-to-end por ola

Después de cada ola:
1. `cd /tmp/ivae-work && git status && git log --oneline -10`
2. Probar en `gallery.ivaestudios.com` con galería de prueba (tu cuenta)
3. Si toca daemon, rebuild .dmg
4. Si toca D1, `wrangler d1 migrations apply` (modo `--remote`)
5. Smoke: login → crear galería → subir 3 fotos → ver como cliente → cada feature nuevo

---

## Cronograma

- **HOY**: Ola A (3 agentes paralelo, ~30 min cada uno)
- **HOY+1**: Verificar Ola A en producción, ejecutar Ola B
- **HOY+2**: Ola C si Vianey lo confirma
