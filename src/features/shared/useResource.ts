'use client';

import { useCallback, useEffect, useState } from 'react';

export type Resource<T> =
  | { status: 'loading'; retry: () => void }
  | { status: 'failed'; retry: () => void }
  | { status: 'ready'; data: T; retry: () => void };

type Settled<T> = { load: () => Promise<T>; attempt: number } & ({ ok: true; data: T } | { ok: false });

/** Loads on mount and on retry. `load` must be stable (useCallback): a new function reloads. */
export function useResource<T>(load: () => Promise<T>): Resource<T> {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    let isCurrent = true;
    load().then(
      (data) => {
        if (isCurrent) setSettled({ load, attempt, ok: true, data });
      },
      () => {
        if (isCurrent) setSettled({ load, attempt, ok: false });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [load, attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  if (!settled || settled.load !== load || settled.attempt !== attempt) return { status: 'loading', retry };
  return settled.ok ? { status: 'ready', data: settled.data, retry } : { status: 'failed', retry };
}
