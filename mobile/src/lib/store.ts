import { useEffect, useState } from 'react';

/** Global data-changed counter — same pattern as the web app. */
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
