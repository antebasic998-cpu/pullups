/**
 * Pull-up leaderboard API + static host.
 *
 *   npm run dev    → API on :4931, Vite dev server on :5273 (proxying /api)
 *   npm run build  → builds the web app into web/dist
 *   npm start      → API + built web app on :4931, reachable from the whole office LAN
 *
 * If the preferred port is taken, the next free one is used instead (see ports.js).
 */
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { db, DB_FILE } from './store.js';
import { allUsers, leaderboard, meta, office, parseCSV, userDetail } from './service.js';
import { todayISO } from './scoring.js';
import { DEFAULT_PORT, PORT_FILE } from './ports.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'web', 'dist');
/** PORT may be set explicitly; otherwise we start at 4931 and step up if busy. */
const REQUESTED_PORT = Number(process.env.PORT ?? DEFAULT_PORT);
const EXPLICIT_PORT = process.env.PORT !== undefined;
const HOST = process.env.HOST ?? '0.0.0.0';

/** Whichever port we actually claimed; filled in once listening. */
let currentPort = REQUESTED_PORT;

const app = express();
app.use(express.json({ limit: '2mb' }));

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
  if (!Number.isFinite(r)) throw new HttpError(400, 'Pull-up count is required.');
  if (r < 1 || r > 500) throw new HttpError(400, 'Pull-up count must be between 1 and 500.');
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

const wrap = (fn) => (req, res, next) => {
  try {
    fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

function findUserOr404(id) {
  const user = db.user(id);
  if (!user) throw new HttpError(404, 'User not found.');
  return user;
}

/* ---------------------------------------------------------------- *
 * API
 * ---------------------------------------------------------------- */

app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    db: DB_FILE,
    port: currentPort,
    /** Addresses a colleague on the same Wi-Fi can use. */
    share: lanAddresses().map((i) => `http://${i.address}:${currentPort}`),
  }),
);

app.get('/api/meta', (_req, res) => res.json(meta()));

app.get('/api/leaderboard', (req, res) => {
  res.json(leaderboard(String(req.query.mode ?? 'best')));
});

/** Weekly office awards, the XP race and the badge wall. */
app.get('/api/office', (_req, res) => res.json(office()));

app.get('/api/users', (_req, res) => res.json({ users: allUsers(), ...meta() }));

app.post(
  '/api/users',
  wrap((req, res) => {
    const now = new Date().toISOString();
    const name = requireName(req.body?.name);
    if (db.users().some((u) => u.name.toLowerCase() === name.toLowerCase())) {
      throw new HttpError(409, `${name} is already on the board.`);
    }

    // Validate everything up front so a rejected optional PB cannot leave a
    // half-created athlete behind.
    const seedRepsRaw = req.body?.pbAbsolute ?? req.body?.pb;
    const hasSeed = seedRepsRaw !== null && seedRepsRaw !== undefined && seedRepsRaw !== '';
    const seedReps = hasSeed ? requireReps(seedRepsRaw) : null;
    const seedDate = hasSeed ? requireDate(req.body?.pbDate ?? req.body?.date) : null;

    const user = {
      id: randomUUID(),
      name,
      age: optionalAge(req.body?.age),
      weightKg: requireWeight(req.body?.weightKg ?? req.body?.weight),
      note: String(req.body?.note ?? '').slice(0, 200),
      createdAt: now,
      updatedAt: now,
    };
    db.insertUser(user);

    if (seedReps !== null) {
      db.insertSession({
        id: randomUUID(),
        userId: user.id,
        reps: seedReps,
        weightKg: user.weightKg,
        date: seedDate,
        note: 'Personal best on joining',
        createdAt: now,
      });
    }
    res.status(201).json({ user: userDetail(user.id), ...meta() });
  }),
);

app.get(
  '/api/users/:id',
  wrap((req, res) => {
    const view = userDetail(req.params.id);
    if (!view) throw new HttpError(404, 'User not found.');
    res.json({ user: view, ...meta() });
  }),
);

