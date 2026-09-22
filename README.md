# 💪 Pull-Up Leaderboard

A small office web app for tracking pull-up results **fairly across different bodyweights**.

Ten pull-ups from a 68 kg colleague and ten from a 100 kg colleague are not the same feat, so every
result is normalized against the **median bodyweight of the office**:

```
score = pullups × (athleteMass / officeMedianMass) ^ 0.67
```

The median is recalculated live from everyone currently on the roster, so adding a colleague
immediately re-rates the whole board. Every result keeps both numbers: the **absolute** pull-up
count and the **normalized** score.

---

## Run it

```bash
npm install          # first time only
npm run dev          # API on :4931 + Vite dev server on :5273  → open http://localhost:5273
```

For the office, build once and serve everything from one port:

```bash
npm run build
npm start
```

The banner then prints the exact address to hand out, and only advertised IPs are ones other machines
can actually reach:

```
  💪 Pull-up leaderboard → http://localhost:4931

  Same Wi-Fi? Colleagues open this address in their browser:

     http://192.168.1.172:4931   (Wi-Fi)

     Everyone shares one board — results land in the same file no matter
     who is typing. Your Mac must stay awake with this terminal open.
```

Colleagues on the same Wi-Fi just open that address — nothing to install. Docker/VM bridges and VPN
tunnels are filtered out on purpose, because their addresses only exist on your own machine.

### If a colleague cannot open it

Work through these in order — the first one is by far the most common:

1. **Wrong address.** Use exactly the IP the banner printed, not one from System Settings → Wi-Fi →
   Details. Virtual adapters (Docker, Parallels, VMware, VPN) also show IPv4 addresses that are
   unreachable from other machines.
2. **Different network.** Compare the first three numbers: you should both be on `192.168.1.x`. Guest
   Wi-Fi, a phone hotspot or a wired VLAN is usually a separate network.
3. **Guest SSID / client isolation.** Many office and café networks let clients talk to the internet
   but not to each other. Nothing to fix locally — use a network without isolation, or run the app on
   a small always-on machine that everyone can reach.
4. **macOS firewall.** System Settings → Network → Firewall — if it is on, allow incoming connections
   for `node`. (It is currently off on this Mac, so this is not the problem here.)
5. **Your Mac asleep or the terminal closed.** The app only exists while `npm start` is running.
   System Settings → Lock Screen → "Prevent automatic sleeping when the display is off" helps.
6. **VPN on either machine** can hijack routing; disconnect to test.

Quick check from the colleague's machine: `curl http://192.168.1.172:4931/api/health` — a JSON reply
means the network is fine and the problem was the browser/address. You can also see the shareable
addresses from your own machine with `curl localhost:4931/api/health`.

### Ports

`4931` (API + built app) and `5273` (Vite dev server) are deliberately obscure, because the usual dev
ports are frequently taken by other projects — macOS itself squats on 5000 and 7000.

- **Port already in use?** The server steps up to the next free port (`4931` → `4932` → …) and says
  which one it used, instead of dying with `EADDRINUSE`.
- **Want a fixed port?** `PORT=8080 npm start` — if *that* is busy it stops with a clear message
  rather than guessing.
- In dev, Vite's `/api` proxy follows whichever port the API announced (`data/.api-port`), so
  `npm run dev` stays in sync even after a step-up.

### Verifying changes

`npm run verify` drives real Chrome and asserts the things a screenshot cannot: ranking order per
board, the formula maths, badges/XP/awards, CRUD and validation, contrast and layout overflow from
320px to 1440px. It **creates and deletes test athletes**, so point it at a throwaway dataset — never
your live board:

```bash
DATA_DIR=$PWD/.verify-data npm run seed            # scratch copy of the demo data
DATA_DIR=$PWD/.verify-data PORT=4941 npm start     # in one terminal
BASE_URL=http://localhost:4941 npm run verify      # in another
```

### Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | API + hot-reloading frontend for development |
| `npm run build` | Builds the frontend into `web/dist` |
| `npm start` | Serves API + built frontend on port 4931 (`PORT=8080 npm start` to change) |
| `npm run seed` | Fills an **empty** database with 10 demo colleagues and ~220 attempts |
| `npm run reset` | Wipes everything and re-seeds the demo data (safe while the server runs) |
| `npm run clear` | Empties the board so you can add real colleagues |
| `npm run typecheck` | TypeScript check |
| `npm run verify` | Headless-Chrome UI + API checks — run it against a scratch copy, see below |
| `npm run shoot` | Writes UI screenshots to `.screens/` |

---

## The app

Three pages. The core loop stays untouched: **do pull-ups → log it → see where you stand**.

**Leaderboard** (`/`) — one line per athlete, four boards behind a tab switch:

| Board | Ranks by | Quiet second line |
| --- | --- | --- |
| **Best** (default) | bodyweight-normalized score | pull-ups in that set |
| **Absolute** | raw pull-up count | normalized score |
| **Most improved** | personal best vs. the athlete's first result | first → now |
| **Most active** | sessions logged | total reps |

Top three ranks are tinted gold/silver/bronze; every row links to that athlete's profile.

**Awards** (`/awards`) — the reason to come back. See below.

**Athletes** (`/users`) — the roster: normalized PB per person, with **Log**. Search to find someone;
add colleagues with name, age and bodyweight, optionally seeding a personal best they already had.

**Profile** (`/users/:id`) — level and XP, five career numbers (normalized PB, pull-up PB, total reps,
sessions, progress since the first result), the badge wall, a progress chart switchable between
**Normalized / Pull-ups / Bodyweight**, and the result history (last 8, expandable).

Results are logged with the bodyweight *of that day*, so a bulk or cut never rewrites old scores.

---

## Gamification

All of it is **derived from the recorded results** — nothing extra is stored, there is no separate
gamification state to keep in sync, and tuning the constants in `server/gamify.js` instantly
re-scores the whole office. Sessions are replayed in date order, so every award is judged against the
board as it stood that day.

### XP and levels

Every result earns XP: **1 per pull-up**, plus `+10` for a new personal best, `+20` for beating your
normalized best, `+25` for ending a day on the podium and `+50` for ending a day at number one.

XP only ever goes up and **never changes your score** — it is pure progression.

| Level | Title | XP | | Level | Title | XP |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Bar Tourist | 0 | | 6 | Pull-up Grinder | 550 |
| 2 | Beginner | 25 | | 7 | Beast | 850 |
| 3 | Regular | 75 | | 8 | Veteran | 1250 |
| 4 | Pull-up Apprentice | 175 | | 9 | Monster | 1750 |
| 5 | Bar Rat | 325 | | 10 | Office Legend | 2400 |

### Streaks

Two streaks, both driven by logged results and nothing else:

- **Weekly** (shown as the headline) — consecutive weeks with at least one result. A week you have not
  logged *yet* does not break it, so a Monday-morning visit never shows a broken streak.
- **Daily** — consecutive days, shown once you are on a run.

### Badges

Sixteen of them, and locked ones are visible on your profile with a progress counter, so there is
always something to chase.

| | Badge | Unlocked by |
| --- | --- | --- |
| 🎬 | First Rep | Log your first result |
| 🔟 🏅 🥇 👑 | 10 / 20 / 30 / 50 Club | Reach that many pull-ups in one set |
| 💯 | Century | 100 pull-ups recorded in total |
| ⚡ | New PB | Beat your own best after your first result |
| 🚀 | PB Crusher | Smash a PB by 3+ reps in one go |
| 🥉 | Podium | End a day in the top three |
| 🏆 | #1 | End a day on top of the office |
| 🦍 | Heavy Hitter | 10+ pull-ups while weighing 90 kg+ |
| 🪶 | Lightweight Beast | 15+ pull-ups while under 70 kg |
| 💀 | Comeback | Beat your old best after a session that fell short |
| 📅 | Consistency | A result four weeks in a row |
| 🔥 | Unstoppable | A result ten days in a row |
| 🎯 | Outlier | Score above 25 normalized points |

Podium and #1 need at least three athletes to have logged a result before they can be earned, and they
settle at the **end of each day** — so whoever happens to log third at 9am does not get a free podium.

### Office awards (weekly, Monday → Sunday)

Recalculated live for the current week, only from that week's results, and only for people who
actually logged something:

