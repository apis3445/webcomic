-- Enforce one image per panel. Prior upload-image inserted a new row on every
-- replacement, and without a unique constraint the read picked whichever
-- Postgres returned first — reloads ended up showing the old image.
-- Dedupe by keeping the newest row per panel_id, then add the constraint so
-- upload-image can safely upsert by panel_id going forward.
BEGIN;

WITH ranked AS (
  SELECT
    id,
    panel_id,
    ROW_NUMBER() OVER (PARTITION BY panel_id ORDER BY created_at DESC, id DESC) AS rn
  FROM images
  WHERE panel_id IS NOT NULL
)
DELETE FROM images WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, so guard against environments
-- where this constraint was already created (e.g. partially-applied reruns).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'images_panel_id_key'
      AND conrelid = 'images'::regclass
  ) THEN
    ALTER TABLE images
      ADD CONSTRAINT images_panel_id_key UNIQUE (panel_id);
  END IF;
END $$;

COMMIT;
