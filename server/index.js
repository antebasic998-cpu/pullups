/**
 * Pull-up leaderboard API server (Supabase-backed for serverless/Vercel and local).
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { db, syncFromSupabase } from './store.js';
import { supabase } from './supabase.js';
import { allUsers, leaderboard, meta, office, parseCSV, userDetail } from './service.js';
import { todayISO } from './scoring.js';
import { DEFAULT_PORT } from './ports.js';
import { inferCategoryIconKey, slugifyCategoryName } from './categoryUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');

export const app = express();
app.use(express.json({ limit: '2mb' }));

// Middleware to sync cache from Supabase on incoming requests
app.use(async (_req, _res, next) => {
  try {
    await syncFromSupabase();
  } catch (err) {
    console.error('Failed to sync from Supabase:', err);
  }
  next();
});

/* ---------------------------------------------------------------- *
 * Validation helpers
 * ---------------------------------------------------------------- */

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requireName(raw) {
  const name = String(raw ?? '').trim();
  if (!name) throw new HttpError(400, 'Name is required.');
  if (name.length > 60) throw new HttpError(400, 'Name must be 60 characters or fewer.');
  return name;
}

function requireWeight(raw) {
  const w = Number(String(raw ?? '').replace(',', '.'));
  if (!Number.isFinite(w)) throw new HttpError(400, 'Weight is required.');
  if (w < 20 || w > 400) throw new HttpError(400, 'Weight must be between 20 and 400 kg.');
  return Math.round(w * 10) / 10;
}

function optionalAge(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const a = Number(raw);
  if (!Number.isFinite(a) || a < 5 || a > 120) throw new HttpError(400, 'Age must be between 5 and 120.');
  return Math.round(a);
}

function requireReps(raw) {
  const r = Number(raw);
  if (!Number.isFinite(r)) throw new HttpError(400, 'Repetition count is required.');
  if (r < 1 || r > 500) throw new HttpError(400, 'Repetition count must be between 1 and 500.');
  return Math.round(r);
}

function requireDate(raw) {
  const value = String(raw ?? '').trim();
  const iso = value || todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(Date.parse(iso))) {
    throw new HttpError(400, 'Date must look like YYYY-MM-DD.');
  }
  return iso;
}

function requireCategoryName(raw) {
  const name = String(raw ?? '').trim();
  if (!name) throw new HttpError(400, 'Exercise name is required.');
  if (name.length > 80) throw new HttpError(400, 'Exercise name must be 80 characters or fewer.');
  return name;
}

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

function findUserOr404(id) {
  const user = db.user(id);
  if (!user) throw new HttpError(404, 'User not found.');
  return user;
}

/* ---------------------------------------------------------------- *
 * API Endpoints
 * ---------------------------------------------------------------- */

app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    backend: 'supabase',
    categories: db.categories().length,
    users: db.users().length,
  }),
);

app.get('/api/categories', (_req, res) => res.json({ categories: db.categories() }));

