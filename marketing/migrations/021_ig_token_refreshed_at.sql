-- 021: columna dedicada para la auto-renovación del token de Instagram.
--
-- BUG (auditoría 2026-07-31): refreshAgingIgTokens elegía las marcas por
-- `updated_at < ahora-25d`, pero ESA columna la toca cualquier edición de la
-- marca (nombre, logo, notas, recordatorios). Una marca que se edita al menos
-- una vez al mes NUNCA entraba al refresh y su token moría a los 60 días:
-- las métricas y el reporte mensual dejaban de funcionar en silencio, que es
-- exactamente lo que este mecanismo debía evitar.
--
-- Se siembra con updated_at para no refrescar las 4 marcas de golpe hoy.
ALTER TABLE mkt_clients ADD COLUMN ig_token_refreshed_at TEXT;
UPDATE mkt_clients SET ig_token_refreshed_at = updated_at WHERE ig_access_token IS NOT NULL;
