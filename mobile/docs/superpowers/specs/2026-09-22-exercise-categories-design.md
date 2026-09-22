# Exercise Category System — Design Specification

**Date**: 2026-09-22  
**Status**: Approved  
**Author**: Assistant & Ante Bašić  

---

## 1. Goal & Overview

Transform the Pull-Up Leaderboard mobile application from a single hardcoded "Pull-ups" tracker into a data-driven multi-exercise system (initially supporting **Pull-ups** and **Chin-ups**, and architected to support future exercises purely through database records).

### Core Requirements
1. **Exercises as Data**: Adding a new exercise (e.g. Dips, Push-ups) requires only inserting a record into `public.exercise_categories` in Supabase; zero app-wide UI rewrites or new screen files.
2. **Four Reusable Leaderboard Modes per Exercise**:
   - **Best**: Highest personal best normalized score (`reps × (bodyweight / officeMedianWeight)^exponent`).
   - **Absolute**: Highest raw repetitions count.
   - **Most improved**: Percentage improvement from first recorded attempt to best attempt.
   - **Most active**: Total session count in the selected category.
3. **Seamless Migration**: Existing athletes and their recorded sessions are preserved without any data loss or score discrepancies. All existing sessions are attributed to the `Pull-ups` category.
4. **Mobile UX**:
   - Clean, compact `ExerciseSelector` dropdown/sheet on `LeaderboardScreen` and `UserDetailScreen`.
   - Dynamic exercise context in `AttemptFormModal` with instant live score calculation preview.
   - Separate, unmixed metrics, charts, and histories per exercise in athlete profiles (`UserDetailScreen`).
   - Unranked athletes (those with zero attempts in the active exercise) are placed at the bottom with `—` and *"No result yet"*, avoiding misleading 0.00 scores.
5. **Distribution**: Rebuild signed release Android APK for direct distribution to friends.

---

## 2. Database Schema & Migration (Supabase)

### 2.1 New Table: `public.exercise_categories`

```sql
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
```

### 2.2 Alter Table: `public.sessions`

```sql
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS exercise_category_id UUID REFERENCES public.exercise_categories(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_sessions_category_user
ON public.sessions (exercise_category_id, user_id, date);
```

### 2.3 Seed Initial Categories & Backfill Sessions

```sql
-- 1. Insert Pull-ups and Chin-ups
INSERT INTO public.exercise_categories (slug, name, icon_key, unit, score_type, normalization_type, normalization_exponent, is_active, display_order)
VALUES 
    ('pull-ups', 'Pull-ups', 'pull-up', 'reps', 'bodyweight_normalized', 'bodyweight_power', 0.67, true, 1),
    ('chin-ups', 'Chin-ups', 'chin-up', 'reps', 'bodyweight_normalized', 'bodyweight_power', 0.67, true, 2)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    normalization_exponent = EXCLUDED.normalization_exponent,
    display_order = EXCLUDED.display_order;

-- 2. Migrate existing historical sessions to Pull-ups
UPDATE public.sessions
SET exercise_category_id = (SELECT id FROM public.exercise_categories WHERE slug = 'pull-ups')
WHERE exercise_category_id IS NULL;

-- 3. Enforce NOT NULL constraint
ALTER TABLE public.sessions
ALTER COLUMN exercise_category_id SET NOT NULL;
```

### 2.4 Row Level Security (RLS) & Realtime Publication

```sql
ALTER TABLE public.exercise_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on exercise_categories"
ON public.exercise_categories FOR SELECT USING (true);

CREATE POLICY "Allow public insert on exercise_categories"
ON public.exercise_categories FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on exercise_categories"
ON public.exercise_categories FOR UPDATE USING (true);

-- Enable Realtime for exercise_categories
ALTER PUBLICATION supabase_realtime ADD TABLE public.exercise_categories;
```

---

## 3. Architecture & Domain Layer

### 3.1 Data Flow
```
Supabase (remote)
  ├── exercise_categories
  ├── users
  └── sessions (with exercise_category_id)
        │
        ▼ (syncFromSupabase & Realtime channel)
Mobile Local Cache (`db.ts` + AsyncStorage)
        │
        ▼
Domain Layer (`service.ts`, `scoring.ts`, `gamify.ts`)
  ├── leaderboard(categorySlug, mode)
  ├── userDetail(userId, categorySlug)
  └── officeAwards(game, users)
        │
        ▼
UI Components & Screens (Reactive via `useDataVersion()`)
```

### 3.2 Scoring Engine (`scoring.ts`)
- Exponent is passed from the category's configuration:
  $$\text{score} = \text{reps} \times \left(\frac{\text{athleteMass}}{\text{medianMass}}\right)^{\text{exponent}}$$
