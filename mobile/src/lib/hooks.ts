import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const runId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (soft = false) => {
    const id = ++runId.current;
    if (!soft) setLoading(true);
    try {
      const result = await fetcherRef.current();
      if (id !== runId.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (id !== runId.current) return;
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      if (id === runId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload: () => load(true) };
}
