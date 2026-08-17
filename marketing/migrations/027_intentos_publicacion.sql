-- 027 — Intentos de publicación acotados (2026-08-17, post-incidente)
-- El bucle del 16-ago: Meta respondía error en media_publish PERO publicaba;
-- el reintento infinito duplicó el reel 4 veces. Ahora: máximo 5 intentos.
ALTER TABLE mkt_posts ADD COLUMN publish_attempts INTEGER NOT NULL DEFAULT 0;
