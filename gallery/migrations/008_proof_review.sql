-- 008_proof_review.sql
-- Adds review/audit columns to proof_submissions so the photographer can
-- approve, return, or archive client selections from the admin proofs page.
--
-- Note on `status`: the original column added in 002_phase3_engagement has a
-- CHECK constraint limiting values to ('pending','reviewed','completed').
-- SQLite cannot drop a CHECK without rebuilding the table, so instead we add
-- a new `review_status` column that holds the richer values:
--   'submitted' (default — client has submitted, no review yet)
--   'approved'  (photographer accepted the picks)
--   'returned'  (sent back to client for changes)
--   'archived'  (hidden from default admin view)
-- The original `status` column is left in place for backwards compatibility.

ALTER TABLE proof_submissions ADD COLUMN reviewed_at TEXT;
ALTER TABLE proof_submissions ADD COLUMN reviewer_user_id TEXT;
ALTER TABLE proof_submissions ADD COLUMN review_note TEXT;
ALTER TABLE proof_submissions ADD COLUMN review_status TEXT DEFAULT 'submitted';
