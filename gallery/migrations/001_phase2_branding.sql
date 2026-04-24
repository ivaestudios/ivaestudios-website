-- Phase 2 — Branding fields for cover designer + watermark customization
-- Adds: customizable watermark text, watermark subtext, per-gallery logo

ALTER TABLE galleries ADD COLUMN watermark_text     TEXT DEFAULT 'IVAE';
ALTER TABLE galleries ADD COLUMN watermark_subtext  TEXT DEFAULT 'STUDIOS';
ALTER TABLE galleries ADD COLUMN logo_key           TEXT DEFAULT NULL;