app.patch(
  '/api/users/:id',
  wrap((req, res) => {
    const existing = findUserOr404(req.params.id);
    const patch = {};
    if (req.body?.name !== undefined) {
      const name = requireName(req.body.name);
      if (db.users().some((u) => u.id !== existing.id && u.name.toLowerCase() === name.toLowerCase())) {
        throw new HttpError(409, `${name} is already on the board.`);
      }
      patch.name = name;
    }
    if (req.body?.age !== undefined) patch.age = optionalAge(req.body.age);
    if (req.body?.weightKg !== undefined || req.body?.weight !== undefined) {
      patch.weightKg = requireWeight(req.body.weightKg ?? req.body.weight);
    }
    if (req.body?.note !== undefined) patch.note = String(req.body.note).slice(0, 200);
    db.updateUser(existing.id, patch);
    res.json({ user: userDetail(existing.id), ...meta() });
  }),
);

app.delete(
  '/api/users/:id',
  wrap((req, res) => {
    if (!db.deleteUser(req.params.id)) throw new HttpError(404, 'User not found.');
    res.json({ ok: true, ...meta() });
  }),
);

app.post(
  '/api/users/:id/sessions',
  wrap((req, res) => {
    const user = findUserOr404(req.params.id);
    const session = {
      id: randomUUID(),
      userId: user.id,
      reps: requireReps(req.body?.reps),
      weightKg:
        req.body?.weightKg === undefined || req.body?.weightKg === null || req.body?.weightKg === ''
          ? Number(user.weightKg)
          : requireWeight(req.body.weightKg),
      date: requireDate(req.body?.date),
      note: String(req.body?.note ?? '').slice(0, 200),
      createdAt: new Date().toISOString(),
    };
    db.insertSession(session);
    res.status(201).json({ user: userDetail(user.id), ...meta() });
  }),
);

app.delete(
  '/api/sessions/:id',
  wrap((req, res) => {
    if (!db.deleteSession(req.params.id)) throw new HttpError(404, 'Result not found.');
    res.json({ ok: true });
  }),
);

app.post(
  '/api/users/:id/import',
  wrap((req, res) => {
    const user = findUserOr404(req.params.id);
    const { rows, errors } = parseCSV(req.body?.csv ?? '');
    if (rows.length === 0 && errors.length === 0) throw new HttpError(400, 'Nothing to import – the file was empty.');
    const now = new Date().toISOString();
    rows.forEach((row) => {
      db.insertSession({
        id: randomUUID(),
        userId: user.id,
        reps: row.reps,
        weightKg: row.weightKg ?? Number(user.weightKg),
        date: row.date,
        note: row.note,
        createdAt: now,
      });
    });
    res.status(201).json({ imported: rows.length, errors, user: userDetail(user.id), ...meta() });
  }),
);

