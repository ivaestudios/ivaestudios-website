-- 015: texto alternativo (SEO alt) por post. En carruseles guarda un alt por
-- slide serializado como "Slide N — texto" (mismo formato que el guion por
-- slides); en fotos/reels es texto simple.
ALTER TABLE mkt_posts ADD COLUMN alt_text TEXT;
