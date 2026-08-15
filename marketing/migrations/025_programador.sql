-- 025 · EL PROGRAMADOR (2026-08-15): publicación programada a Instagram.
-- La pieza en status 'programado' con fecha (y hora opcional) se publica sola
-- vía el cron; aquí vive su rastro.
ALTER TABLE mkt_posts ADD COLUMN publish_time TEXT;          -- 'HH:MM' hora local Cancún (NULL = 11:00)
ALTER TABLE mkt_posts ADD COLUMN published_media_id TEXT;    -- id del media en IG al publicarse
ALTER TABLE mkt_posts ADD COLUMN published_at TEXT;          -- cuándo se publicó de verdad
ALTER TABLE mkt_posts ADD COLUMN publish_error TEXT;         -- último error del publicador (NULL = sin error)
