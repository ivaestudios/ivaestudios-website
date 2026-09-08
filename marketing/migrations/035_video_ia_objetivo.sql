-- Duraciones largas de un tirón. Veo solo genera 8 s, pero sabe CONTINUAR su
-- propio video 7 s más en el mismo plano. objetivo_seg guarda a cuántos
-- segundos hay que llegar: el sistema encadena solo (8 -> 15 -> 22 -> 29) y la
-- fila crece hasta alcanzarlo, sin que nadie tenga que apretar nada.
ALTER TABLE mkt_video_jobs ADD COLUMN objetivo_seg INTEGER;
INSERT OR IGNORE INTO mkt_schema_migrations(name) VALUES ('035_video_ia_objetivo');
