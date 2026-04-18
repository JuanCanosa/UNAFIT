-- Adiciona avatar_url à tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Policy: aluno pode fazer upload do próprio avatar
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'aluno_upload_avatar' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "aluno_upload_avatar"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'academy-assets'
      AND (storage.foldername(name))[1] = 'alunos'
      AND (storage.foldername(name))[2] = auth.uid()::text
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'aluno_update_avatar' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "aluno_update_avatar"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'academy-assets'
      AND (storage.foldername(name))[1] = 'alunos'
      AND (storage.foldername(name))[2] = auth.uid()::text
    );
  END IF;
END $$;
