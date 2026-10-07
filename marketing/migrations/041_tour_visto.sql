-- 041 — La visita guiada se recuerda en el SERVIDOR (7-oct-2026).
-- Israel: "solo es una vez y para empresas nuevas y negocios nuevos; para
-- Regeneris y las cuentas no debería aparecer ya". Antes el "ya la vi" vivía
-- solo en localStorage y Safari lo borra (ITP), así que a clientes de siempre
-- les volvía a salir. Todas las cuentas que existen hoy quedan como vistas;
-- solo las que se den de alta desde ahora la ven, una vez.
ALTER TABLE mkt_users ADD COLUMN tour_visto_at TEXT;
UPDATE mkt_users SET tour_visto_at = datetime('now') WHERE tour_visto_at IS NULL;
