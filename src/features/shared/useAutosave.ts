'use client';

import { useCallback, useEffect, useState } from 'react';
import { AutosaveQueue, type SaveStatus } from '@/application/autosaveQueue';

const TEXT_DEBOUNCE_MS = 400;

export interface Autosave<T> {
  status: SaveStatus;
  push: (value: T, options: { debounce: boolean }) => void;
  flush: () => Promise<boolean>;
}

/** `persist` is captured once, so it should only close over values that do not change. */
export function useAutosave<T>(persist: (value: T) => Promise<void>): Autosave<T> {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [queue] = useState(() => new AutosaveQueue<T>(persist, setStatus, TEXT_DEBOUNCE_MS));

  useEffect(() => {
    const flush = () => void queue.flush();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [queue]);

  // Warn before closing the tab while a failed edit exists only in memory.
  useEffect(() => {
    if (status !== 'failed') return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status]);

  const push = useCallback<Autosave<T>['push']>((value, options) => queue.push(value, options), [queue]);
  const flush = useCallback(() => queue.flush(), [queue]);

  return { status, push, flush };
}
