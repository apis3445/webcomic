-- 20260603_000400_comics_full.sql
-- Consolidated, idempotent migration for comics feature (single file)

-- Ensure pgcrypto available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- sheet_templates (create first so templates are available to UI)
CREATE TABLE IF NOT EXISTS sheet_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  layout jsonb,
  created_at timestamptz DEFAULT now()
);

-- comics
CREATE TABLE IF NOT EXISTS comics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- sheets
CREATE TABLE IF NOT EXISTS sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comic_id uuid NOT NULL REFERENCES comics(id) ON DELETE CASCADE,
  number integer NOT NULL,
  template_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (comic_id, number)
);

-- panels
CREATE TABLE IF NOT EXISTS panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES sheets(id) ON DELETE CASCADE,
  index integer NOT NULL,
  x numeric,
  y numeric,
  w numeric,
  h numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- images (includes public_url)
CREATE TABLE IF NOT EXISTS images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id uuid REFERENCES panels(id) ON DELETE SET NULL,
  sheet_id uuid REFERENCES sheets(id) ON DELETE CASCADE,
  comic_id uuid REFERENCES comics(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  bucket text NOT NULL,
  filename text,
  mime text,
  width integer,
  height integer,
  uploaded_by uuid,
  meta jsonb,
  public_url text,
  created_at timestamptz DEFAULT now()
);

-- bubbles
CREATE TABLE IF NOT EXISTS bubbles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id uuid REFERENCES panels(id) ON DELETE CASCADE,
  sheet_id uuid REFERENCES sheets(id) ON DELETE CASCADE,
  author_id uuid,
  image_id uuid REFERENCES images(id) ON DELETE SET NULL,
  text text,
  x numeric,
  y numeric,
  w numeric,
  h numeric,
  z_index integer DEFAULT 0,
  style jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS policies (per-command) -- allow owner OR public reads

-- comics
ALTER TABLE comics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comics_public_read ON comics;
DROP POLICY IF EXISTS comics_owner_insert ON comics;
DROP POLICY IF EXISTS comics_owner_update ON comics;
DROP POLICY IF EXISTS comics_owner_delete ON comics;
CREATE POLICY comics_public_read ON comics FOR SELECT USING (is_public OR owner_id = auth.uid());
CREATE POLICY comics_owner_insert ON comics FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = owner_id);
CREATE POLICY comics_owner_update ON comics FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY comics_owner_delete ON comics FOR DELETE USING (owner_id = auth.uid());

-- sheets
ALTER TABLE sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sheets_select ON sheets;
DROP POLICY IF EXISTS sheets_insert ON sheets;
DROP POLICY IF EXISTS sheets_update ON sheets;
DROP POLICY IF EXISTS sheets_delete ON sheets;
CREATE POLICY sheets_select ON sheets FOR SELECT USING (
  EXISTS (SELECT 1 FROM comics c WHERE c.id = sheets.comic_id AND (c.owner_id = auth.uid() OR c.is_public = true))
);
CREATE POLICY sheets_insert ON sheets FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM comics c WHERE c.id = sheets.comic_id AND c.owner_id = auth.uid())
);
CREATE POLICY sheets_update ON sheets FOR UPDATE USING (
  EXISTS (SELECT 1 FROM comics c WHERE c.id = sheets.comic_id AND c.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM comics c WHERE c.id = sheets.comic_id AND c.owner_id = auth.uid())
);
CREATE POLICY sheets_delete ON sheets FOR DELETE USING (
  EXISTS (SELECT 1 FROM comics c WHERE c.id = sheets.comic_id AND c.owner_id = auth.uid())
);

