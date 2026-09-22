# Exercise Category System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Pull-Up Leaderboard mobile app into a data-driven multi-exercise system supporting Pull-ups and Chin-ups, with category-scoped leaderboards, attempt logging, and athlete profiles, backed by Supabase and packaged into an Android APK.

**Architecture:** Database-driven categories in Supabase (`exercise_categories`), referenced by `sessions.exercise_category_id`. The mobile app syncs categories into its local reactive store via Realtime. The domain layer (`scoring.ts`, `service.ts`) calculates rankings and athlete metrics per category dynamically without code duplication.

**Tech Stack:** React Native, Expo 57, TypeScript, Supabase (Postgres, RLS, Realtime), Gradle (Android release APK).

## Global Constraints
- Existing 5 athletes and 3 historical sessions must be preserved without data loss or score alteration.
- Formula for Pull-ups and Chin-ups: $\text{score} = \text{reps} \times (\text{weight} / \text{median})^{0.67}$.
- Athletes with zero attempts in the active category must appear as unranked (`—` and *"No result yet"*), not falsely ranked at 0.00 pts.
- All code changes must pass TypeScript validation (`npx tsc --noEmit`).

---

### Task 1: Supabase Database Migration & Seeding

**Files:**
- Supabase SQL execution via `user-supabase` MCP tool
- Reference migration file: `mobile/supabase/migrations/20260922_exercise_categories.sql`

**Interfaces:**
- Produces: `public.exercise_categories` table, `public.sessions.exercise_category_id` column with foreign key, Realtime publication.

- [ ] **Step 1: Write SQL migration file**

Create `mobile/supabase/migrations/20260922_exercise_categories.sql`:

```sql
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
```

- [ ] **Step 2: Execute migration on Supabase project**

Execute the SQL script on project `ftdgsncvhsmhbkjxrunp` using `user-supabase:execute_sql`.
Expected: Successful execution with no errors.

- [ ] **Step 3: Verify Supabase database state**

Query `SELECT * FROM public.exercise_categories;` and verify:
- `pull-ups` (display_order: 1, exponent: 0.67) exists.
- `chin-ups` (display_order: 2, exponent: 0.67) exists.
- All 3 existing sessions have valid `exercise_category_id`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260922_exercise_categories.sql
git commit -m "feat(db): add exercise_categories table and session category relation"
```

---

### Task 2: Supabase TypeScript Types Generation

**Files:**
- Modify: `mobile/src/lib/database.types.ts`

**Interfaces:**
- Produces: `Database['public']['Tables']['exercise_categories']` types for client queries.

- [ ] **Step 1: Regenerate TypeScript types via Supabase tool**

Invoke `user-supabase:generate_typescript_types` for project `ftdgsncvhsmhbkjxrunp` and write the result to `mobile/src/lib/database.types.ts`.

- [ ] **Step 2: Verify database types**

Inspect `mobile/src/lib/database.types.ts` to confirm `exercise_categories` table is present with row, insert, and update definitions, and `sessions.exercise_category_id` is typed as `string`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "chore: update database.types.ts with exercise_categories"
```

---

### Task 3: Local Storage & Realtime Sync Layer

**Files:**
- Modify: `mobile/src/core/db.ts`
- Modify: `mobile/src/core/seed.ts`

**Interfaces:**
- Consumes: `RawExerciseCategory`, `RawSession` with `exerciseCategoryId`.
- Produces: `db.categories()`, `db.category(idOrSlug)`, `db.defaultCategory()`, `db.sessionsOfCategory(categoryId)`.

- [ ] **Step 1: Update `mobile/src/core/db.ts`**

Define `RawExerciseCategory`:
```typescript
export interface RawExerciseCategory {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  description: string;
  iconKey: string;
  unit: string;
  scoreType: string;
  normalizationType: string;
  normalizationExponent: number;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}
```

Update `RawSession` to include `exerciseCategoryId: string`.
Update `DbData` to include `categories: RawExerciseCategory[]`.

