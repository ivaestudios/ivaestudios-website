-- 028 — Reconciliación por contenedor (2026-08-17, investigación enterprise)
-- Meta documenta: si media_publish no responde el id, consultar el status del
-- contenedor (PUBLISHED = ya salió). Guardamos el creation_id de cada intento
-- para reanudar/reconciliar por la vía OFICIAL en vez de solo por caption.
ALTER TABLE mkt_posts ADD COLUMN publish_creation_id TEXT;
