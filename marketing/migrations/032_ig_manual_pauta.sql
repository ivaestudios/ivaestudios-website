-- Vistas de PAUTA del mes, capturadas a mano del panel de la marca.
-- La API de Instagram solo entrega lo ORGÁNICO; los boosts hechos con
-- "Promocionar" en el propio reel viven en la cuenta publicitaria de quien
-- paga (y los cobrados vía Apple muchas veces ni al Ads Manager llegan).
-- Pedido de Vianey 2026-08-26: que el número del reporte se vea completo.
ALTER TABLE mkt_ig_manual ADD COLUMN paid_views INTEGER;
