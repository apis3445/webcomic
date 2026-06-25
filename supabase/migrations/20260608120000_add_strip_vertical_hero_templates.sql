-- Seed the three new comic templates so sheets.template_id can be resolved
-- from their slugs in the save/publish endpoints.
INSERT INTO sheet_templates (slug, name, layout)
VALUES
  ('strip-3', 'Sunday Strip', '{"panelCount": 3}'::jsonb),
  ('vertical-4', 'Webtoon Vertical', '{"panelCount": 4}'::jsonb),
  ('hero-5', 'Action Spread', '{"panelCount": 5}'::jsonb)
ON CONFLICT (slug) DO NOTHING;
