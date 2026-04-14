-- ─── Bucket público para assets das academias (logos, etc.) ──────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'academy-assets',
  'academy-assets',
  true,
  2097152,
  ARRAY['image/png','image/jpeg','image/jpg','image/svg+xml','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Leitura pública (logo visível para todos)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'public_read_academy_assets' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "public_read_academy_assets"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'academy-assets');
  END IF;
END $$;

-- Upload: dono/saas_admin na pasta da sua academia
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'dono_upload_academy_assets' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "dono_upload_academy_assets"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'academy-assets'
      AND (storage.foldername(name))[2] IN (
        SELECT academia_id::text FROM profiles WHERE id = auth.uid() AND role IN ('dono','saas_admin')
      )
    );
  END IF;
END $$;

-- Update: dono/saas_admin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'dono_update_academy_assets' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "dono_update_academy_assets"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'academy-assets'
      AND (storage.foldername(name))[2] IN (
        SELECT academia_id::text FROM profiles WHERE id = auth.uid() AND role IN ('dono','saas_admin')
      )
    );
  END IF;
END $$;

-- Delete: dono/saas_admin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'dono_delete_academy_assets' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "dono_delete_academy_assets"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'academy-assets'
      AND (storage.foldername(name))[2] IN (
        SELECT academia_id::text FROM profiles WHERE id = auth.uid() AND role IN ('dono','saas_admin')
      )
    );
  END IF;
END $$;