-- panels
ALTER TABLE panels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS panels_select ON panels;
DROP POLICY IF EXISTS panels_insert ON panels;
DROP POLICY IF EXISTS panels_update ON panels;
DROP POLICY IF EXISTS panels_delete ON panels;
CREATE POLICY panels_select ON panels FOR SELECT USING (
  EXISTS (SELECT 1 FROM sheets s JOIN comics c ON s.comic_id = c.id WHERE s.id = panels.sheet_id AND (c.owner_id = auth.uid() OR c.is_public = true))
);
CREATE POLICY panels_insert ON panels FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM sheets s JOIN comics c ON s.comic_id = c.id WHERE s.id = panels.sheet_id AND c.owner_id = auth.uid())
);
CREATE POLICY panels_update ON panels FOR UPDATE USING (
  EXISTS (SELECT 1 FROM sheets s JOIN comics c ON s.comic_id = c.id WHERE s.id = panels.sheet_id AND c.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM sheets s JOIN comics c ON s.comic_id = c.id WHERE s.id = panels.sheet_id AND c.owner_id = auth.uid())
);
CREATE POLICY panels_delete ON panels FOR DELETE USING (
  EXISTS (SELECT 1 FROM sheets s JOIN comics c ON s.comic_id = c.id WHERE s.id = panels.sheet_id AND c.owner_id = auth.uid())
);

-- images
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS images_select ON images;
DROP POLICY IF EXISTS images_insert ON images;
DROP POLICY IF EXISTS images_update ON images;
DROP POLICY IF EXISTS images_delete ON images;
CREATE POLICY images_select ON images FOR SELECT USING (
  EXISTS (SELECT 1 FROM comics c WHERE c.id = images.comic_id AND (c.owner_id = auth.uid() OR c.is_public = true))
);
CREATE POLICY images_insert ON images FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM comics c WHERE c.id = images.comic_id AND c.owner_id = auth.uid())
);
CREATE POLICY images_update ON images FOR UPDATE USING (
  EXISTS (SELECT 1 FROM comics c WHERE c.id = images.comic_id AND c.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM comics c WHERE c.id = images.comic_id AND c.owner_id = auth.uid())
);
CREATE POLICY images_delete ON images FOR DELETE USING (
  EXISTS (SELECT 1 FROM comics c WHERE c.id = images.comic_id AND c.owner_id = auth.uid())
);

-- sheet_templates RLS and policies
ALTER TABLE sheet_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sheet_templates_select ON sheet_templates;
DROP POLICY IF EXISTS sheet_templates_insert ON sheet_templates;
DROP POLICY IF EXISTS sheet_templates_update ON sheet_templates;
DROP POLICY IF EXISTS sheet_templates_delete ON sheet_templates;
CREATE POLICY sheet_templates_select ON sheet_templates FOR SELECT USING (true);
CREATE POLICY sheet_templates_insert ON sheet_templates FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY sheet_templates_update ON sheet_templates FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY sheet_templates_delete ON sheet_templates FOR DELETE USING (auth.role() = 'authenticated');

-- bubbles
ALTER TABLE bubbles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bubbles_select ON bubbles;
DROP POLICY IF EXISTS bubbles_insert ON bubbles;
DROP POLICY IF EXISTS bubbles_update ON bubbles;
DROP POLICY IF EXISTS bubbles_delete ON bubbles;
CREATE POLICY bubbles_select ON bubbles FOR SELECT USING (
  EXISTS (SELECT 1 FROM comics c JOIN sheets s ON s.comic_id = c.id JOIN panels p ON p.sheet_id = s.id WHERE p.id = bubbles.panel_id AND (c.owner_id = auth.uid() OR c.is_public = true))
);
CREATE POLICY bubbles_insert ON bubbles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM comics c JOIN sheets s ON s.comic_id = c.id JOIN panels p ON p.sheet_id = s.id WHERE p.id = bubbles.panel_id AND c.owner_id = auth.uid())
);
CREATE POLICY bubbles_update ON bubbles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM comics c JOIN sheets s ON s.comic_id = c.id JOIN panels p ON p.sheet_id = s.id WHERE p.id = bubbles.panel_id AND c.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM comics c JOIN sheets s ON s.comic_id = c.id JOIN panels p ON p.sheet_id = s.id WHERE p.id = bubbles.panel_id AND c.owner_id = auth.uid())
);
CREATE POLICY bubbles_delete ON bubbles FOR DELETE USING (
  EXISTS (SELECT 1 FROM comics c JOIN sheets s ON s.comic_id = c.id JOIN panels p ON p.sheet_id = s.id WHERE p.id = bubbles.panel_id AND c.owner_id = auth.uid())
);

COMMIT;
