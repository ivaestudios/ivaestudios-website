-- Comentarios por entregable (reel/carrusel): el CLIENTE escribe los cambios que
-- pide y el EQUIPO puede responder. Visibles para ambos (sin notas internas aquí).
CREATE TABLE IF NOT EXISTS mkt_deliverable_comments (
  id              TEXT PRIMARY KEY,
  deliverable_id  TEXT NOT NULL,
  user_id         TEXT,
  author_name     TEXT,
  author_role     TEXT,
  body            TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mkt_dlv_comments
  ON mkt_deliverable_comments (deliverable_id, created_at);
