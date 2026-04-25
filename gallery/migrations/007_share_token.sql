-- Migration 007 — Public share token for galleries (Pic-Time-style link).
-- Photographer generates a tokenized URL that anyone with the link can open
-- WITHOUT logging in. No email gate forced (unless request_email = 1).
-- Token is per-gallery, regeneratable, revocable.
--
-- Numbered 007 because 006 is already used by 006_logo_white.sql.
ALTER TABLE galleries ADD COLUMN share_token TEXT;
CREATE INDEX IF NOT EXISTS idx_galleries_share_token ON galleries(share_token);
