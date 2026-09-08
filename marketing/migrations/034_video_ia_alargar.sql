-- "Alargar" un clip: Veo puede continuar un video suyo 7 segundos más, en el
-- MISMO plano y sin corte. Encadenando se llega a unos 29 s de una sola toma.
-- parent_id apunta al clip del que salió, para poder mostrar la cadena.
ALTER TABLE mkt_video_jobs ADD COLUMN parent_id TEXT;
CREATE INDEX IF NOT EXISTS idx_mkt_video_jobs_parent ON mkt_video_jobs(parent_id);
INSERT OR IGNORE INTO mkt_schema_migrations(name) VALUES ('034_video_ia_alargar');