Update `syncFromSupabase()`:
- Query `supabase.from('exercise_categories').select('*').eq('is_active', true).order('display_order', { ascending: true })`
- Map to camelCase `RawExerciseCategory` objects in `cache.categories`.
- Map `exercise_category_id` to `exerciseCategoryId` in `cache.sessions`.

Update `subscribeToRealtime()`:
- Add listener for `table: 'exercise_categories'` that triggers `syncFromSupabase()`.

Add helper methods to `db`:
- `db.categories()`: returns cached categories array.
- `db.category(idOrSlug: string)`: finds category by id or slug.
- `db.defaultCategory()`: returns first active category (fallback to Pull-ups).
- `db.sessionsOfCategory(categoryId: string)`: returns all sessions for that category.
- `db.sessionsOfUserAndCategory(userId: string, categoryId: string)`.

- [ ] **Step 2: Update `mobile/src/core/seed.ts`**

Update `buildSeedData()` to supply default `categories` array (Pull-ups and Chin-ups) and attach `exerciseCategoryId` to initial seed sessions.

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit` in `mobile/`.
Expected: PASS (or only existing unrelated warnings).

- [ ] **Step 4: Commit**

```bash
git add src/core/db.ts src/core/seed.ts
git commit -m "feat(store): add exercise categories to local db and realtime sync"
```

---

### Task 4: Scoring Engine & Domain Service Updates

**Files:**
- Modify: `mobile/src/types.ts`
- Modify: `mobile/src/core/scoring.ts`
- Modify: `mobile/src/core/service.ts`

**Interfaces:**
- Consumes: `RawExerciseCategory`, `db.sessionsOfCategory`.
- Produces: Category-scoped `leaderboard(categorySlugOrId, mode)` and `userDetail(userId, categorySlugOrId)`.

- [ ] **Step 1: Update `mobile/src/types.ts`**

Add `ExerciseCategory` interface:
```typescript
export interface ExerciseCategory {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  description: string;
  iconKey: string;
  unit: string;
  scoreType: string;
  normalizationType: string;
  normalizationExponent: number;
  isActive: boolean;
  displayOrder: number;
}
```
Update `Attempt` to include `exerciseCategoryId: string`.
Update `Board` to include `category: ExerciseCategory`.
Update `LeaderRow.rank`: allow `number | null` for unranked athletes.
Update `LeaderRow.score`: allow `number | null`.

- [ ] **Step 2: Update `mobile/src/core/scoring.ts`**

Refactor `normalizedScore` and `massMultiplier` to accept `exponent`:
```typescript
export function normalizedScore(reps: number, athleteMassKg: number, medianMassKg: number, exponent: number = EXPONENT): number {
  if (!Number.isFinite(reps)) return 0;
  if (!Number.isFinite(athleteMassKg) || !Number.isFinite(medianMassKg) || medianMassKg <= 0) {
    return round(reps);
  }
  return round(reps * (athleteMassKg / medianMassKg) ** exponent);
}

export function massMultiplier(athleteMassKg: number, medianMassKg: number, exponent: number = EXPONENT): number {
  if (!Number.isFinite(athleteMassKg) || !Number.isFinite(medianMassKg) || medianMassKg <= 0) return 1;
  return round((athleteMassKg / medianMassKg) ** exponent, 3);
}
```

- [ ] **Step 3: Update `mobile/src/core/service.ts`**

Update `decorateSession(session, user, medianKg, category)`:
- Use `category.normalizationExponent`.
- Attach `exerciseCategoryId: session.exerciseCategoryId`.

Update `buildUserView(user, medianKg, category, existingGame)`:
- Filter sessions to `s.exerciseCategoryId === category.id`.
- Compute PB absolute, PB normalized, total reps, and session count exclusively for that category.

Update `leaderboard(categorySlugOrId = 'pull-ups', mode = 'best')`:
- Resolve `category = db.category(categorySlugOrId) || db.defaultCategory()`.
- Filter rows into:
  - Ranked athletes ($\ge 1$ session in this category).
  - Unranked athletes (0 sessions in this category).
- Sort ranked athletes by metric with deterministic tie-breaking.
- Assign sequential 1-based ranks to ranked athletes.
- Append unranked athletes with `rank: null`, `score: null`.
- Return `category`, `medianMassKg`, `userCount`, `attemptCount`, and `rows`.

- [ ] **Step 4: Verify with test check**

Run: `npx tsc --noEmit` in `mobile/`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/core/scoring.ts src/core/service.ts
git commit -m "feat(domain): implement category-scoped scoring and leaderboard rankings"
```

