Supabase migrations and setup

This folder contains Supabase migration guidance for the comics feature.

Applying migrations (recommended - CLI)

1. Install Supabase CLI: https://supabase.com/docs/guides/cli
2. Login and link your project:
   - supabase login
   - supabase link --project-ref <PROJECT_REF>
3. Create a migration (optional) or use existing migration file:
   - To create a new migration: supabase migration new create-comics-schema
   - Copy the SQL from supabase/migrations/20260602_204333_create_comics_schema.sql into the new migration file (if created manually).
4. Push migrations to the database:
   - supabase db push

Quick option (Web UI)

- Open your Supabase project → SQL Editor → New query, paste the SQL from supabase/migrations/20260602_204333_create_comics_schema.sql and run.

Notes

- The migration uses gen_random_uuid(); ensure the pgcrypto extension is available. The migration includes CREATE EXTENSION IF NOT EXISTS pgcrypto; at the top.
- The migration enables example RLS policies. Review and test them in a staging environment before applying to production.
- Create a Storage bucket named "comics" in the Supabase UI. Decide public vs private. Current editor code uses public URLs; for private buckets, switch to signed URLs (supabase.storage.from(bucket).createSignedUrl).

Local development

- Set env vars in .env or your environment: PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY (ANON key). For server-side operations use service_role secrets in secure environments.

After applying

- Run the app and try dropping an image into the editor. It should create rows in comics/sheets/panels/images and upload the file to the comics bucket.
