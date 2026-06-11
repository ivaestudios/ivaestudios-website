-- ============================================================
-- IVAE Marketing — migration 005: columnas v2 de mkt_posts.
--
-- UNICO archivo con ALTER (separado para que 004 sea 100%
-- re-ejecutable). Aplicar DESPUES de 004_enterprise.sql:
--   wrangler d1 execute ivae-gallery-db --remote --file="marketing/migrations/005_posts_v2_columns.sql"
--
-- ONE-SHOT (mismo caveat que 003): SQLite no tiene
-- "ADD COLUMN IF NOT EXISTS", asi que estos ALTER corren
-- exactamente una vez. Un re-run muere con
-- "duplicate column name" = la migracion YA estaba aplicada
-- (inofensivo: no deja la base a medias, cada sentencia es
-- atomica). Si solo fallan algunas, re-ejecutar unicamente las
-- sentencias que falten.
--
-- Enums (priority) SIN CHECK SQL: se validan en JS (patron de
-- status/content_type del esquema 001).
-- ============================================================

-- Prioridad del contenido: 'baja' | 'media' | 'alta' | 'urgente'.
ALTER TABLE mkt_posts ADD COLUMN priority TEXT NOT NULL DEFAULT 'media';

-- Tags: JSON array de strings, sanitizado server-side (max 12 de 30
-- chars, dedupe NOCASE). Sin UI en v1; el esquema nace completo
-- porque re-migrar es lo caro.
ALTER TABLE mkt_posts ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';

-- Asignado tipado (alimenta avisos y Mi trabajo). El campo assignee
-- TEXT libre SE CONSERVA por compatibilidad: al escribir
-- assignee_user_id el server copia el name del usuario a assignee.
ALTER TABLE mkt_posts ADD COLUMN assignee_user_id TEXT REFERENCES mkt_users(id) ON DELETE SET NULL;

-- Atrasado: flag server-managed (receta marcar_atrasado lo prende;
-- el PATCH que resuelve el atraso lo apaga). NUNCA editable por
-- HTTP y NUNCA un status nuevo: el frontend viejo jamas oculta
-- posts por un status desconocido.
ALTER TABLE mkt_posts ADD COLUMN overdue INTEGER NOT NULL DEFAULT 0;

-- Inicio de trabajo (vista Timeline): YYYY-MM-DD o NULL.
ALTER TABLE mkt_posts ADD COLUMN work_start TEXT;

-- Puntos de esfuerzo (vista Carga): 0-20 o NULL = default por tipo.
ALTER TABLE mkt_posts ADD COLUMN effort_points INTEGER;

-- Indice para Mi trabajo / Carga (estas dos sentencias SI son
-- idempotentes y pueden re-ejecutarse solas).
CREATE INDEX IF NOT EXISTS idx_mkt_posts_assignee ON mkt_posts(assignee_user_id, publish_date);
INSERT OR IGNORE INTO mkt_schema_migrations(name) VALUES ('005_posts_v2_columns');
