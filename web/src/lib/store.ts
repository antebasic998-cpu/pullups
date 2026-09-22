import { useEffect, useState } from 'react';

/**
 * One global "data changed" counter. Any mutation bumps it and every screen
 * subscribed to it refetches, so scores stay consistent across pages without a
 * state-management dependency.
 */
let version = 0;
const subscribers = new Set<() => void>();

export function invalidate(): void {
  version += 1;
  subscribers.forEach((notify) => notify());
}

export function useDataVersion(): number {
  const [value, setValue] = useState(version);
  useEffect(() => {
    const notify = () => setValue(version);
    subscribers.add(notify);
    notify();
    return () => {
      subscribers.delete(notify);
    };
  }, []);
  return value;
}
