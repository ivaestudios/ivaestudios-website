-- 038 — BANDEJA por marca (2026-09-23). Pedido de Vianey: "quiero que también
-- conteste comentarios, quiero tener un CRM donde pueda contestar Messenger,
-- Insta, WhatsApp". Todo cuelga de la marca (mkt_clients), así que el candado
-- de workspace del router cubre la bandeja igual que al resto de la app.

-- Una conversación = una persona hablando con una marca por UN canal.
-- contacto_id: IGSID (Instagram), PSID (Messenger) o teléfono (WhatsApp).
CREATE TABLE IF NOT EXISTS mkt_conversaciones (
  id                TEXT PRIMARY KEY,
  client_id         TEXT NOT NULL REFERENCES mkt_clients(id) ON DELETE CASCADE,
  canal             TEXT NOT NULL,                 -- instagram | messenger | whatsapp
  contacto_id       TEXT NOT NULL,
  nombre            TEXT,
  username          TEXT,
  ultimo_texto      TEXT,
  ultimo_en         TEXT,                          -- último mensaje (de quien sea)
  ultimo_cliente_en TEXT,                          -- último mensaje DE LA PERSONA (ventana de 24 h)
  no_leidos         INTEGER NOT NULL DEFAULT 0,
  etapa             TEXT NOT NULL DEFAULT 'nuevo', -- nuevo | platica | cotizado | cliente | perdido
  notas             TEXT,
  seguimiento       TEXT,                          -- AAAA-MM-DD: ese día se avisa al equipo
  archivado         INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (client_id, canal, contacto_id)
);
CREATE INDEX IF NOT EXISTS idx_mkt_conv_marca ON mkt_conversaciones(client_id, archivado, ultimo_en);
CREATE INDEX IF NOT EXISTS idx_mkt_conv_seguimiento ON mkt_conversaciones(seguimiento);

-- Cada mensaje de una conversación. mid = id del mensaje en Meta: sirve para
-- no guardar dos veces lo que llega por webhook Y por sondeo, y para reconocer
-- el eco de lo que nosotros mismos mandamos.
CREATE TABLE IF NOT EXISTS mkt_mensajes (
  id            TEXT PRIMARY KEY,
  conv_id       TEXT NOT NULL REFERENCES mkt_conversaciones(id) ON DELETE CASCADE,
  mid           TEXT,
  direccion     TEXT NOT NULL,                     -- in (la persona) | out (la marca)
  texto         TEXT,
  adjunto_tipo  TEXT,                              -- image | video | audio | file | share | story_mention
  adjunto_url   TEXT,                              -- URL del CDN de Meta (caduca) — IG / Messenger
  adjunto_id    TEXT,                              -- media id de WhatsApp (se baja con el token)
  autor_user_id TEXT,                              -- quién lo mandó desde la app (out)
  autor_nombre  TEXT,
  estado        TEXT,                              -- enviado | error
  error         TEXT,
  creado        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mkt_msg_mid ON mkt_mensajes(mid) WHERE mid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mkt_msg_conv ON mkt_mensajes(conv_id, creado);

-- Comentarios públicos en los posts de la marca (Instagram y Facebook).
CREATE TABLE IF NOT EXISTS mkt_comentarios (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL REFERENCES mkt_clients(id) ON DELETE CASCADE,
  canal           TEXT NOT NULL,                   -- instagram | facebook
  comment_id      TEXT NOT NULL UNIQUE,
  media_id        TEXT,
  media_permalink TEXT,
  media_caption   TEXT,
  parent_id       TEXT,                            -- si es respuesta a otro comentario
  autor           TEXT,
  autor_id        TEXT,
  texto           TEXT,
  comentado_en    TEXT,
  atendido        INTEGER NOT NULL DEFAULT 0,
  respuesta       TEXT,
  respuesta_id    TEXT,
  respondido_en   TEXT,
  respondido_por  TEXT,
  dm_enviado      INTEGER NOT NULL DEFAULT 0,
  oculto          INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mkt_com_marca ON mkt_comentarios(client_id, atendido, comentado_en);

-- WhatsApp por marca (Cloud API): cada marca con SU número y SU token.
ALTER TABLE mkt_clients ADD COLUMN wa_phone_id TEXT;
ALTER TABLE mkt_clients ADD COLUMN wa_waba_id TEXT;
ALTER TABLE mkt_clients ADD COLUMN wa_numero TEXT;
ALTER TABLE mkt_clients ADD COLUMN wa_access_token TEXT;
ALTER TABLE mkt_clients ADD COLUMN wa_connected_at TEXT;
-- Sondeo (respaldo de los webhooks): cuándo se leyó la marca por última vez y
-- cómo le fue a cada canal (JSON), para enseñarlo en la pantalla sin adivinar.
ALTER TABLE mkt_clients ADD COLUMN bandeja_sondeo_at TEXT;
ALTER TABLE mkt_clients ADD COLUMN bandeja_estado TEXT;

INSERT OR IGNORE INTO mkt_schema_migrations(name) VALUES ('038_bandeja');
