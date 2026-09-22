/**
 * Tiny JSON-file store. An office leaderboard has dozens of users and a few
 * thousand attempts – a single atomically-written JSON file is plenty, keeps the
 * data human-readable and portable, and has zero native dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY = { users: [], sessions: [] };

let cache = null;
let loadedMtime = 0;

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function fileMtime() {
  try {
    return fs.statSync(DB_FILE).mtimeMs;
  } catch {
    return 0;
  }
}

function read() {
  if (cache) {
    // Someone edited or re-seeded db.json outside this process (npm run reset,
    // a manual fix, a restored backup) – pick that up instead of clobbering it.
    const mtime = fileMtime();
    if (mtime !== 0 && mtime !== loadedMtime) cache = null;
    else return cache;
  }
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    cache = structuredClone(EMPTY);
    loadedMtime = 0;
    return cache;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    cache = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch (err) {
    console.error(`[store] ${DB_FILE} is unreadable (${err.message}); starting empty.`);
    cache = structuredClone(EMPTY);
  }
  loadedMtime = fileMtime();
  return cache;
}

/** Atomic write: temp file + rename, so a crash can never truncate the DB. */
function write() {
  ensureDir();
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, DB_FILE);
  loadedMtime = fileMtime();
}

export const db = {
  file: DB_FILE,
  /** Read-only snapshot; do not mutate. */
  get data() {
    return read();
  },
  users() {
    return read().users;
  },
  sessions() {
    return read().sessions;
  },
  sessionsOf(userId) {
    return read().sessions.filter((s) => s.userId === userId);
  },
  user(id) {
    return read().users.find((u) => u.id === id) ?? null;
  },
  session(id) {
    return read().sessions.find((s) => s.id === id) ?? null;
  },
  insertUser(user) {
    read().users.push(user);
    write();
    return user;
  },
  insertSession(session) {
    read().sessions.push(session);
    write();
    return session;
  },
  updateUser(id, patch) {
    const users = read().users;
    const i = users.findIndex((u) => u.id === id);
    if (i === -1) return null;
    users[i] = { ...users[i], ...patch, id, updatedAt: new Date().toISOString() };
    write();
    return users[i];
  },
  deleteUser(id) {
    const data = read();
    const before = data.users.length;
    data.users = data.users.filter((u) => u.id !== id);
    if (data.users.length === before) return false;
    data.sessions = data.sessions.filter((s) => s.userId !== id);
    write();
    return true;
  },
  deleteSession(id) {
    const data = read();
    const before = data.sessions.length;
    data.sessions = data.sessions.filter((s) => s.id !== id);
    if (data.sessions.length === before) return false;
    write();
    return true;
  },
  replaceAll(next) {
    cache = {
      users: Array.isArray(next.users) ? next.users : [],
      sessions: Array.isArray(next.sessions) ? next.sessions : [],
    };
    write();
    return cache;
  },
  isEmpty() {
    const data = read();
    return data.users.length === 0 && data.sessions.length === 0;
  },
  /** Re-read from disk, dropping the in-process cache. */
  reload() {
    cache = null;
    loadedMtime = 0;
    return read();
  },
};

export { DATA_DIR, DB_FILE };
