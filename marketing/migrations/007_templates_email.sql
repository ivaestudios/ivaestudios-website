-- 007: plantillas de mes reutilizables + correo de contacto por marca.
-- Las plantillas guardan un snapshot JSON de los contenidos de un mes
-- (sin fechas absolutas: solo el día) para sembrar meses nuevos de un click.
CREATE TABLE IF NOT EXISTS mkt_month_templates (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name        TEXT NOT NULL,
  created_by  TEXT,
  data        TEXT NOT NULL,  -- JSON [{day,title,content_type,platform,caption,hook,body,cta,hashtags,notes_team,grabacion,client_visible}]
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Correo real de contacto del cliente (los logins de cliente usan usuarios
-- cortos tipo "dentalnow", no correos): destino de los avisos por email.
ALTER TABLE mkt_clients ADD COLUMN contact_email TEXT;
