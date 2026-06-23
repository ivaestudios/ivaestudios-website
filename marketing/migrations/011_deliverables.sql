-- 011_deliverables.sql
-- Entregables: contenido FINAL que el equipo sube para que el cliente lo vea y
-- descargue. Separado del calendario de planeacion (mkt_posts).
--   type 'reel'     -> video almacenado en R2 (marketing/deliverable/<id>.<ext>),
--                      calidad original, servido por /deliverables/:id/video.
--   type 'carrusel' -> link externo (Drive/Dropbox/IG); el cliente ve un boton
--                      "Ver carrusel", nunca el link crudo.
-- Agrupados por mes (YYYY-MM), por marca (client_id).

CREATE TABLE IF NOT EXISTS mkt_deliverables (
  id          TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL,
  month       TEXT NOT NULL,                 -- 'YYYY-MM'
  type        TEXT NOT NULL,                 -- 'reel' | 'carrusel'
  title       TEXT,
  link        TEXT,                          -- solo carrusel
  video_ext   TEXT,                          -- solo reel (mp4/mov/webm...), set al subir
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mkt_deliverables_client_month
  ON mkt_deliverables (client_id, month);
