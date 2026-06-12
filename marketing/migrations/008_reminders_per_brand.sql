-- 008: interruptor de avisos automáticos por marca.
-- Con 0, las recetas de tiempo (recordatorio_publicacion, marcar_atrasado,
-- alerta_sin_aprobar) saltan los contenidos de esa marca.
ALTER TABLE mkt_clients ADD COLUMN reminders_enabled INTEGER NOT NULL DEFAULT 1;
