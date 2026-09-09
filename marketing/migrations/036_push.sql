-- Notificaciones que LLEGAN al telefono aunque la app este cerrada (Web Push).
-- Cada renglon es UN dispositivo de UNA persona: el mismo usuario puede tener
-- su celular, su tablet y su compu, y cada uno tiene su propio buzon.
--
--   endpoint : la direccion que da el navegador (Google/Apple/Mozilla). Es
--              unica en el mundo, asi que sirve de llave para no duplicar.
--   p256dh   : llave publica del dispositivo, para cifrarle el mensaje.
--   auth     : su secreto de autenticacion (RFC 8291). Sin estos dos el
--              contenido no se puede cifrar y el navegador lo descarta.
--   fallos   : cuantos envios seguidos rebotaron. A los 5 se da de baja sola;
--              un 404/410 la borra al instante.
CREATE TABLE IF NOT EXISTS mkt_push_subs (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES mkt_users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  agente      TEXT,
  fallos      INTEGER NOT NULL DEFAULT 0,
  ultimo_ok   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mkt_push_subs_user ON mkt_push_subs(user_id);

-- Interruptor por persona. Sin renglon = encendido (el que se suscribio es
-- porque quiere que le llegue).
ALTER TABLE mkt_users ADD COLUMN push_activo INTEGER NOT NULL DEFAULT 1;

INSERT OR IGNORE INTO mkt_schema_migrations(name) VALUES ('036_push');