/** One-click JSON backup of everything, for the office shared folder. */
app.get('/api/backup', (_req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="pullup-backup-${todayISO()}.json"`);
  res.json(db.data);
});

/* ---------------------------------------------------------------- *
 * Static web app (production build only – in dev, Vite serves it)
 * ---------------------------------------------------------------- */

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
} else {
  app.get('/', (_req, res) =>
    res
      .status(200)
      .type('html')
      .send('<h1>PullUp Leaderboard API</h1><p>Run <code>npm run dev</code> for the web app, or <code>npm run build</code> to serve it from here.</p>'),
  );
}

/* ---------------------------------------------------------------- *
 * Errors + startup
 * ---------------------------------------------------------------- */

app.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Something went wrong.' });
});

/**
 * Real LAN addresses worth sharing.
 *
 * Only physical interfaces count: Docker/VM/Thunderbolt bridges and VPN tunnels
 * (`bridge100`, `utun*`, `vmnet*`, …) have their own private IPs that no other
 * machine on the office Wi-Fi can route to, and handing one out is the classic
 * "it works on my laptop but nobody can open it" trap.
 */
const VIRTUAL_INTERFACE = /^(bridge|utun|awdl|llw|vmnet|vboxnet|docker|anpi|tap|tun|gif|stf|p2p|ap\d)/;

/** "en0" → "Wi-Fi", using macOS's own hardware port names (best effort). */
function hardwarePortNames() {
  try {
    const out = execFileSync('/usr/sbin/networksetup', ['-listallhardwareports'], {
      encoding: 'utf8',
      timeout: 2000,
    });
    const map = new Map();
    let port = null;
    for (const line of out.split('\n')) {
      const named = line.match(/^Hardware Port: (.+)$/);
      if (named) {
        port = named[1].trim();
        continue;
      }
      const device = line.match(/^Device: (\S+)$/);
      if (device && port) map.set(device[1], port);
    }
    return map;
  } catch {
    return new Map(); // non-macOS, or networksetup unavailable
  }
}

function lanAddresses() {
  const ports = hardwarePortNames();
  const found = [];

  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    if (VIRTUAL_INTERFACE.test(name)) continue;
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      if (address.address.startsWith('169.254.')) continue; // link-local
      found.push({ name, label: ports.get(name) ?? name, address: address.address });
    }
  }

  const rank = (i) => (/wi-?fi/i.test(i.label) ? 0 : /ethernet/i.test(i.label) ? 1 : 2);
  return found.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/**
 * Start listening, stepping up to the next free port if the preferred one is
 * taken, so a second instance (or an unrelated project) can never crash the app
 * with EADDRINUSE. The chosen port is written to data/.api-port so the Vite dev
 * proxy can follow along.
 */
function listen(port, attempt = 0) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, HOST);

    server.once('listening', () => resolve({ server, port }));
    server.once('error', (err) => {
      if (err.code !== 'EADDRINUSE') return reject(err);

      if (EXPLICIT_PORT) {
        reject(
          new Error(
            `Port ${port} is already in use (you asked for it explicitly with PORT=${port}).\n` +
              `  Find it:  lsof -ti:${port}\n` +
              `  Free it:  lsof -ti:${port} | xargs kill\n` +
              `  Or pick another:  PORT=${port + 1} npm start`,
          ),
        );
        return;
      }
      if (attempt >= 9) {
        reject(new Error(`Ports ${port - attempt}–${port} are all busy. Free one or run with PORT=<free port> npm start`));
        return;
      }
      console.log(`  … port ${port} is busy, trying ${port + 1}`);
      resolve(listen(port + 1, attempt + 1));
    });
  });
}

try {
  const { port } = await listen(REQUESTED_PORT);
  currentPort = port;
  const built = fs.existsSync(DIST);

  try {
    fs.mkdirSync(path.resolve(__dirname, '..', 'data'), { recursive: true });
    fs.writeFileSync(path.resolve(__dirname, '..', PORT_FILE), String(port), 'utf8');
  } catch {
    /* the port file is a convenience for the dev proxy only */
  }

  const lan = lanAddresses();
  const share = lan.map((i) => `http://${i.address}:${port}`);

  console.log(`\n  💪 Pull-up leaderboard → http://localhost:${port}`);
  if (lan.length > 0) {
    console.log('\n  Same Wi-Fi? Colleagues open this address in their browser:\n');
    for (const iface of lan) console.log(`     http://${iface.address}:${port}   (${iface.label})`);
    console.log(
      '\n     Everyone shares one board — results land in the same file no matter\n' +
        '     who is typing. Your Mac must stay awake with this terminal open.',
    );
  } else {
    console.log('\n  No Wi-Fi/Ethernet address found — only this machine can open the app.');
  }
  console.log(`\n  Data file: ${DB_FILE}`);
  if (port !== REQUESTED_PORT) console.log(`  Note: port ${REQUESTED_PORT} was busy, using ${port}`);
  if (!built) console.log('  Dev mode: the UI is served by Vite on http://localhost:5273');
  console.log('');
} catch (err) {
  console.error(`\n  ✗ Could not start the server.\n\n${err.message}\n`);
  process.exit(1);
}
