-- 052 · Pauta por marca (16-nov-2026). Vianey: "si quiero manejar pautas de
-- todos los clientes, tiene que estar súper bien hecho", en dos modos:
--   · agencia: el cliente le da acceso a IVAE en su Business Manager y la
--     agencia maneja su cuenta publicitaria con su propia sesión de Facebook;
--   · propia: un creador o cliente conecta SU Facebook y maneja su pauta.
-- Hasta hoy la pauta era SOLO la cuenta de la casa (mkt_kv: ads_cuenta y
-- ads_token). Eso sigue igual: esta migración solo AGREGA.

-- Un permiso de Facebook por persona y espacio de trabajo. Si Vianey conecta
-- 10 marcas con su Facebook, es UN solo permiso que sirve para las 10, y al
-- renovarlo se renuevan todas.
CREATE TABLE IF NOT EXISTS mkt_ads_tokens (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'ivae',
  fb_user_id TEXT NOT NULL,          -- id de Facebook (de esta app) de quien dio el permiso
  token TEXT NOT NULL,               -- token largo (~60 días); jamás viaja al navegador
  expira_en TEXT,
  scopes TEXT,
  creado_por TEXT,                   -- usuario de la app que conectó
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ads_tokens_ws_user ON mkt_ads_tokens (workspace_id, fb_user_id);

-- La cuenta publicitaria de cada marca (una por marca).
CREATE TABLE IF NOT EXISTS mkt_ads_cuentas (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'ivae',
  client_id TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,       -- "act_123…"
  nombre TEXT,
  moneda TEXT,
  zona_horaria TEXT,
  estado INTEGER,                    -- account_status de Meta (1 = activa)
  token_id TEXT NOT NULL,            -- mkt_ads_tokens.id
  modo TEXT NOT NULL DEFAULT 'agencia', -- agencia | propia
  page_id TEXT,                      -- página con la que se anuncia
  page_name TEXT,
  ig_user_id TEXT,                   -- Instagram con el que se anuncia
  ig_username TEXT,
  tope_diario REAL,                  -- techo de gasto diario que la IA respeta
  auto INTEGER NOT NULL DEFAULT 0,   -- 1 = la IA puede mover la pauta sola
  conectada_por TEXT,
  conectada_en TEXT NOT NULL,
  actualizada_en TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ads_cuentas_client ON mkt_ads_cuentas (client_id);
CREATE INDEX IF NOT EXISTS idx_ads_cuentas_ws ON mkt_ads_cuentas (workspace_id);

-- La historia diaria y la bitácora ahora saben de qué cuenta y de qué marca son.
ALTER TABLE mkt_ads_dia ADD COLUMN ad_account_id TEXT;
ALTER TABLE mkt_ads_dia ADD COLUMN client_id TEXT;
ALTER TABLE mkt_ads_log ADD COLUMN ad_account_id TEXT;
ALTER TABLE mkt_ads_log ADD COLUMN client_id TEXT;
CREATE INDEX IF NOT EXISTS idx_ads_dia_cuenta ON mkt_ads_dia (ad_account_id, dia);
CREATE INDEX IF NOT EXISTS idx_ads_log_cuenta ON mkt_ads_log (ad_account_id, at);

-- Lo que ya existe es de la cuenta de la casa.
UPDATE mkt_ads_dia SET ad_account_id = (SELECT json_extract(value, '$.id') FROM mkt_kv WHERE key = 'ads_cuenta')
 WHERE ad_account_id IS NULL;
UPDATE mkt_ads_log SET ad_account_id = (SELECT json_extract(value, '$.id') FROM mkt_kv WHERE key = 'ads_cuenta')
 WHERE ad_account_id IS NULL;
