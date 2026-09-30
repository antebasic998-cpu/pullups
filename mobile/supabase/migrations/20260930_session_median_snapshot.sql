-- Freeze normalized scores: store the office median used when each result was logged.
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS median_mass_kg NUMERIC;

-- Backfill existing rows with the current office median (one-time snapshot).
UPDATE public.sessions
SET median_mass_kg = (
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY weight_kg)
  FROM public.users
)
WHERE median_mass_kg IS NULL
  AND EXISTS (SELECT 1 FROM public.users LIMIT 1);
