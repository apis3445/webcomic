-- Add a stable slug identifier to sheet_templates so client-side template ids
-- (e.g. 'grid-3x3', 'page-1-2-3') can be persisted via sheets.template_id.
ALTER TABLE sheet_templates ADD COLUMN IF NOT EXISTS slug text;

CREATE UNIQUE INDEX IF NOT EXISTS sheet_templates_slug_key ON sheet_templates(slug);

INSERT INTO sheet_templates (slug, name, layout)
VALUES
  ('grid-3x3', 'Classic 3×3', '{"panelCount": 9}'::jsonb),
  ('page-1-2-3', 'Page Layout', '{"panelCount": 6}'::jsonb)
ON CONFLICT (slug) DO NOTHING;
