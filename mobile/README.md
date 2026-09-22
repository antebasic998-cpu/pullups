# Pull-Up Leaderboard — Mobile (React Native)

A React Native mock of the office pull-up leaderboard web app. Same screens, scoring engine, gamification, and UI patterns — all backed by local mock data (AsyncStorage). No changes to the web app; Supabase can be wired in later.

## Run on iOS Simulator (native build)

This project uses a **native dev build** on the simulator — not Expo Go.

**Requirements:** Expo SDK 57 needs **Xcode 26.4+** (Swift 6.3). Xcode 26.3 will fail with Swift concurrency errors in `expo-modules-jsi`.

```bash
cd mobile
npm install
export LANG=en_US.UTF-8   # avoids CocoaPods UTF-8 errors

# Boot a simulator (optional — or pick one when prompted)
open -a Simulator

# Build & install on a specific device
npm run ios -- --device "iPhone 16 Pro"

# Or list simulators and pick interactively
npx expo run:ios --device
```

After the first native build succeeds, Metro starts automatically. Use `npm start` only if you need to restart the JS bundler.

**Expo Go (optional):** `npm run ios:go` — quick preview only; not the same as the native build above.

## Android

```bash
npm run android
```

## What's included

| Tab / Screen | Same as web |
| --- | --- |
| **Board** | Four leaderboard modes (Best, Absolute, Most improved, Most active) |
| **Awards** | Weekly office prizes, XP race, levels, badge wall |
| **Athletes** | Searchable roster, log results, add athletes |
| **Profile** | Level/XP, metrics, progress chart, badges, history, import CSV |

Data is seeded with 10 demo colleagues and ~220 attempts on first launch (same seed as `npm run seed` on the server). CRUD persists locally until you clear app storage.

## Project layout

```
mobile/
  App.tsx                 entry + DB bootstrap
  src/
    api.ts                mock API (mirrors web/src/api.ts)
    core/                 scoring, gamify, service (ported from server/)
    components/           shared UI, modals, chart
    screens/              Board, Awards, Athletes, Profile
    navigation/           tabs + stack
    lib/                  theme, format, hooks
```

## Connect Supabase later

Replace `src/api.ts` with real fetch calls to your backend, or point at the existing Express API on your LAN. Types in `src/types.ts` already match the web client.
