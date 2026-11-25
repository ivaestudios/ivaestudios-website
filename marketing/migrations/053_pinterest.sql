-- Pinterest (25-nov-2026, Vianey: "conecta pinterest").
-- Conexión por marca (permiso, cuenta y tablero donde se publica) y, por pieza,
-- el interruptor "también en Pinterest" con su rastro (id del pin o el error).
-- Solo agrega columnas: no toca ningún dato existente.
ALTER TABLE mkt_clients ADD COLUMN pin_user_id TEXT;
ALTER TABLE mkt_clients ADD COLUMN pin_username TEXT;
ALTER TABLE mkt_clients ADD COLUMN pin_access_token TEXT;
ALTER TABLE mkt_clients ADD COLUMN pin_refresh_token TEXT;
ALTER TABLE mkt_clients ADD COLUMN pin_access_expires_at TEXT;
ALTER TABLE mkt_clients ADD COLUMN pin_refresh_expires_at TEXT;
ALTER TABLE mkt_clients ADD COLUMN pin_board_id TEXT;
ALTER TABLE mkt_clients ADD COLUMN pin_board_name TEXT;
ALTER TABLE mkt_clients ADD COLUMN pin_connected_at TEXT;
ALTER TABLE mkt_posts ADD COLUMN also_pinterest INTEGER DEFAULT 0;
ALTER TABLE mkt_posts ADD COLUMN pin_post_id TEXT;
ALTER TABLE mkt_posts ADD COLUMN pin_error TEXT;
