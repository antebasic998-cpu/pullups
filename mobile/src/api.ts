import { db, syncFromSupabase, type RawExerciseCategory } from './core/db';
import { inferCategoryIconKey, normalizeCategoryIcon, slugifyCategoryName } from './lib/categoryUtils';
import {
  allUsers,
  computeGamificationDelta,
  leaderboard,
  medianMass,
  meta,
  office,
  parseCSV,
  userDetail,
} from './core/service';
import { todayISO } from './core/scoring';
import { randomUUID } from './lib/uuid';
import { supabase } from './lib/supabase';
import { invalidate } from './lib/store';
import type { Database } from './lib/database.types';
import type { Board, BoardMode, ExerciseCategory, ImportResponse, Meta, OfficeResponse, UserResponse, UsersResponse } from './types';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function requireName(raw: unknown): string {
  const name = String(raw ?? '').trim();
  if (!name) throw new ApiError(400, 'Name is required.');
  if (name.length > 60) throw new ApiError(400, 'Name must be 60 characters or fewer.');
  return name;
}

function requireWeight(raw: unknown): number {
  const w = Number(String(raw ?? '').replace(',', '.'));
  if (!Number.isFinite(w)) throw new ApiError(400, 'Weight is required.');
  if (w < 20 || w > 400) throw new ApiError(400, 'Weight must be between 20 and 400 kg.');
  return Math.round(w * 10) / 10;
}

function optionalAge(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const a = Number(raw);
  if (!Number.isFinite(a) || a < 5 || a > 120) throw new ApiError(400, 'Age must be between 5 and 120.');
  return Math.round(a);
}

function requireReps(raw: unknown): number {
  const r = Number(raw);
  if (!Number.isFinite(r)) throw new ApiError(400, 'Repetition count is required.');
  if (r < 1 || r > 500) throw new ApiError(400, 'Repetition count must be between 1 and 500.');
  return Math.round(r);
}

function requireDate(raw: unknown): string {
  const value = String(raw ?? '').trim();
  const iso = value || todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(Date.parse(iso))) {
    throw new ApiError(400, 'Date must look like YYYY-MM-DD.');
  }
  return iso;
}

function findUserOr404(id: string) {
  const user = db.user(id);
  if (!user) throw new ApiError(404, 'User not found.');
  return user;
}

export interface UserInput {
  name: string;
  age: string | number | null;
  weightKg: string | number;
  note?: string;
  pbAbsolute?: string | number | null;
  pbDate?: string;
}

export interface AttemptInput {
  categoryId?: string;
  reps: string | number;
  date: string;
  weightKg?: string | number | null;
  note?: string;
}

export interface CategoryInput {
  name: string;
  description?: string;
  /** An emoji from the picker (or a legacy icon key). Omit to guess from the name. */
  iconKey?: string;
}

function requireCategoryIcon(raw: unknown): string {
  const icon = normalizeCategoryIcon(raw);
  if (!icon) throw new ApiError(400, 'Pick one of the available icons.');
  return icon;
}

const AVATAR_BUCKET = 'avatars';
const avatarPath = (userId: string) => `${userId}.jpg`;

function requireCategoryName(raw: unknown): string {
  const name = String(raw ?? '').trim();
  if (!name) throw new ApiError(400, 'Exercise name is required.');
  if (name.length > 80) throw new ApiError(400, 'Exercise name must be 80 characters or fewer.');
  return name;
}

