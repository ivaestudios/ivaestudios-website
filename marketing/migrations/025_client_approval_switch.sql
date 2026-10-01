-- 025 · Aprobación del cliente POR MARCA (30-sep-2026).
-- Vianey: "no debe haber aprobación del cliente, esa opción no me sirve, quítala;
-- debo poder programar y publicar todo en todas las redes sin aprobación".
-- La aprobación nunca frenó la publicación (el reloj solo respeta "cambios
-- pedidos"), pero en sus marcas propias sobraban el interruptor "Pedir
-- aprobación" y la etiqueta "Pendiente". Con approval_enabled = 0 la marca no
-- enseña nada de aprobación y sus piezas nacen con client_visible = 0.
ALTER TABLE mkt_clients ADD COLUMN approval_enabled INTEGER NOT NULL DEFAULT 1;
