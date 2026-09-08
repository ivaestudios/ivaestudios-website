-- Generador de video con IA (solo staff). Cada generación es un "job": se manda
-- a fal.ai, se consulta su estado y, al terminar, el MP4 se guarda en R2 bajo
-- marketing/video-ia/<id>.mp4. El costo se anota por marca para poder cobrarlo.
CREATE TABLE IF NOT EXISTS mkt_video_jobs (
  id            TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL REFERENCES mkt_clients(id) ON DELETE CASCADE,
  post_id       TEXT,                          -- pieza del calendario (opcional)
  tier          TEXT NOT NULL,                 -- rapido | alta
  model         TEXT NOT NULL,                 -- endpoint del proveedor
  prompt        TEXT NOT NULL,
  aspect        TEXT NOT NULL DEFAULT '9:16',
  seconds       INTEGER NOT NULL DEFAULT 5,
  status        TEXT NOT NULL DEFAULT 'queued', -- queued | running | done | error
  provider      TEXT NOT NULL DEFAULT 'fal',
  request_id    TEXT,
  status_url    TEXT,
  response_url  TEXT,
  video_key     TEXT,                          -- llave en R2 cuando status=done
  cost_usd      REAL NOT NULL DEFAULT 0,
  error         TEXT,
  created_by    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_mkt_video_jobs_client ON mkt_video_jobs(client_id, created_at);
INSERT OR IGNORE INTO mkt_schema_migrations(name) VALUES ('033_video_ia');
