-- 031 — Decisiones del usuario para TikTok (2026-08-17)
-- JSON con lo que el humano eligió en la pantalla de cumplimiento que TikTok
-- exige: {privacy_level, allow_comment, allow_duet, allow_stitch, brand_*}
ALTER TABLE mkt_posts ADD COLUMN tt_options TEXT;
