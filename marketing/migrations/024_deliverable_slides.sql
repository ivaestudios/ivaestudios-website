-- 024 · Carrusel de VIDEO = sus N videos de slide (2026-09-30).
-- Antes el carrusel de video se guardaba como UNA tira (los slides pegados en
-- un solo video ancho), que el cliente no puede publicar y que a partir de 7
-- slides ya no cabe en el nivel H.264 que decodifica un iPhone. Ahora cada
-- slide es su propio MP4 de 1080×1350 en R2: marketing/deliverable/<id>.sNN.mp4
-- (NN = 01..20, el tope de Instagram). slides_n = cuántos hay; 0 = ninguno.
ALTER TABLE mkt_deliverables ADD COLUMN slides_n INTEGER NOT NULL DEFAULT 0;