---

### Task 5: API Layer Updates

**Files:**
- Modify: `mobile/src/api.ts`

**Interfaces:**
- Produces: `api.categories()`, `api.board(categorySlug, mode)`, `api.user(userId, categorySlug)`, `api.addAttempt(userId, { categoryId, reps, date, weightKg, note })`.

- [ ] **Step 1: Update methods in `mobile/src/api.ts`**

1. `api.categories()`: returns active categories from `db.categories()`.
2. `api.board(categorySlug?: string, mode?: BoardMode)`: passes `categorySlug` to `leaderboard()`.
3. `api.user(userId: string, categorySlug?: string)`: passes `categorySlug` to `userDetail()`.
4. `api.addAttempt(userId: string, input: AttemptInput)`:
   - Accept `categoryId?: string` in `AttemptInput` (fallback to `db.defaultCategory().id`).
   - Validate reps, weight, date.
   - Insert into Supabase `sessions` with `exercise_category_id: categoryId`.
   - Update local cache with `exerciseCategoryId`.
5. `api.importCsv(csvText: string, categoryId?: string)`:
   - Insert sessions with designated `exercise_category_id`.

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit` in `mobile/`.
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/api.ts
git commit -m "feat(api): make api client category-aware for board, user, attempts, and import"
```

---

### Task 6: UI Component: `ExerciseSelector` & Modal Updates

**Files:**
- Create: `mobile/src/components/ExerciseSelector.tsx`
- Modify: `mobile/src/components/AttemptFormModal.tsx`
- Modify: `mobile/src/components/ImportModal.tsx`

**Interfaces:**
- `ExerciseSelector`: `<ExerciseSelector selected={category} onSelect={(cat) => void} />`
- `AttemptFormModal`: pre-selects current exercise, live formula score preview.

- [ ] **Step 1: Create `mobile/src/components/ExerciseSelector.tsx`**

A touchable button showing:
```tsx
<TouchableOpacity onPress={() => setModalOpen(true)} style={styles.button}>
  <Text style={styles.icon}>{category.iconKey === 'chin-up' ? '🤸' : '💪'}</Text>
  <Text style={styles.label}>{category.name}</Text>
  <Text style={styles.arrow}>▼</Text>
</TouchableOpacity>
```
On tap, opens bottom sheet / modal listing all active categories with checkmarks and descriptions, calling `onSelect(category)`.

- [ ] **Step 2: Update `mobile/src/components/AttemptFormModal.tsx`**

