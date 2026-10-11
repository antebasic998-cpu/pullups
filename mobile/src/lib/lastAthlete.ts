import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@pullup/lastAthlete';

let last: string | null = null;

// Hydrate once; the Log sheet reads synchronously and falls back to the first athlete until this lands.
void AsyncStorage.getItem(KEY)
  .then((value) => {
    if (last === null) last = value;
  })
  .catch(() => undefined);

/** Whoever the big "+" logged for last, so repeat logging is one tap. */
export function getLastAthlete(): string | null {
  return last;
}

export function setLastAthlete(userId: string): void {
  last = userId;
  void AsyncStorage.setItem(KEY, userId).catch(() => undefined);
}
