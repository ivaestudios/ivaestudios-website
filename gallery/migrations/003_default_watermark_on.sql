-- Migration 003 — Default watermark ON for IVAE branding
-- Backfills existing galleries that were created before the default flipped.
-- New galleries get watermark_enabled=1 from handleCreateGallery.

UPDATE galleries
   SET watermark_enabled = 1
 WHERE watermark_enabled = 0
   AND (watermark_text IS NULL OR watermark_text = 'IVAE');

UPDATE galleries
   SET watermark_text = 'IVAE'
 WHERE watermark_text IS NULL OR watermark_text = '';

UPDATE galleries
   SET watermark_subtext = 'STUDIOS'
 WHERE watermark_subtext IS NULL OR watermark_subtext = '';

UPDATE galleries
   SET watermark_opacity = 0.3
 WHERE watermark_opacity IS NULL OR watermark_opacity = 0;

-- Performance: index selections.photo_id so cascade-deletes from photos don't
-- table-scan the selections table (caught by DB audit Apr 22).
CREATE INDEX IF NOT EXISTS idx_selections_photo ON selections(photo_id);
