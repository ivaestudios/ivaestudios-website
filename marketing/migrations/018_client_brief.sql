-- 018: brief del cliente (Strategy Brief del intake ivaestudios.com/marketing-intake)
-- Columna TEXT con JSON: {"filled_at","empresa","secciones":[{"titulo","items":[{"q","a"}]}]}
-- YA APLICADA a la D1 remota el 2026-07-10 (via API, junto con los UPDATE de
-- ADAGIO RH y Smile Now). No volver a ejecutar en remoto.

ALTER TABLE mkt_clients ADD COLUMN brief TEXT;
