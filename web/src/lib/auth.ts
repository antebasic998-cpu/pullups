const ACCESS_KEY = 'pullup_unlocked_v1';

export function isAppUnlocked(): boolean {
  try {
    return localStorage.getItem(ACCESS_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAppUnlocked(): void {
  try {
    localStorage.setItem(ACCESS_KEY, 'true');
  } catch (err) {
    console.error('Failed to save unlock state:', err);
  }
}

export function clearAppUnlocked(): void {
  try {
    localStorage.removeItem(ACCESS_KEY);
  } catch (err) {
    console.error('Failed to clear unlock state:', err);
  }
}
