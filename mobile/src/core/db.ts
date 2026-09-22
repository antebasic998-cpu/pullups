/**
 * In-memory JSON store with Supabase remote backend and AsyncStorage offline cache.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { invalidate } from '../lib/store';

const STORAGE_KEY = '@pullup/db_v2';

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

export interface RawUser {
  id: string;
  name: string;
  age: number | null;
  weightKg: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface RawSession {
  id: string;
  userId: string;
  exerciseCategoryId: string;
  reps: number;
  weightKg: number;
  date: string;
  note: string;
  createdAt: string;
}

export interface DbData {
  categories: RawExerciseCategory[];
  users: RawUser[];
  sessions: RawSession[];
}

export const DEFAULT_CATEGORY: RawExerciseCategory = {
  id: 'c01b1e85-3966-478d-b27c-bd7be751c1a8',
  slug: 'pull-ups',
  name: 'Pull-ups',
  shortName: null,
  description: '',
  iconKey: 'pull-up',
  unit: 'reps',
  scoreType: 'bodyweight_normalized',
  normalizationType: 'bodyweight_power',
  normalizationExponent: 0.67,
  isActive: true,
  displayOrder: 1,
  createdAt: '2026-09-22T11:24:55.207Z',
  updatedAt: '2026-09-22T11:24:55.207Z',
};

const EMPTY: DbData = { categories: [DEFAULT_CATEGORY], users: [], sessions: [] };

let cache: DbData | null = null;
let persistQueue: Promise<void> = Promise.resolve();

async function persist() {
  if (!cache) return;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

function schedulePersist() {
  persistQueue = persistQueue.then(() => persist()).catch(console.error);
}

export async function syncFromSupabase(): Promise<DbData> {
  try {
    const [categoriesRes, usersRes, sessionsRes] = await Promise.all([
      supabase.from('exercise_categories').select('*').eq('is_active', true).order('display_order', { ascending: true }),
      supabase.from('users').select('*').order('created_at', { ascending: true }),
      supabase.from('sessions').select('*').order('created_at', { ascending: true }),
    ]);

    if (categoriesRes.error) {
      console.warn('[supabase] categories sync error:', categoriesRes.error.message);
    }
    if (usersRes.error) {
      console.warn('[supabase] users sync error:', usersRes.error.message);
    }
    if (sessionsRes.error) {
      console.warn('[supabase] sessions sync error:', sessionsRes.error.message);
    }

    const categoriesData: RawExerciseCategory[] = categoriesRes.data && categoriesRes.data.length > 0
      ? categoriesRes.data.map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          shortName: c.short_name,
          description: c.description ?? '',
          iconKey: c.icon_key,
          unit: c.unit,
          scoreType: c.score_type,
          normalizationType: c.normalization_type,
          normalizationExponent: Number(c.normalization_exponent),
          isActive: c.is_active,
          displayOrder: c.display_order,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }))
      : (cache?.categories && cache.categories.length > 0 ? cache.categories : [DEFAULT_CATEGORY]);

    const usersData: RawUser[] = usersRes.data
      ? usersRes.data.map((u) => ({
          id: u.id,
          name: u.name,
          age: u.age,
          weightKg: Number(u.weight_kg),
          note: u.note ?? '',
          createdAt: u.created_at,
          updatedAt: u.updated_at,
        }))
      : (cache?.users ?? []);

    const defaultCatId = categoriesData[0]?.id ?? DEFAULT_CATEGORY.id;

    const sessionsData: RawSession[] = sessionsRes.data
      ? sessionsRes.data.map((s) => ({
          id: s.id,
          userId: s.user_id,
          exerciseCategoryId: s.exercise_category_id ?? defaultCatId,
          reps: Number(s.reps),
          weightKg: Number(s.weight_kg),
          date: s.date,
          note: s.note ?? '',
          createdAt: s.created_at,
        }))
      : (cache?.sessions ?? []);

    cache = {
      categories: categoriesData,
      users: usersData,
      sessions: sessionsData,
    };

    schedulePersist();
    invalidate();
    return cache;
  } catch (err) {
    console.warn('[supabase] sync exception:', err);
  }
  return ensureLoaded();
}

export function subscribeToRealtime(): () => void {
  const channel = supabase
    .channel('leaderboard-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'exercise_categories' },
      () => {
        void syncFromSupabase();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'users' },
      () => {
        void syncFromSupabase();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sessions' },
      () => {
        void syncFromSupabase();
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

let initialized = false;

export async function initDb(): Promise<DbData> {
  if (initialized && cache && cache.users.length > 0) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DbData>;
      if (Array.isArray(parsed.users) && parsed.users.length > 0) {
        cache = {
          categories: Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : [DEFAULT_CATEGORY],
          users: parsed.users,
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        };
      }
    }
  } catch (err) {
    console.error('[db] failed to load async storage cache', err);
  }

  if (!cache) {
    cache = structuredClone(EMPTY);
  }

  // Sync latest from Supabase
  await syncFromSupabase();
  initialized = true;

  return cache;
}

export function ensureLoaded(): DbData {
  if (!cache) {
    cache = structuredClone(EMPTY);
  }
  return cache;
}

export const db = {
  get data() {
    return ensureLoaded();
  },
  categories() {
    const cats = ensureLoaded().categories;
    return cats.length > 0 ? cats : [DEFAULT_CATEGORY];
  },
  category(idOrSlug: string | RawExerciseCategory | null | undefined): RawExerciseCategory | null {
    if (!idOrSlug) return null;
    if (typeof idOrSlug === 'object' && 'id' in idOrSlug) {
      return idOrSlug as RawExerciseCategory;
    }
    if (typeof idOrSlug !== 'string') return null;
    const lower = idOrSlug.toLowerCase();
    return ensureLoaded().categories.find((c) => c.id === idOrSlug || c.slug.toLowerCase() === lower) ?? null;
  },
  defaultCategory(): RawExerciseCategory {
    const cats = ensureLoaded().categories;
    return cats[0] ?? DEFAULT_CATEGORY;
  },
  users() {
    return ensureLoaded().users;
  },
  sessions() {
    return ensureLoaded().sessions;
  },
  sessionsOf(userId: string) {
    return ensureLoaded().sessions.filter((s) => s.userId === userId);
  },
  sessionsOfCategory(categoryIdOrSlug: string) {
    const cat = db.category(categoryIdOrSlug) ?? db.defaultCategory();
    return ensureLoaded().sessions.filter((s) => s.exerciseCategoryId === cat.id);
  },
  sessionsOfUserAndCategory(userId: string, categoryIdOrSlug: string) {
    const cat = db.category(categoryIdOrSlug) ?? db.defaultCategory();
    return ensureLoaded().sessions.filter((s) => s.userId === userId && s.exerciseCategoryId === cat.id);
  },
  user(id: string) {
    return ensureLoaded().users.find((u) => u.id === id) ?? null;
  },
  session(id: string) {
    return ensureLoaded().sessions.find((s) => s.id === id) ?? null;
  },
  insertUser(user: RawUser) {
    ensureLoaded().users.push(user);
    schedulePersist();
    return user;
  },
  insertSession(session: RawSession) {
    ensureLoaded().sessions.push(session);
    schedulePersist();
    return session;
  },
  updateUser(id: string, patch: Partial<RawUser>) {
    const users = ensureLoaded().users;
    const i = users.findIndex((u) => u.id === id);
    if (i === -1) return null;
    users[i] = { ...users[i], ...patch, id, updatedAt: new Date().toISOString() };
    schedulePersist();
    return users[i];
  },
  deleteUser(id: string) {
    const data = ensureLoaded();
    const before = data.users.length;
    data.users = data.users.filter((u) => u.id !== id);
    if (data.users.length === before) return false;
    data.sessions = data.sessions.filter((s) => s.userId !== id);
    schedulePersist();
    return true;
  },
  deleteSession(id: string) {
    const data = ensureLoaded();
    const before = data.sessions.length;
    data.sessions = data.sessions.filter((s) => s.id !== id);
    if (data.sessions.length === before) return false;
    schedulePersist();
    return true;
  },
  replaceAll(next: DbData) {
    cache = {
      categories: Array.isArray(next.categories) && next.categories.length > 0 ? next.categories : [DEFAULT_CATEGORY],
      users: Array.isArray(next.users) ? next.users : [],
      sessions: Array.isArray(next.sessions) ? next.sessions : [],
    };
    schedulePersist();
    return cache;
  },
  isEmpty() {
    const data = ensureLoaded();
    return data.users.length === 0 && data.sessions.length === 0;
  },
};