app.post(
  '/api/categories',
  wrap(async (req, res) => {
    const name = requireCategoryName(req.body?.name);
    const slug = slugifyCategoryName(name);
    if (!slug) throw new HttpError(400, 'Exercise name must contain letters or numbers.');
    if (db.categories().some((c) => c.slug === slug)) {
      throw new HttpError(409, `${name} already exists on the board.`);
    }

    const displayOrder = db.categories().reduce((max, c) => Math.max(max, c.displayOrder), 0) + 1;
    const iconKey = inferCategoryIconKey(slug, name);
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('exercise_categories')
      .insert({
        slug,
        name,
        short_name: null,
        description: String(req.body?.description ?? '').slice(0, 200) || null,
        icon_key: iconKey,
        unit: 'reps',
        score_type: 'bodyweight_normalized',
        normalization_type: 'bodyweight_power',
        normalization_exponent: 0.67,
        is_active: true,
        display_order: displayOrder,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw new HttpError(400, error.message);

    await syncFromSupabase();

    const category = {
      id: data.id,
      slug: data.slug,
      name: data.name,
      shortName: data.short_name,
      description: data.description ?? '',
      iconKey: data.icon_key,
      unit: data.unit,
      scoreType: data.score_type,
      normalizationType: data.normalization_type,
      normalizationExponent: Number(data.normalization_exponent),
      isActive: data.is_active,
      displayOrder: data.display_order,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    res.status(201).json({ category });
  }),
);

app.get('/api/meta', (req, res) => res.json(meta(req.query.category ?? null)));

app.get('/api/leaderboard', (req, res) => {
  const category = req.query.category ?? null;
  const mode = String(req.query.mode ?? 'best');
  res.json({ ...leaderboard(category, mode), ...meta(category) });
});

app.get('/api/office', (_req, res) => res.json({ ...office(), ...meta() }));

app.get('/api/users', (req, res) => {
  const category = req.query.category ?? null;
  res.json({ users: allUsers(category), ...meta(category) });
});

app.post(
  '/api/users',
  wrap(async (req, res) => {
    const now = new Date().toISOString();
    const name = requireName(req.body?.name);
    if (db.users().some((u) => u.name.toLowerCase() === name.toLowerCase())) {
      throw new HttpError(409, `${name} is already on the board.`);
    }

    const seedRepsRaw = req.body?.pbAbsolute ?? req.body?.pb;
    const hasSeed = seedRepsRaw !== null && seedRepsRaw !== undefined && seedRepsRaw !== '';
    const seedReps = hasSeed ? requireReps(seedRepsRaw) : null;
    const seedDate = hasSeed ? requireDate(req.body?.pbDate ?? req.body?.date) : null;
    const defaultCat = db.defaultCategory();

    const userPayload = {
      id: randomUUID(),
      name,
      age: optionalAge(req.body?.age),
      weight_kg: requireWeight(req.body?.weightKg ?? req.body?.weight),
      note: String(req.body?.note ?? '').slice(0, 200),
      created_at: now,
      updated_at: now,
    };

    const { data: userRow, error: uErr } = await supabase
      .from('users')
      .insert(userPayload)
      .select()
      .single();

    if (uErr) throw new HttpError(400, uErr.message);

    if (seedReps !== null) {
      const sessionPayload = {
        id: randomUUID(),
        user_id: userRow.id,
        exercise_category_id: defaultCat.id,
        reps: seedReps,
        weight_kg: Number(userRow.weight_kg),
        date: seedDate,
        note: 'Personal best on joining',
        created_at: now,
      };
      await supabase.from('sessions').insert(sessionPayload);
    }

    db.invalidate();
    await syncFromSupabase();
    res.status(201).json({ user: userDetail(userRow.id, defaultCat.id), ...meta(defaultCat.id) });
  }),
);

app.get(
  '/api/users/:id',
  wrap((req, res) => {
    const category = req.query.category ?? null;
    const view = userDetail(req.params.id, category);
    if (!view) throw new HttpError(404, 'User not found.');
    res.json({ user: view, ...meta(category) });
  }),
);

app.patch(
  '/api/users/:id',
  wrap(async (req, res) => {
    const existing = findUserOr404(req.params.id);
    const dbPatch = { updated_at: new Date().toISOString() };

    if (req.body?.name !== undefined) {
      const name = requireName(req.body.name);
      if (db.users().some((u) => u.id !== existing.id && u.name.toLowerCase() === name.toLowerCase())) {
        throw new HttpError(409, `${name} is already on the board.`);
      }
      dbPatch.name = name;
    }
    if (req.body?.age !== undefined) dbPatch.age = optionalAge(req.body.age);
    if (req.body?.weightKg !== undefined || req.body?.weight !== undefined) {
      dbPatch.weight_kg = requireWeight(req.body.weightKg ?? req.body.weight);
    }
    if (req.body?.note !== undefined) dbPatch.note = String(req.body.note).slice(0, 200);

    const { error } = await supabase.from('users').update(dbPatch).eq('id', existing.id);
    if (error) throw new HttpError(400, error.message);

    db.invalidate();
    await syncFromSupabase();
    res.json({ user: userDetail(existing.id), ...meta() });
  }),
);

app.delete(
  '/api/users/:id',
  wrap(async (req, res) => {
    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    if (error) throw new HttpError(400, error.message);
    db.invalidate();
    await syncFromSupabase();
    res.json({ ok: true, ...meta() });
  }),
);

app.post(
  '/api/users/:id/sessions',
  wrap(async (req, res) => {
    const user = findUserOr404(req.params.id);
    const cat = db.category(req.body?.categoryId ?? '') ?? db.defaultCategory();
    const reps = requireReps(req.body?.reps);
    const weightKg =
      req.body?.weightKg === undefined || req.body?.weightKg === null || req.body?.weightKg === ''
        ? Number(user.weightKg)
        : requireWeight(req.body.weightKg);
    const date = requireDate(req.body?.date);
    const note = String(req.body?.note ?? '').slice(0, 200);
    const now = new Date().toISOString();

    const sessionPayload = {
      id: randomUUID(),
      user_id: user.id,
      exercise_category_id: cat.id,
      reps,
      weight_kg: weightKg,
      date,
      note,
      created_at: now,
    };

    const { error } = await supabase.from('sessions').insert(sessionPayload);
    if (error) throw new HttpError(400, error.message);

    db.invalidate();
    await syncFromSupabase();
    res.status(201).json({ user: userDetail(user.id, cat.id), ...meta(cat.id) });
  }),
);

app.delete(
  '/api/sessions/:id',
  wrap(async (req, res) => {
    const { error } = await supabase.from('sessions').delete().eq('id', req.params.id);
    if (error) throw new HttpError(400, error.message);
    db.invalidate();
    await syncFromSupabase();
    res.json({ ok: true });
  }),
);

app.post(
  '/api/users/:id/import',
  wrap(async (req, res) => {
    const user = findUserOr404(req.params.id);
    const cat = db.category(req.body?.categoryId ?? '') ?? db.defaultCategory();
    const { rows, errors } = parseCSV(req.body?.csv ?? '');
    if (rows.length === 0 && errors.length === 0) throw new HttpError(400, 'Nothing to import – the file was empty.');
    const now = new Date().toISOString();

    const sessionsToInsert = rows.map((row) => ({
      id: randomUUID(),
      user_id: user.id,
      exercise_category_id: cat.id,
      reps: row.reps,
      weight_kg: row.weight ?? Number(user.weightKg),
      date: row.date,
      note: row.note ?? '',
      created_at: now,
    }));

    if (sessionsToInsert.length > 0) {
      const { error } = await supabase.from('sessions').insert(sessionsToInsert);
      if (error) throw new HttpError(400, error.message);
    }

    db.invalidate();
    await syncFromSupabase();
    res.status(201).json({ imported: rows.length, errors, user: userDetail(user.id, cat.id), ...meta(cat.id) });
  }),
);

app.post(
  '/api/verify-password',
  wrap(async (req, res) => {
    const candidate = String(req.body?.password ?? '').trim();
    if (!candidate) return res.json({ valid: false });
    const { data, error } = await supabase.rpc('verify_app_password', {
      candidate_password: candidate,
    });
    if (error) throw new HttpError(500, error.message);
    res.json({ valid: Boolean(data) });
  }),
);

/* ---------------------------------------------------------------- *
 * Static web app (production build only)
 * ---------------------------------------------------------------- */

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

/* ---------------------------------------------------------------- *
 * Errors
 * ---------------------------------------------------------------- */

app.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Something went wrong.' });
});

// Start listening if run directly (node server/index.js)
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  try {
    fs.mkdirSync(path.resolve(__dirname, '..', 'data'), { recursive: true });
    fs.writeFileSync(path.resolve(__dirname, '..', 'data', '.api-port'), String(port));
  } catch {}
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}
