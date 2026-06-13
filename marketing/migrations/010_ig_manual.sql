-- 010: captura manual de resultados de Instagram por marca y mes.
-- Bridge mientras Meta aprueba el Advanced Access (App Review). El reporte
-- mensual usa estos números si la marca no tiene conexión API funcional.
CREATE TABLE IF NOT EXISTS mkt_ig_manual (
  client_id     TEXT NOT NULL,
  month         TEXT NOT NULL,           -- 'YYYY-MM'
  followers     INTEGER,
  reach         INTEGER,
  interactions  INTEGER,
  posts         INTEGER,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (client_id, month)
);
