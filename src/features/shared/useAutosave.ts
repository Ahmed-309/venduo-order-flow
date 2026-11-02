'use client';

import { useCallback, useEffect, useState } from 'react';
import { AutosaveQueue, type SaveStatus } from '@/application/autosaveQueue';

const TEXT_DEBOUNCE_MS = 400;

export interface Autosave<T> {
  status: SaveStatus;
  push: (value: T, options: { debounce: boolean }) => void;
  flush: () => Promise<boolean>;
}

/** `persist` and `stash` are captured once, so they should only close over values that do not change. */
export function useAutosave<T>(persist: (value: T) => Promise<void>, stash: (value: T) => void): Autosave<T> {
  const [stashOnLeave] = useState(() => stash);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [queue] = useState(() => new AutosaveQueue<T>(persist, setStatus, TEXT_DEBOUNCE_MS));

  useEffect(() => {
    const flush = () => void queue.flush();
    const leave = () => {
      if (queue.unsaved !== null) stashOnLeave(queue.unsaved);
      flush();
    };
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      flush();
    };
  }, [queue, stashOnLeave]);

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
