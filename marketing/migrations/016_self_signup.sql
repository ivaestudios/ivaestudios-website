-- 016: registro público (self-signup) + verificación de email + reset por token
-- + rate limiting de auth. Los usuarios EXISTENTES quedan como verificados
-- (default 1); los nuevos self-signup entran con email_verified=0 explícito.

ALTER TABLE mkt_users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1;
ALTER TABLE mkt_users ADD COLUMN verify_token TEXT;
ALTER TABLE mkt_users ADD COLUMN reset_token TEXT;
ALTER TABLE mkt_users ADD COLUMN reset_expires TEXT;

-- Contadores de ventana fija para rate limiting (login/signup/forgot).
CREATE TABLE IF NOT EXISTS mkt_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);
