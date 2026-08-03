-- Interruptor por marca: ¿el CLIENTE puede descargar sus entregables?
-- Por defecto SÍ (1): ninguna marca existente cambia de comportamiento al
-- aplicar esta migración. Solo afecta al rol 'client'; el equipo siempre
-- puede bajar su propio material.
--
-- Se aplicó a mano en la D1 de producción el 2026-08-03; este archivo existe
-- para que cualquier entorno nuevo (wrangler dev, una restauración) tenga el
-- mismo esquema. Sin él, el PATCH del interruptor revienta con "no such column".
ALTER TABLE mkt_clients ADD COLUMN downloads_enabled INTEGER NOT NULL DEFAULT 1;
