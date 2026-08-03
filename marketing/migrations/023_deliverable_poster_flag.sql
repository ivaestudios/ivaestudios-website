-- ¿Este entregable tiene miniatura (poster) en R2?
--
-- Sin esta marca el backend anunciaba poster_url para TODOS los videos y el
-- navegador pedía una imagen que en la mitad de los casos no existe: 45 de 89
-- videos daban 404 (los subidos antes de que existiera la generación de
-- miniaturas). Ahora solo se anuncia cuando de verdad hay algo que servir; sin
-- miniatura el navegador muestra el primer fotograma, que se ve mejor que un
-- recuadro negro y no ensucia la consola.
ALTER TABLE mkt_deliverables ADD COLUMN poster_ok INTEGER NOT NULL DEFAULT 0;
