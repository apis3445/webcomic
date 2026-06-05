-- Add foreign key from sheets.template_id to sheet_templates.id so PostgREST
-- can perform embedded joins (e.g. select('sheet_templates(slug)')). Without
-- this FK, the load function reads templateSlug as null and the editor falls
-- back to the panel-count heuristic, which "resets" the user's template
-- selection after reload.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sheets_template_id_fkey'
  ) THEN
    ALTER TABLE sheets
      ADD CONSTRAINT sheets_template_id_fkey
      FOREIGN KEY (template_id) REFERENCES sheet_templates(id) ON DELETE SET NULL;
  END IF;
END$$;
