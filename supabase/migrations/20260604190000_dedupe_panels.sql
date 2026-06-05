-- Deduplicate panel rows that share (sheet_id, index). Older upload-image
-- code inserted a new panel row on every image upload; combined with
-- save/publish using maybeSingle() (which errors on multiple rows), bubbles
-- ended up attached to orphan panels with no image — invisible on the public
-- view. Keep the oldest panel per (sheet_id, index); reparent bubbles and
-- images to it; delete the duplicates; then add a unique constraint so it
-- can't happen again.
BEGIN;

WITH ranked AS (
  SELECT
    id,
    sheet_id,
    index,
    ROW_NUMBER() OVER (PARTITION BY sheet_id, index ORDER BY created_at ASC, id ASC) AS rn,
    FIRST_VALUE(id) OVER (PARTITION BY sheet_id, index ORDER BY created_at ASC, id ASC) AS keeper_id
  FROM panels
),
dupes AS (
  SELECT id AS dup_id, keeper_id FROM ranked WHERE rn > 1
)
UPDATE bubbles
SET panel_id = dupes.keeper_id
FROM dupes
WHERE bubbles.panel_id = dupes.dup_id;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY sheet_id, index ORDER BY created_at ASC, id ASC) AS rn,
    FIRST_VALUE(id) OVER (PARTITION BY sheet_id, index ORDER BY created_at ASC, id ASC) AS keeper_id
  FROM panels
),
dupes AS (
  SELECT id AS dup_id, keeper_id FROM ranked WHERE rn > 1
)
UPDATE images
SET panel_id = dupes.keeper_id
FROM dupes
WHERE images.panel_id = dupes.dup_id;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY sheet_id, index ORDER BY created_at ASC, id ASC) AS rn
  FROM panels
)
DELETE FROM panels WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

ALTER TABLE panels
  ADD CONSTRAINT panels_sheet_id_index_key UNIQUE (sheet_id, index);

COMMIT;
