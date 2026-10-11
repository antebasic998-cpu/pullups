import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api';
import { useDataVersion } from './store';

const AvatarsContext = createContext<Record<string, string>>({});

/** id -> photo url for every athlete that has one. Refetched whenever data changes. */
export function AvatarsProvider({ children }: { children: ReactNode }) {
  const version = useDataVersion();
  const [avatars, setAvatars] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    api
      .avatars()
      .then((res) => active && setAvatars(res.avatars ?? {}))
      .catch(() => {
        /* initials are a fine fallback */
      });
    return () => {
      active = false;
    };
  }, [version]);

  return <AvatarsContext.Provider value={avatars}>{children}</AvatarsContext.Provider>;
}

export function useAvatarUrl(userId?: string | null): string | null {
  const avatars = useContext(AvatarsContext);
  return userId ? (avatars[userId] ?? null) : null;
}
