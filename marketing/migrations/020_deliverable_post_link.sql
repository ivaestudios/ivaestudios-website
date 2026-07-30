-- 020 — Vincular cada ENTREGABLE con su pieza del CALENDARIO.
--
-- Vianey pidió la numeración "REEL 1..12" para poder saber, al subir el reel
-- final en Entregables, A QUÉ publicación del calendario corresponde. El
-- número vivía solo en el calendario, así que en Entregables seguía sin
-- saberse. Esta columna crea el puente: el entregable apunta al post y la
-- app muestra su etiqueta ("REEL 3 · Promo del mes") en ambos lados.
ALTER TABLE mkt_deliverables ADD COLUMN post_id TEXT;
