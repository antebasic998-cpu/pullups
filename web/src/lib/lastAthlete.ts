const KEY = 'pul.lastAthlete';

/** The athlete you logged for last – the Log button pre-selects them. */
export function getLastAthlete(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setLastAthlete(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* private mode – the preference is optional */
  }
}
