-- 051 · Instagram por pieza (13-nov-2026). Vianey: "no me deja programar
-- solamente TikTok, sí o sí me tengo que meter Instagram, y eso está mal".
-- NULL = piezas de antes: salen en Instagram si la marca lo tiene conectado
--        (el comportamiento de siempre, nada cambia para ellas).
-- 0    = esta pieza NO va a Instagram (el reloj la trata como marca sin Instagram).
-- 1    = sí va a Instagram.
ALTER TABLE mkt_posts ADD COLUMN also_instagram INTEGER;
