import { supabase } from './supabase.js';

export const DEFAULT_CATEGORY = {
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
};

let cache = null;
let lastSyncTime = 0;
const CACHE_TTL_MS = 3000; // 3 seconds in-memory TTL for serverless invocations

export async function syncFromSupabase() {
  const now = Date.now();
  if (cache && now - lastSyncTime < CACHE_TTL_MS) {
    return cache;
  }

  try {
    const [categoriesRes, usersRes, sessionsRes] = await Promise.all([
      supabase
        .from('exercise_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      supabase.from('users').select('*').order('created_at', { ascending: true }),
      supabase.from('sessions').select('*').order('created_at', { ascending: true }),
    ]);

    if (categoriesRes.error) console.error('[supabase] categories error:', categoriesRes.error.message);
    if (usersRes.error) console.error('[supabase] users error:', usersRes.error.message);
    if (sessionsRes.error) console.error('[supabase] sessions error:', sessionsRes.error.message);

    const categories = categoriesRes.data && categoriesRes.data.length > 0
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
      : [DEFAULT_CATEGORY];

    const users = usersRes.data
      ? usersRes.data.map((u) => ({
          id: u.id,
          name: u.name,
          age: u.age,
          weightKg: Number(u.weight_kg),
          note: u.note ?? '',
          createdAt: u.created_at,
          updatedAt: u.updated_at,
        }))
      : [];

    const defaultCatId = categories[0]?.id ?? DEFAULT_CATEGORY.id;

    const sessions = sessionsRes.data
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
      : [];

    cache = { categories, users, sessions };
    lastSyncTime = now;
    return cache;
  } catch (err) {
    console.error('[supabase] sync exception:', err);
    if (cache) return cache;
    return { categories: [DEFAULT_CATEGORY], users: [], sessions: [] };
  }
}

export const db = {
  get data() {
    return cache ?? { categories: [DEFAULT_CATEGORY], users: [], sessions: [] };
  },
  categories() {
    return (cache?.categories && cache.categories.length > 0) ? cache.categories : [DEFAULT_CATEGORY];
  },
  category(idOrSlug) {
    if (!idOrSlug) return null;
    if (typeof idOrSlug === 'object' && 'id' in idOrSlug) return idOrSlug;
    if (typeof idOrSlug !== 'string') return null;
    const lower = idOrSlug.toLowerCase();
    const cats = this.categories();
    return cats.find((c) => c.id === idOrSlug || c.slug.toLowerCase() === lower) ?? null;
  },
  defaultCategory() {
    return this.categories()[0] ?? DEFAULT_CATEGORY;
  },
  users() {
    return cache?.users ?? [];
  },
  sessions() {
    return cache?.sessions ?? [];
  },
  sessionsOf(userId) {
    return (cache?.sessions ?? []).filter((s) => s.userId === userId);
  },
  sessionsOfCategory(categoryIdOrSlug) {
    const cat = this.category(categoryIdOrSlug) ?? this.defaultCategory();
    return (cache?.sessions ?? []).filter((s) => s.exerciseCategoryId === cat.id);
  },
  sessionsOfUserAndCategory(userId, categoryIdOrSlug) {
    const cat = this.category(categoryIdOrSlug) ?? this.defaultCategory();
    return (cache?.sessions ?? []).filter((s) => s.userId === userId && s.exerciseCategoryId === cat.id);
  },
  user(id) {
    return (cache?.users ?? []).find((u) => u.id === id) ?? null;
  },
  session(id) {
    return (cache?.sessions ?? []).find((s) => s.id === id) ?? null;
  },
  invalidate() {
    cache = null;
    lastSyncTime = 0;
  },
};