🦁 **The Beast** (best score) · 📈 **The Grinder** (biggest gain on your own best) · 🦍 **The
Heavyweight** (best score at 90 kg+) · 💀 **The Comeback** (started below your best, beat it anyway) ·
🐢 **The Consistent One** (most sessions) · 🎯 **The Sniper** (most attempts within one rep of a PB) ·
💥 **The Destroyer** (most pull-ups, 100+) · 😤 **The Ego** (kept swinging for a PB without getting
there) · 🐌 **The One-Rep Wonder** (smallest XP gain, for turning up)

Unawarded categories stay visible as dashed "not awarded yet" cards, so the board always shows what is
still up for grabs that week.

## Importing existing history

On any athlete card or profile choose **Import** and paste rows (or pick a `.csv` file):

```csv
date,reps,weight
2026-08-25,10,72
2026-09-01,12,72
05.09.2026;13;71,5
```

- Only `reps` is required; `date` defaults to today and `weight` to the athlete's current bodyweight.
- Headers are optional and columns can be in any order (recognised names: `date`/`datum`,
  `reps`/`pullups`, `weight`/`kg`).
- Delimiters `,` `;` tab and `|` all work, and dates may be `YYYY-MM-DD`, `02.05.2026`, `2/5/2026` or
  Excel serial numbers.
- Rows that cannot be read are reported back with their line number instead of being imported.

---

## Data & backup

Everything lives in one readable file in the project folder:

```
/Users/antebasic/WebstormProjects/PullUpLeaderboard/data/db.json
```

```json
{
  "users": [{ "id": "…", "name": "Marta Kowalska", "age": 29, "weightKg": 58, "note": "…" }],
  "sessions": [{ "id": "…", "userId": "…", "reps": 15, "weightKg": 57.6, "date": "2026-09-11", "note": "" }]
}
```

It is written the moment you save anything, so closing the terminal or restarting the machine loses
nothing. There is no database to install and nothing to deploy.

Every save is written to a temporary file and then renamed over `db.json` (an atomic swap), so an
interrupted write can never leave you with a truncated or half-written file. The server keeps the
board in memory while it runs and re-reads the file if it changes underneath it — that is how
`npm run clear` / `npm run reset` work while the app is up.

Several colleagues can save at the same moment: writes are serialised through the single server
process, so nothing is lost or interleaved (verified with 12 simultaneous submissions).

The file is a few tens of kilobytes for a full office; there is nothing to tune.

- The footer's **download backup** link saves a timestamped copy of that file.
- To restore or move the board, stop the server, drop the file back in `data/`, and start it again.
- `data/` is git-ignored on purpose: real results are yours, not part of the code.
- Editing `data/db.json` by hand is fine: the server notices external changes and reloads
  automatically (that is also how `npm run reset` stays safe while it runs).

Set `DATA_DIR=/some/shared/folder npm start` to keep the data somewhere else (e.g. a synced folder).

---

## Project layout

```
server/            Express API, scoring engine, JSON store, demo seed
  scoring.js       the formula, median and rounding helpers
  gamify.js        XP, levels, badges, streaks and the weekly office awards
  service.js       leaderboards, personal bests, CSV parsing
web/src/           React + TypeScript + Tailwind UI
  pages/           LeaderboardPage, AwardsPage, UsersPage, UserDetailPage
  components/      app shell, modals, level/badge tiles, SVG progress chart
scripts/           dev-only headless-Chrome verification and screenshots
data/db.json       your results (created on first write / by the seed)
```

## Notes

- No accounts or passwords: anyone who can reach the URL can edit the board. Running it locally, that
  is only you. If you ever put it on the office network, keep it behind your usual internal proxy.
- Weights are stored per attempt, so the data stays correct if someone's bodyweight changes.
- The UI ships with a light and dark theme (the toggle sits in the header) and collapses to
  rank + name + score on a phone.
- Screenshot/verification scripts use your installed Chrome via `playwright-core`; set
  `CHROME_PATH=/path/to/chrome` if it is not in the default macOS location.
- If `npm install` fails with an `EPERM` on `~/.npm/_cacache`, your npm cache has root-owned files;
  fix it once with `sudo chown -R $(id -u):$(id -g) ~/.npm` (or install with `--cache ./.npm-cache`).
