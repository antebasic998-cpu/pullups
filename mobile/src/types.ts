export type Trend = 'up' | 'down' | 'flat' | 'none';
/** The four leaderboards. */
export type BoardMode = 'best' | 'absolute' | 'improved' | 'active';
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'legend';

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

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  tier: BadgeTier;
  how: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: { value: number; raw: number; target: number; percent: number } | null;
}

export interface Level {
  level: number;
  title: string;
  xp: number;
  xpIntoLevel: number;
  xpForLevel: number;
  xpToNext: number;
  nextTitle: string | null;
  progress: number;
  isMax: boolean;
}

export interface Streaks {
  weeks: number;
  bestWeeks: number;
  days: number;
  bestDays: number;
  lastDate: string | null;
  activeWeeks: number;
}

export interface Award {
  id: string;
  emoji: string;
  title: string;
  how: string;
  winner: { userId: string; name: string; detail: string; xpThisWeek: number } | null;
}

export interface OfficeResponse extends Meta {
  week: { start: string; end: string };
  participants: number;
  awards: Award[];
  xpThisWeek: { userId: string; name: string; xp: number; sessions: number; reps: number }[];
  levels: { level: number; title: string; xp: number }[];
  xpRules: { perRep: number; newAbsolutePb: number; newNormalizedPb: number; enterTop3: number; reachNumberOne: number };
  badges: { id: string; emoji: string; name: string; tier: BadgeTier; how: string; holders: number; names: string[] }[];
  leaderboard: { id: string; name: string; xp: number; level: Level; badges: number }[];
}

export interface Attempt {
  id: string;
  userId: string;
  exerciseCategoryId: string;
  reps: number;
  weightKg: number;
  date: string;
  note: string;
  createdAt: string;
  /** reps × (weight / office median) ^ exponent */
  normalized: number;
  /** The mass multiplier applied to the raw reps. */
  multiplier: number;
}

export interface UserSummary {
  id: string;
  name: string;
  age: number | null;
  weightKg: number;
  note: string;
  createdAt: string;
  updatedAt: string;
  multiplier: number;
  sessionCount: number;
  pbAbsolute: number;
  pbAbsoluteDate: string | null;
  pbNormalized: number;
  pbNormalizedReps: number;
  pbNormalizedWeight: number | null;
  pbNormalizedDate: string | null;
  lastResult: Attempt | null;
  trend: Trend;
  improvement: number | null;
  improvementPoints: number | null;
  firstNormalized: number | null;
  totalReps: number;
  xp: number;
  level: Level | null;
  streaks: Streaks;
  badges: Badge[];
  unlockedBadgeCount: number;
  sessions: Attempt[];
  category?: ExerciseCategory;
}

export interface LeaderRow extends UserSummary {
  rank: number | null;
  score: number | null;
}

export interface Formula {
  exponent: number;
  expression: string;
}

export interface Meta {
  medianMassKg: number;
  userCount: number;
  attemptCount: number;
  formula: Formula;
  today: string;
}

export interface Board extends Meta {
  mode: BoardMode;
  category: ExerciseCategory;
  rows: LeaderRow[];
}

export interface CategoriesResponse extends Meta {
  categories: ExerciseCategory[];
}

export interface CelebrationData {
  userName: string;
  categoryName: string;
  reps: number;
  xpGained: number;
  oldXp: number;
  newXp: number;
  oldLevel: Level | null;
  newLevel: Level | null;
  leveledUp: boolean;
  oldProgress: number;
  newProgress: number;
  newBadges: Badge[];
}

export interface UsersResponse extends Meta {
  users: UserSummary[];
}

export interface UserResponse extends Meta {
  user: UserSummary;
  celebration?: CelebrationData | null;
}

export interface ImportResponse extends Meta {
  imported: number;
  errors: string[];
  user: UserSummary;
}
