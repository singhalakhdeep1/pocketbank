import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';

/**
 * Loads data when the screen gains focus and exposes `reload` for pull-to-refresh and after
 * mutations. Keeps the previous data while reloading so lists do not flash empty.
 */
export function useApi<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    try {
      setData(await loaderRef.current());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void run('load');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps),
  );

  return { data, setData, error, loading, refreshing, reload: () => run('load'), refresh: () => run('refresh') };
}
