-- IVAE Marketing — migration 003: per-person notes, configurable per client.
-- Mirrors the owner's Notion workflow where each client calendar has one
-- "NOTAS <persona>" column per collaborator (varies per client, e.g. Regeneris
-- uses Jairo + Natalia; another client uses Jairo + Meli).
--
-- Apply with:
--   wrangler d1 execute ivae-gallery-db --remote --file=marketing/migrations/003_per_person_notes.sql
--
-- NOTE: SQLite ALTER TABLE has no "IF NOT EXISTS" for columns, so these run
-- exactly once. If a column already exists the statement errors harmlessly and
-- can be skipped — re-run only the statements that have not yet been applied.
-- ============================================================================

-- Per-client list of people who leave notes (JSON array of short names).
-- e.g. ["Jairo","Natalia"]
ALTER TABLE mkt_clients ADD COLUMN note_labels TEXT NOT NULL DEFAULT '[]';

-- Per-post map of personName → noteText (JSON object). INTERNAL: never exposed
-- to a client viewer (same treatment as notes_team).
-- e.g. {"Jairo":"Falta el b-roll","Natalia":"Aprobar copy"}
ALTER TABLE mkt_posts ADD COLUMN notes_people TEXT NOT NULL DEFAULT '{}';

-- Seed the demo Regeneris client to match her Notion (Jairo + Natalia).
UPDATE mkt_clients SET note_labels = '["Jairo","Natalia"]' WHERE id = 'demo-regeneris';
