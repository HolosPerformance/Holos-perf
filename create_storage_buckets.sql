-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. Create buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('branding',             'branding',             true, 5242880,  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']),
  ('clubs',                'clubs',                true, 5242880,  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']),
  ('session-documents',    'session-documents',    true, 20971520, NULL),
  ('questionnaire-images', 'questionnaire-images', true, 5242880,  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policies (wrapped in DO block to skip if already exist)
DO $$
BEGIN

  -- branding
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Authenticated users can upload to branding') THEN
    CREATE POLICY "Authenticated users can upload to branding"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'branding');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Public read from branding') THEN
    CREATE POLICY "Public read from branding"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'branding');
  END IF;

  -- clubs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Authenticated users can upload to clubs') THEN
    CREATE POLICY "Authenticated users can upload to clubs"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'clubs');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Public read from clubs') THEN
    CREATE POLICY "Public read from clubs"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'clubs');
  END IF;

  -- session-documents
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Authenticated users can upload to session-documents') THEN
    CREATE POLICY "Authenticated users can upload to session-documents"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'session-documents');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Public read from session-documents') THEN
    CREATE POLICY "Public read from session-documents"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'session-documents');
  END IF;

  -- questionnaire-images
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Authenticated users can upload to questionnaire-images') THEN
    CREATE POLICY "Authenticated users can upload to questionnaire-images"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'questionnaire-images');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Public read from questionnaire-images') THEN
    CREATE POLICY "Public read from questionnaire-images"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'questionnaire-images');
  END IF;

END $$;
