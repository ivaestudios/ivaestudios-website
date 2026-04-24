-- Phase 2 logo-on-cover: white-logo override flag.
-- 0 (default) = auto-detect by background luminance + design family.
-- 1          = force white logo (e.g. logo placed on a dark photo overlay).
ALTER TABLE galleries ADD COLUMN logo_white INTEGER DEFAULT 0;
