-- 026 — Colaboraciones + portada del reel (2026-08-16)
-- collaborators: hasta 3 @usuarios de Instagram que reciben invitación de colab
-- thumb_offset: milisegundo del video usado como miniatura del reel
--   (si hay imagen en R2 marketing/portada/<postId>.jpg, esa gana como cover_url)
ALTER TABLE mkt_posts ADD COLUMN collaborators TEXT;
ALTER TABLE mkt_posts ADD COLUMN thumb_offset INTEGER;