function mapCategoryRow(row: Database['public']['Tables']['exercise_categories']['Row']): RawExerciseCategory {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    description: row.description ?? '',
    iconKey: row.icon_key,
    unit: row.unit,
    scoreType: row.score_type,
    normalizationType: row.normalization_type,
    normalizationExponent: Number(row.normalization_exponent),
    isActive: row.is_active,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const api = {
  sync: async (): Promise<void> => {
    await syncFromSupabase();
  },

  categories: async (): Promise<ExerciseCategory[]> => {
    return db.categories();
  },

  createCategory: async (input: CategoryInput): Promise<ExerciseCategory> => {
    const name = requireCategoryName(input.name);
    const slug = slugifyCategoryName(name);
    if (!slug) throw new ApiError(400, 'Exercise name must contain letters or numbers.');
    if (db.categories().some((c) => c.slug === slug)) {
      throw new ApiError(409, `${name} already exists on the board.`);
    }

    const displayOrder = db.categories().reduce((max, c) => Math.max(max, c.displayOrder), 0) + 1;
    const hasIcon = input.iconKey !== undefined && input.iconKey !== null && input.iconKey !== '';
    const iconKey = hasIcon ? requireCategoryIcon(input.iconKey) : inferCategoryIconKey(slug, name);
    const now = new Date().toISOString();

    const payload = {
      slug,
      name,
      short_name: null,
      description: String(input.description ?? '').slice(0, 200) || null,
      icon_key: iconKey,
      unit: 'reps',
      score_type: 'bodyweight_normalized',
      normalization_type: 'bodyweight_power',
      normalization_exponent: 0.67,
      is_active: true,
      display_order: displayOrder,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase.from('exercise_categories').insert(payload).select().single();
    if (error) {
      throw new ApiError(400, error.message);
    }

    const category = mapCategoryRow(data);
    db.insertCategory(category);
    invalidate();
    return category;
  },

  /** Rename an exercise and/or change its icon. The slug never changes, so links and results stay valid. */
  updateCategory: async (id: string, input: Partial<CategoryInput>): Promise<ExerciseCategory> => {
    const existing = db.categories().find((c) => c.id === id);
    if (!existing) throw new ApiError(404, 'Exercise not found.');

    const patch: Database['public']['Tables']['exercise_categories']['Update'] = {
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) {
      const name = requireCategoryName(input.name);
      const slug = slugifyCategoryName(name);
      if (!slug) throw new ApiError(400, 'Exercise name must contain letters or numbers.');
      const clash = db
        .categories()
        .some((c) => c.id !== existing.id && (c.slug === slug || c.name.toLowerCase() === name.toLowerCase()));
      if (clash) throw new ApiError(409, `${name} already exists on the board.`);
      patch.name = name;
    }
    if (input.iconKey !== undefined) patch.icon_key = requireCategoryIcon(input.iconKey);
    if (input.description !== undefined) patch.description = String(input.description).slice(0, 200) || null;

    const { data, error } = await supabase
      .from('exercise_categories')
      .update(patch)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw new ApiError(400, error.message);

    const category = db.updateCategory(existing.id, mapCategoryRow(data))!;
    invalidate();
    return category;
  },

  /** Uploads a local, already cropped/downscaled JPEG (see lib/photo.ts) as the athlete's profile photo. */
  uploadAvatar: async (userId: string, fileUri: string): Promise<string> => {
    const user = findUserOr404(userId);
    const bytes = await (await fetch(fileUri)).arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > 400 * 1024) {
      throw new ApiError(400, 'Photo is too large. Pick a smaller one.');
    }

    const path = avatarPath(user.id);
    const { error: upErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
    if (upErr) throw new ApiError(400, upErr.message);

    // Cache-busting suffix: the path is stable, the picture is not.
    const avatarUrl = `${supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
    const { error } = await supabase
      .from('users')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw new ApiError(400, error.message);

    db.updateUser(user.id, { avatarUrl });
    invalidate();
    return avatarUrl;
  },

  removeAvatar: async (userId: string): Promise<void> => {
    const user = findUserOr404(userId);
    await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath(user.id)]);
    const { error } = await supabase
      .from('users')
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw new ApiError(400, error.message);

    db.updateUser(user.id, { avatarUrl: null });
    invalidate();
  },

  meta: async (categorySlugOrId?: string): Promise<Meta> => {
    return meta(categorySlugOrId);
  },

  board: async (categorySlugOrId?: string, mode: BoardMode = 'best'): Promise<Board> => {
    return { ...leaderboard(categorySlugOrId, mode), ...meta(categorySlugOrId) } as Board;
  },

  office: async (categorySlugOrId?: string): Promise<OfficeResponse> => {
    return { ...office(categorySlugOrId), ...meta(categorySlugOrId) } as OfficeResponse;
  },

  users: async (categorySlugOrId?: string): Promise<UsersResponse> => {
    return { users: allUsers(categorySlugOrId) as UsersResponse['users'], ...meta(categorySlugOrId) };
  },

  user: async (id: string, categorySlugOrId?: string): Promise<UserResponse> => {
    const view = userDetail(id, categorySlugOrId);
    if (!view) throw new ApiError(404, 'User not found.');
    return { user: view as UserResponse['user'], ...meta(categorySlugOrId) };
  },

  createUser: async (input: UserInput): Promise<UserResponse> => {
    const now = new Date().toISOString();
    const name = requireName(input.name);
    if (db.users().some((u) => u.name.toLowerCase() === name.toLowerCase())) {
      throw new ApiError(409, `${name} is already on the board.`);
    }
    const seedRepsRaw = input.pbAbsolute;
    const hasSeed = seedRepsRaw !== null && seedRepsRaw !== undefined && seedRepsRaw !== '';
    const seedReps = hasSeed ? requireReps(seedRepsRaw) : null;
    const seedDate = hasSeed ? requireDate(input.pbDate) : null;
    const defaultCat = db.defaultCategory();

    const userPayload = {
      id: randomUUID(),
      name,
      age: optionalAge(input.age),
      weight_kg: requireWeight(input.weightKg),
      note: String(input.note ?? '').slice(0, 200),
      created_at: now,
      updated_at: now,
    };

    const { data: userRow, error: uErr } = await supabase
      .from('users')
      .insert(userPayload)
      .select()
      .single();

    if (uErr) {
      throw new ApiError(400, uErr.message);
    }

    const user = {
      id: userRow.id,
      name: userRow.name,
      age: userRow.age,
      weightKg: Number(userRow.weight_kg),
      note: userRow.note ?? '',
      avatarUrl: userRow.avatar_url ?? null,
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at,
    };
    db.insertUser(user);

    if (seedReps !== null) {
      const medianSnapshot = medianMass();
      const sessionPayload = {
        id: randomUUID(),
        user_id: user.id,
        exercise_category_id: defaultCat.id,
        reps: seedReps,
        weight_kg: user.weightKg,
        median_mass_kg: medianSnapshot,
        date: seedDate!,
        note: 'Personal best on joining',
        created_at: now,
      };
      const { data: sessionRow, error: sErr } = await supabase
        .from('sessions')
        .insert(sessionPayload)
        .select()
        .single();

      if (sErr) {
        console.warn('[supabase] insert seed session error:', sErr.message);
      } else if (sessionRow) {
        db.insertSession({
          id: sessionRow.id,
          userId: sessionRow.user_id,
          exerciseCategoryId: sessionRow.exercise_category_id,
          reps: sessionRow.reps,
          weightKg: Number(sessionRow.weight_kg),
          medianMassKg:
            sessionRow.median_mass_kg != null ? Number(sessionRow.median_mass_kg) : medianSnapshot,
          date: sessionRow.date,
          note: sessionRow.note,
          createdAt: sessionRow.created_at,
        });
      }
    }

    return { user: userDetail(user.id, defaultCat.id)! as UserResponse['user'], ...meta(defaultCat.id) };
  },

  updateUser: async (id: string, input: Partial<UserInput>): Promise<UserResponse> => {
    const existing = findUserOr404(id);
    const patch: Record<string, unknown> = {};
    const dbPatch: Database['public']['Tables']['users']['Update'] = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) {
      const name = requireName(input.name);
      if (db.users().some((u) => u.id !== existing.id && u.name.toLowerCase() === name.toLowerCase())) {
        throw new ApiError(409, `${name} is already on the board.`);
      }
      patch.name = name;
      dbPatch.name = name;
    }
    if (input.age !== undefined) {
      const age = optionalAge(input.age);
      patch.age = age;
      dbPatch.age = age;
    }
    if (input.weightKg !== undefined) {
      const weightKg = requireWeight(input.weightKg);
      patch.weightKg = weightKg;
      dbPatch.weight_kg = weightKg;
    }
    if (input.note !== undefined) {
      const note = String(input.note).slice(0, 200);
      patch.note = note;
      dbPatch.note = note;
    }

    const { error } = await supabase
      .from('users')
      .update(dbPatch)
      .eq('id', id);

    if (error) {
      throw new ApiError(400, error.message);
    }

    db.updateUser(existing.id, patch);
    return { user: userDetail(existing.id)! as UserResponse['user'], ...meta() };
  },

  deleteUser: async (id: string): Promise<{ ok: true }> => {
    findUserOr404(id);
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      throw new ApiError(400, error.message);
    }

    db.deleteUser(id);
    void supabase.storage.from(AVATAR_BUCKET).remove([avatarPath(id)]); // best effort
    return { ok: true };
  },

  addAttempt: async (userId: string, input: AttemptInput): Promise<UserResponse> => {
    const user = findUserOr404(userId);
    const cat = db.category(input.categoryId ?? '') ?? db.defaultCategory();
    const beforeUser = userDetail(user.id, cat.id);
    const reps = requireReps(input.reps);
    const weightKg =
      input.weightKg === undefined || input.weightKg === null || input.weightKg === ''
        ? Number(user.weightKg)
        : requireWeight(input.weightKg);
    const date = requireDate(input.date);
    const note = String(input.note ?? '').slice(0, 200);
    const now = new Date().toISOString();
    const medianSnapshot = medianMass();

    const sessionPayload = {
      id: randomUUID(),
      user_id: user.id,
      exercise_category_id: cat.id,
      reps,
      weight_kg: weightKg,
      median_mass_kg: medianSnapshot,
      date,
      note,
      created_at: now,
    };

    const { data: sessionRow, error } = await supabase
      .from('sessions')
      .insert(sessionPayload)
      .select()
      .single();

    if (error) {
      throw new ApiError(400, error.message);
    }

    db.insertSession({
      id: sessionRow.id,
      userId: sessionRow.user_id,
      exerciseCategoryId: sessionRow.exercise_category_id,
      reps: sessionRow.reps,
      weightKg: Number(sessionRow.weight_kg),
      medianMassKg:
        sessionRow.median_mass_kg != null ? Number(sessionRow.median_mass_kg) : medianSnapshot,
      date: sessionRow.date,
      note: sessionRow.note,
      createdAt: sessionRow.created_at,
    });

    const afterUser = userDetail(user.id, cat.id)! as UserResponse['user'];
    const celebration = computeGamificationDelta(beforeUser, afterUser, reps, cat.name);

    return { user: afterUser, celebration, ...meta(cat.id) };
  },

  deleteAttempt: async (attemptId: string): Promise<{ ok: true }> => {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', attemptId);

    if (error) {
      throw new ApiError(400, error.message);
    }

    db.deleteSession(attemptId);
    return { ok: true };
  },

  importCsv: async (userId: string, csv: string, categorySlugOrId?: string): Promise<ImportResponse> => {
    const user = findUserOr404(userId);
    const cat = db.category(categorySlugOrId ?? '') ?? db.defaultCategory();
    const { rows, errors } = parseCSV(csv);
    if (rows.length === 0 && errors.length === 0) {
      throw new ApiError(400, 'Nothing to import – the file was empty.');
    }
    const now = new Date().toISOString();
    const medianSnapshot = medianMass();
    const sessionsToInsert = rows.map((row: { reps: number; date: string; weight: number | null; note: string }) => ({
      id: randomUUID(),
      user_id: user.id,
      exercise_category_id: cat.id,
      reps: row.reps,
      weight_kg: row.weight ?? Number(user.weightKg),
      median_mass_kg: medianSnapshot,
      date: row.date,
      note: row.note ?? '',
      created_at: now,
    }));

    const { error } = await supabase.from('sessions').insert(sessionsToInsert);
    if (error) {
      throw new ApiError(400, error.message);
    }

    sessionsToInsert.forEach((s) => {
      db.insertSession({
        id: s.id,
        userId: s.user_id,
        exerciseCategoryId: s.exercise_category_id,
        reps: s.reps,
        weightKg: s.weight_kg,
        medianMassKg: medianSnapshot,
        date: s.date,
        note: s.note,
        createdAt: s.created_at,
      });
    });

    return { imported: rows.length, errors, user: userDetail(user.id, cat.id)! as UserResponse['user'], ...meta(cat.id) };
  },

  verifyPassword: async (password: string): Promise<boolean> => {
    const trimmed = String(password ?? '').trim();
    if (!trimmed) return false;
    const { data, error } = await supabase.rpc('verify_app_password', {
      candidate_password: trimmed,
    });
    if (error) {
      throw new ApiError(500, error.message);
    }
    return Boolean(data);
  },
};
