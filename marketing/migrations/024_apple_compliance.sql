-- 024 — Cumplimiento App Store (rechazo del 6-ago-2026)
--
-- Guideline 1.2 (contenido generado por usuarios): EULA aceptado de forma
-- afirmativa, reportes de contenido y bloqueo entre usuarios.
-- Guideline 5.1.1(v) (borrado de cuenta): distinguir al DUEÑO de una marca
-- (self-signup: borra todo) del acceso INVITADO por la agencia (borra solo
-- su propio usuario) — decisión de Vianey 2026-08-07: "solo su acceso".
--
-- Todas las sentencias son idempotentes salvo los ALTER (D1 no soporta
-- IF NOT EXISTS en ADD COLUMN): si la columna ya existe, ese ALTER falla y
-- se ignora — aplicarlas una por una, no en batch.

-- ── EULA ────────────────────────────────────────────────────────────────────
ALTER TABLE mkt_users ADD COLUMN eula_version TEXT;
ALTER TABLE mkt_users ADD COLUMN eula_accepted_at TEXT;

-- ── Dueño del workspace ─────────────────────────────────────────────────────
-- NULL = marca creada por la agencia (sus usuarios son invitados).
ALTER TABLE mkt_clients ADD COLUMN owner_user_id TEXT;

-- ── Reportes de contenido ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mkt_reports (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,          -- comment | deliverable_comment | approval | post
  target_id TEXT NOT NULL,
  target_author_id TEXT,
  target_excerpt TEXT,
  client_id TEXT,
  reporter_user_id TEXT NOT NULL,
  reporter_email TEXT,
  reason TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open',   -- open | removed | dismissed
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON mkt_reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_target ON mkt_reports(target_type, target_id);

-- ── Bloqueo entre usuarios ──────────────────────────────────────────────────
-- Unidireccional: solo afecta la vista de quien bloquea.
CREATE TABLE IF NOT EXISTS mkt_blocks (
  blocker_user_id TEXT NOT NULL,
  blocked_user_id TEXT NOT NULL,
  blocked_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (blocker_user_id, blocked_user_id)
);
