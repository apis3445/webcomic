-- Add thumbnail_path column to comics for cover image storage
ALTER TABLE comics ADD COLUMN IF NOT EXISTS thumbnail_path text;
