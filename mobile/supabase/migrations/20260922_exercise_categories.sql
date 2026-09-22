-- 1. Create exercise_categories table
CREATE TABLE IF NOT EXISTS public.exercise_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    short_name TEXT,
    description TEXT,
    icon_key TEXT NOT NULL DEFAULT 'bar',
    unit TEXT NOT NULL DEFAULT 'reps',
    score_type TEXT NOT NULL DEFAULT 'bodyweight_normalized',
    normalization_type TEXT NOT NULL DEFAULT 'bodyweight_power',
    normalization_exponent NUMERIC NOT NULL DEFAULT 0.67,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Seed Pull-ups and Chin-ups
INSERT INTO public.exercise_categories (slug, name, icon_key, unit, score_type, normalization_type, normalization_exponent, is_active, display_order)
VALUES 
    ('pull-ups', 'Pull-ups', 'pull-up', 'reps', 'bodyweight_normalized', 'bodyweight_power', 0.67, true, 1),
    ('chin-ups', 'Chin-ups', 'chin-up', 'reps', 'bodyweight_normalized', 'bodyweight_power', 0.67, true, 2)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    normalization_exponent = EXCLUDED.normalization_exponent,
    display_order = EXCLUDED.display_order;

-- 3. Add exercise_category_id to sessions
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS exercise_category_id UUID REFERENCES public.exercise_categories(id) ON DELETE RESTRICT;

-- 4. Backfill existing sessions to Pull-ups
UPDATE public.sessions
SET exercise_category_id = (SELECT id FROM public.exercise_categories WHERE slug = 'pull-ups')
WHERE exercise_category_id IS NULL;

-- 5. Enforce NOT NULL constraint
ALTER TABLE public.sessions
ALTER COLUMN exercise_category_id SET NOT NULL;

-- 6. Add composite index for category-scoped queries
CREATE INDEX IF NOT EXISTS idx_sessions_cat_user
ON public.sessions (exercise_category_id, user_id, date);

-- 7. Configure RLS
ALTER TABLE public.exercise_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'exercise_categories' AND policyname = 'Allow public read on exercise_categories'
    ) THEN
        CREATE POLICY "Allow public read on exercise_categories" ON public.exercise_categories FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'exercise_categories' AND policyname = 'Allow public insert on exercise_categories'
    ) THEN
        CREATE POLICY "Allow public insert on exercise_categories" ON public.exercise_categories FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'exercise_categories' AND policyname = 'Allow public update on exercise_categories'
    ) THEN
        CREATE POLICY "Allow public update on exercise_categories" ON public.exercise_categories FOR UPDATE USING (true);
    END IF;
END $$;

-- 8. Add to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.exercise_categories;
