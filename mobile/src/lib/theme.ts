export type ThemeMode = 'dark' | 'light';

/**
 * "Arena" design tokens – identical to web/src/index.css.
 * Lime marks actions, personal bests and progress; gold / silver / bronze are reserved for ranks.
 */
export interface ThemeColors {
  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  border: string;
  borderStrong: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  accentLine: string;
  accentGlow: string;
  gold: string;
  goldSoft: string;
  silver: string;
  bronze: string;
  danger: string;
  dangerSoft: string;
  up: string;
  down: string;
  gridLine: string;
  overlay: string;
  navBg: string;
  sheet: string;
  fabRing: string;
}

export const darkTheme: ThemeColors = {
  bg: '#0a0b0d',
  surface: '#111318',
  surface2: '#171a20',
  surface3: '#20242c',
  border: 'rgba(255,255,255,0.075)',
  borderStrong: 'rgba(255,255,255,0.15)',
  text: '#eef0f3',
  muted: '#8b929d',
  faint: '#59606b',
  accent: '#c9f750',
  accentInk: '#0f1305',
  accentSoft: 'rgba(201,247,80,0.09)',
  accentLine: 'rgba(201,247,80,0.3)',
  accentGlow: 'rgba(201,247,80,0.32)',
  gold: '#e9c46a',
  goldSoft: 'rgba(233,196,106,0.12)',
  silver: '#c5ccd6',
  bronze: '#d39b6a',
  danger: '#f0736a',
  dangerSoft: 'rgba(240,115,106,0.1)',
  up: '#6ee7a8',
  down: '#f0908a',
  gridLine: 'rgba(255,255,255,0.06)',
  overlay: 'rgba(0,0,0,0.62)',
  navBg: 'rgba(13,14,17,0.96)',
  sheet: '#14161b',
  fabRing: '#0a0b0d',
};

export const lightTheme: ThemeColors = {
  bg: '#f4f5f7',
  surface: '#ffffff',
  surface2: '#f0f2f5',
  surface3: '#e5e8ed',
  border: 'rgba(17,24,39,0.09)',
  borderStrong: 'rgba(17,24,39,0.17)',
  text: '#14161a',
  muted: '#5c6472',
  faint: '#8a919d',
  accent: '#5c8a00',
  accentInk: '#ffffff',
  accentSoft: 'rgba(92,138,0,0.09)',
  accentLine: 'rgba(92,138,0,0.32)',
  accentGlow: 'rgba(92,138,0,0.28)',
  gold: '#a67c14',
  goldSoft: 'rgba(166,124,20,0.12)',
  silver: '#78818f',
  bronze: '#9c6432',
  danger: '#cf4436',
  dangerSoft: 'rgba(207,68,54,0.08)',
  up: '#12855a',
  down: '#c2410c',
  gridLine: 'rgba(17,24,39,0.07)',
  overlay: 'rgba(15,23,42,0.38)',
  navBg: 'rgba(255,255,255,0.97)',
  sheet: '#ffffff',
  fabRing: '#f4f5f7',
};

export const tierColor = (tier: string, colors: ThemeColors) => {
  switch (tier) {
    case 'bronze':
      return colors.bronze;
    case 'silver':
      return colors.silver;
    case 'gold':
      return colors.gold;
    case 'legend':
      return colors.accent;
    default:
      return colors.muted;
  }
};

export const rankColor = (rank: number, colors: ThemeColors) => {
  if (rank === 1) return colors.gold;
  if (rank === 2) return colors.silver;
  if (rank === 3) return colors.bronze;
  return colors.faint;
};

/** "#rrggbb" + alpha → "rgba(r,g,b,a)". Used for the podium tints. */
export const withAlpha = (hex: string, alpha: number) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};