- Add category selector at the top (pre-selected to the current screen's category).
- Dynamic label: `${category.name} completed` or `Repetitions`.
- Live score preview card:
  $$\text{preview} = \text{reps} \times (\text{weight} / \text{medianMassKg})^{\text{category.normalizationExponent}}$$
  Display: `Based on X reps · Y kg · median Z kg`.
- Submit passes `categoryId: category.id` to `api.addAttempt`.

- [ ] **Step 3: Update `mobile/src/components/ImportModal.tsx`**

- Add category selector allowing user to choose which exercise the CSV rows belong to.

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit` in `mobile/`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExerciseSelector.tsx src/components/AttemptFormModal.tsx src/components/ImportModal.tsx
git commit -m "feat(ui): add ExerciseSelector component and update attempt and import modals"
```

---

### Task 7: Screen Updates: `LeaderboardScreen` & `UserDetailScreen`

**Files:**
- Modify: `mobile/src/screens/LeaderboardScreen.tsx`
- Modify: `mobile/src/screens/UserDetailScreen.tsx`

**Interfaces:**
- `LeaderboardScreen`: reactive state for `selectedCategory`, displays `ExerciseSelector`, renders ranked and unranked athletes.
- `UserDetailScreen`: reactive state for `selectedCategory`, displays `ExerciseSelector`, isolates PB, charts, and history.

- [ ] **Step 1: Update `mobile/src/screens/LeaderboardScreen.tsx`**

- Add `const [selectedCategorySlug, setSelectedCategorySlug] = useState('pull-ups')`.
- Fetch `data` using `() => api.board(selectedCategorySlug, mode)`.
- Render `ExerciseSelector` in header directly above `SegmentedControl`.
- Render unranked athletes cleanly:
  - If `row.rank === null`, show `—` in place of number, and `"No result yet"` in place of score.
  - Tapping still navigates to `UserDetail`.

- [ ] **Step 2: Update `mobile/src/screens/UserDetailScreen.tsx`**

- Add `const [selectedCategorySlug, setSelectedCategorySlug] = useState('pull-ups')`.
- Fetch `api.user(id, selectedCategorySlug)` and `api.board(selectedCategorySlug, 'best')`.
- Render `ExerciseSelector` below athlete's name/weight.
- Metric cards (`Norm. PB`, `PB Reps`, `Total Reps`, `Sessions`) reflect the selected exercise.
- Progress chart and history list show only attempts from that exercise.
- Passing `category` to `AttemptFormModal` so "Log result" pre-selects the active exercise.

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit` in `mobile/`.
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/screens/LeaderboardScreen.tsx src/screens/UserDetailScreen.tsx
git commit -m "feat(screens): integrate ExerciseSelector and category-scoped views into Leaderboard and UserDetail"
```

---

### Task 8: End-to-End Verification on iOS Simulator

**Files:**
- No code modification; runtime verification.

**Interfaces:**
- Verifies full functionality: switching between Pull-ups and Chin-ups, unranked empty states, logging Chin-up result, checking Realtime sync and score accuracy.

- [ ] **Step 1: Reload / Start Metro and verify app launches**

Send reload command to Metro or launch app on simulator.

- [ ] **Step 2: Test Leaderboard switching**

- Verify Pull-ups board displays existing 3 attempts for Tin Ogrizek.
- Switch to Chin-ups via `ExerciseSelector`.
- Verify Chin-ups board shows all 5 athletes as unranked (`—` and *"No result yet"*).

- [ ] **Step 3: Test Logging Chin-up attempt**

- Tap on an athlete (e.g. Ante Bašić).
- Select Chin-ups.
- Tap "Log result", enter 10 reps, 77.5 kg.
- Verify live preview shows `10.00 pts`.
- Save attempt.
- Verify Chin-up PB shows 10 reps, Pull-up PB remains unaffected.
- Go back to Leaderboard: Ante is now #1 on Chin-ups board with 10 pts.
- Switch to Pull-ups board: Ante remains unranked, Tin is #1.

- [ ] **Step 4: Take screenshot of simulator to visually verify**

Run `xcrun simctl io 83A9B444-6B8F-4D78-A11E-89AFDB963EF4 screenshot /tmp/verified_categories.png`.

---

### Task 9: Build & Package Release Android APK

**Files:**
- Output: `mobile/android/app/build/outputs/apk/release/app-release.apk`
- Root: `PullUpLeaderboard.apk`

- [ ] **Step 1: Run Gradle release build**

```bash
cd mobile/android && ./gradlew assembleRelease --no-daemon
```
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 2: Verify APK signature and metadata**

```bash
$HOME/Library/Android/sdk/build-tools/36.0.0/apksigner verify --verbose android/app/build/outputs/apk/release/app-release.apk
```
Expected: `Verified using v2 scheme: true`.

- [ ] **Step 3: Copy APK to repository root**

```bash
cp mobile/android/app/build/outputs/apk/release/app-release.apk /Users/antebasic/WebstormProjects/PullUpLeaderboard/PullUpLeaderboard.apk
```

- [ ] **Step 4: Commit and tag**

```bash
git add -A
git commit -m "chore: release Android APK with exercise categories support"
```
