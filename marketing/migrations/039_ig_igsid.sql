-- 039 — Segundo id de Instagram por marca (2026-10-06).
-- Con Instagram Login, /me devuelve DOS ids de la misma cuenta profesional:
--   id      (36610…)  → el que guardamos en ig_user_id y sirve para la API.
--   user_id (17841…)  → el que Meta usa en los WEBHOOKS (entry.id, recipient.id)
--                        y en los participantes de /conversations.
-- Sin este segundo id la Bandeja nunca reconocía a qué marca iba un DM de
-- Instagram y tomaba a la propia cuenta como "el cliente".
ALTER TABLE mkt_clients ADD COLUMN ig_igsid TEXT;
