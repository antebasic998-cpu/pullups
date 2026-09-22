/**
 * Demo data so the board looks alive on first run.
 *   npm run seed    → fills an empty database only
 *   npm run reset   → wipes everything and re-seeds (asks for --force)
 */
import { randomUUID } from 'node:crypto';
import { db } from './store.js';

/** Deterministic PRNG so the demo board is stable between runs. */
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PEOPLE = [
  { name: 'Marta Kowalska', age: 29, weightKg: 58, start: 7, peak: 15, note: 'Calisthenics on Tuesdays' },
  { name: 'Tomasz Nowak', age: 34, weightKg: 68, start: 9, peak: 18, note: 'Runs the morning run club' },
  { name: 'Alex Petrov', age: 41, weightKg: 74, start: 6, peak: 13 },
  { name: 'Sofia Almeida', age: 26, weightKg: 61, start: 5, peak: 14 },
  { name: 'Daniel Weber', age: 38, weightKg: 88, start: 8, peak: 19, note: 'Ex-rowing club' },
  { name: 'Priya Nair', age: 31, weightKg: 65, start: 4, peak: 12 },
  { name: 'Marcus Johansson', age: 45, weightKg: 100, start: 5, peak: 14, note: 'The big man himself' },
  { name: 'Chen Wei', age: 27, weightKg: 72, start: 10, peak: 22, note: 'Bar athlete, keep an eye on him' },
  { name: 'Heather Blake', age: 36, weightKg: 70, start: 3, peak: 11 },
  { name: 'Jonas Meyer', age: 23, weightKg: 82, start: 6, peak: 16 },
];

function isoDaysAgo(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function build() {
  const rand = mulberry32(20240915);
  const users = [];
  const sessions = [];
  const WEEKS = 18;

  PEOPLE.forEach((p, index) => {
    const createdAt = new Date(Date.now() - (WEEKS + 1) * 7 * 86_400_000).toISOString();
    const user = {
      id: randomUUID(),
      name: p.name,
      age: p.age,
      weightKg: p.weightKg,
      note: p.note ?? '',
      createdAt,
      updatedAt: createdAt,
    };
    users.push(user);

    // Each person tests roughly every 5–9 days and improves unevenly.
    let day = WEEKS * 7 - Math.floor(rand() * 4);
    let progress = 0;
    while (day > 0) {
      const t = 1 - day / (WEEKS * 7);
      progress = t * t * 0.75 + t * 0.35; // slow start, faster later
      const target = p.start + (p.peak - p.start) * progress;
      const reps = Math.max(1, Math.round(target + (rand() - 0.5) * 2.4));
      const weightDrift = Math.round((rand() - 0.5) * 2.4 * 10) / 10;
      sessions.push({
        id: randomUUID(),
        userId: user.id,
        reps,
        weightKg: Math.round((p.weightKg + weightDrift) * 10) / 10,
        date: isoDaysAgo(day),
        note: rand() > 0.82 ? 'Felt strong today' : '',
        createdAt: new Date(Date.now() - day * 86_400_000).toISOString(),
      });
      // The first three people test more often, so the chart is denser at the top.
      day -= 4 + Math.floor(rand() * (index < 3 ? 3 : 5));
    }
  });

  return { users, sessions };
}

const force = process.argv.includes('--force');

if (!force && !db.isEmpty()) {
  console.log(`[seed] ${db.file} already contains data – leaving it alone. Use "npm run reset" to wipe and re-seed.`);
  process.exit(0);
}

const data = build();
db.replaceAll(data);
console.log(`[seed] wrote ${data.users.length} colleagues and ${data.sessions.length} attempts to ${db.file}`);
