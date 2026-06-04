-- reset_dev_db.sql (DESTRUCTIVE - for local/dev only)
-- Drops feature tables and clears migration tracking so you can re-run migrations from scratch.
-- WARNING: This will DELETE DATA. Do NOT run in production.

BEGIN;

DROP TABLE IF EXISTS bubbles CASCADE;
DROP TABLE IF EXISTS images CASCADE;
DROP TABLE IF EXISTS panels CASCADE;
DROP TABLE IF EXISTS sheet_templates CASCADE;
DROP TABLE IF EXISTS sheets CASCADE;
DROP TABLE IF EXISTS comics CASCADE;

-- Clear migration tracking (for Supabase CLI use only)
DELETE FROM schema_migrations WHERE version LIKE '20260602%';

COMMIT;
