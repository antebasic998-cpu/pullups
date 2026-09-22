export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  border: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  accentInk: string;
  gold: string;
  silver: string;
  bronze: string;
  danger: string;
  up: string;
  down: string;
}

export const darkTheme: ThemeColors = {
  bg: '#0a0b0d',
  surface: '#101216',
  surface2: '#16181d',
  surface3: '#1d2027',
  border: 'rgba(255,255,255,0.07)',
  text: '#e9ecef',
  muted: '#8a919b',
  faint: '#5c636e',
  accent: '#c9f750',
  accentInk: '#0f1305',
  gold: '#e2c069',
  silver: '#b6bdc7',
  bronze: '#c79264',
  danger: '#f0736a',
  up: '#6ee7a8',
  down: '#f0908a',
};

export const lightTheme: ThemeColors = {
  bg: '#fafbfc',
  surface: '#ffffff',
  surface2: '#f4f5f7',
  surface3: '#eceef1',
  border: 'rgba(17,24,39,0.08)',
  text: '#14161a',
  muted: '#5c6472',
  faint: '#737b88',
  accent: '#5c8a00',
  accentInk: '#ffffff',
  gold: '#a67c14',
  silver: '#78818f',
  bronze: '#9c6432',
  danger: '#cf4436',
  up: '#12855a',
  down: '#c2410c',
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
