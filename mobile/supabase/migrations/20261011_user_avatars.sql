-- Profile photos for athletes (additive: nothing is dropped or rewritten).

-- 1. Where the photo lives. NULL = no photo, the app falls back to initials.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Public bucket for the (already downscaled, ~256 px) photos. 512 KB is a generous ceiling.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 524288, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 3. Same open model as the rest of the app (the board is behind the client-side password gate).
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read avatars'
    ) THEN
        CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public insert avatars'
    ) THEN
        CREATE POLICY "Public insert avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public update avatars'
    ) THEN
        CREATE POLICY "Public update avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public delete avatars'
    ) THEN
        CREATE POLICY "Public delete avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars');
    END IF;
END $$;
