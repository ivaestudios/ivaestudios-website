-- 019 — Login por correo O usuario + bóveda de contraseñas visibles.
--
-- PROBLEMA 1: seis cuentas de cliente (regeneristherapy, smilenow,
-- MELISAFITNESS, SHEILA, adagio, ivaestudios-client) guardaban un NOMBRE DE
-- USUARIO en la columna `email`. Como /auth/forgot exige un correo válido,
-- esas cuentas NUNCA podían pedir un restablecimiento: quedaban atadas a que
-- Vianey se acordara de la contraseña.
--
-- SOLUCIÓN: se separa el identificador en dos columnas. `username` conserva
-- el login de toda la vida (nadie tiene que aprender uno nuevo) y `email`
-- pasa a ser un correo de verdad. El login acepta cualquiera de los dos; el
-- restablecimiento por correo, solo `email`.
--
-- PROBLEMA 2: la contraseña solo existía como hash PBKDF2, irreversible, así
-- que el panel de accesos no podía mostrarla.
--
-- SOLUCIÓN: `password_enc` guarda una copia cifrada con AES-GCM. La llave NO
-- vive aquí: vive en R2 (servicio aparte), así que un volcado de esta base de
-- datos no alcanza para leer ninguna contraseña.

ALTER TABLE mkt_users ADD COLUMN username TEXT;
ALTER TABLE mkt_users ADD COLUMN password_enc TEXT;
ALTER TABLE mkt_users ADD COLUMN password_enc_at TEXT;

-- Un identificador no puede repetirse entre cuentas (el login busca en las dos
-- columnas). SQLite permite múltiples NULL en un índice único, así que las
-- cuentas que entran solo con correo quedan con username NULL sin chocar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mkt_users_username
  ON mkt_users (username COLLATE NOCASE);

-- Las cuentas cuyo "correo" no era un correo pasan su valor a `username`.
-- `email` se queda igual por ahora (la columna es NOT NULL) hasta que Vianey
-- capture el correo real de cada cliente desde el panel de accesos.
UPDATE mkt_users
   SET username = email
 WHERE email NOT LIKE '%@%'
   AND username IS NULL;
