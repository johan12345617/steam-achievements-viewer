import { useCallback, useEffect, useRef, useState } from 'react';

export const errorMessage = (error: unknown): string => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
export const gameImage = (appId: number): string => `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
export const hours = (minutes: number): string => `${(minutes / 60).toLocaleString(undefined, { maximumFractionDigits: 1 })} h played`;
export const dateLabel = (seconds: number): string => seconds > 0 ? new Date(seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable';
export const percentage = (unlocked: number, total: number): number => total > 0 ? Math.round(unlocked / total * 100) : 0;

/** Ignore stale requests after navigation, profile changes, and refreshes. */
export function useLoad<T>(key: string, loader: () => Promise<T>, enabled = true) {
  const fn = useRef(loader);
  fn.current = loader;
  const sequence = useRef(0);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (refresh = false) => {
    const request = ++sequence.current;
    setError(null);
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const result = await fn.current();
      if (sequence.current === request) setData(result);
    } catch (reason) {
      if (sequence.current === request) setError(errorMessage(reason));
    } finally {
      if (sequence.current === request) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  useEffect(() => {
    setData(null); setError(null);
    setLoading(enabled);
    if (enabled) void run();
    return () => { sequence.current += 1; };
  }, [key, enabled, run]);
  return { data, loading, refreshing, error, reload: () => run(true) };
}