- Default exponent remains $0.67$.
- Multiplier calculation:
  $$\text{multiplier} = \left(\frac{\text{athleteMass}}{\text{medianMass}}\right)^{\text{exponent}}$$

### 3.3 Domain Services (`service.ts`)
- **`leaderboard(categorySlugOrId, mode)`**:
  1. Resolves category (defaulting to the first active category if unspecified).
  2. Filters `db.sessions()` strictly for `session.exerciseCategoryId === category.id`.
  3. Separates athletes into **ranked** (athletes with $\ge 1$ attempt in this category) and **unranked** (0 attempts).
  4. Ranked athletes are sorted by the chosen metric (`best`, `absolute`, `improved`, `active`) with deterministic tie-breaking (earliest date / name).
  5. Unranked athletes are appended with `rank: null`, `score: null`, displaying as `—` and *"No result yet"*.
- **`buildUserView(user, medianKg, categoryId)`**:
  - Computes category-specific personal bests (`pbAbsolute`, `pbNormalized`), total reps, session count, and trends strictly from that category's attempts.
- **`userDetail(userId, categorySlugOrId)`**:
  - Exposes category-scoped data for the athlete profile.

---

## 4. Mobile User Interface

### 4.1 Component: `ExerciseSelector`
- Visual representation:
  ```
  ┌───────────────────────────────────────────────┐
  │  💪  Pull-ups                              ▼  │
  └───────────────────────────────────────────────┘
  ```
- Touch target $\ge 48$ px.
- Opens bottom sheet / modal with available exercises:
  - Radio/checkmark indicator on active item.
  - Exercise name, unit, and subtle description (e.g., "Bodyweight-normalized").
- Selecting an exercise updates screen state immediately without full re-mount flashes.

### 4.2 Screen: `LeaderboardScreen`
- Placed at the top: `ExerciseSelector`.
- Subtitle dynamically displays median weight and athlete count.
- Mode tabs (`Best`, `Absolute`, `Most improved`, `Most active`) stay preserved across exercise toggles.
- Rows render cleanly:
  - Ranked: `1  [Avatar] Name  Score  Reps`
  - Unranked: `—  [Avatar] Name  No result yet`

### 4.3 Modal: `AttemptFormModal`
- Exercise selector at the top (pre-selected based on current screen context).
- Label: `Repetitions` / `${exercise.name} completed`.
- Date picker / text input (defaults to today).
- Bodyweight input (pre-filled with athlete's current weight).
- Note input (optional).
- Live interactive score preview card:
  - Updates immediately as reps/bodyweight change.
  - Explanatory caption: `Based on X reps · Y kg · median Z kg`.
- Submitting saves `exercise_category_id` to Supabase, updates local cache, invalidates data version, and triggers toast notification.

### 4.4 Screen: `UserDetailScreen` (Athlete Profile)
- Displays `ExerciseSelector` right below the athlete's header info.
- Metric tiles (`Norm. PB`, `PB Reps`, `Total Reps`, `Sessions`) dynamically reflect the selected exercise.
- Progress chart and attempt history list strictly show attempts for that exercise.
- "Log result" button opens `AttemptFormModal` with the selected exercise pre-filled.
- "Import" button allows selecting target category for CSV import.

---

## 5. Android APK Packaging & Distribution

- After implementation, compile the Android release APK using Gradle:
  ```bash
  cd mobile/android && ./gradlew assembleRelease --no-daemon
  ```
- Verify APK signing (APK Signature Scheme v2).
- Copy output APK to repository root: `PullUpLeaderboard.apk`.

---

## 6. Verification & Acceptance Criteria

1. **Database & Migration**:
   - `exercise_categories` table exists with `pull-ups` and `chin-ups`.
   - Existing 3 sessions have `exercise_category_id` set to `pull-ups`.
   - Realtime sync receives updates for all 3 tables.
2. **Scoring**:
   - Existing pull-up scores match pre-migration values down to the decimal point.
   - Chin-ups calculate correctly with the same exponent ($0.67$).
3. **UI & Navigation**:
   - Switching between Pull-ups and Chin-ups on Leaderboard is instantaneous.
   - Empty category (Chin-ups before any log) shows clean unranked state with no misleading 0.00 scores.
   - Logging a Chin-up attempt saves correctly and does not appear on the Pull-ups board.
   - Athlete profile correctly isolates Pull-up and Chin-up personal bests and history charts.
4. **Android APK**:
   - Signed release APK built successfully and ready for install.
