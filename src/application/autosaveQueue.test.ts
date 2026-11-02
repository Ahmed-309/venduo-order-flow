import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AutosaveQueue, type SaveStatus } from './autosaveQueue';

const succeeding = () => vi.fn<(value: string) => Promise<void>>().mockResolvedValue(undefined);

function setup(persist = succeeding()) {
  const statuses: SaveStatus[] = [];
  const queue = new AutosaveQueue<string>(persist, (status) => statuses.push(status), 400);
  return { queue, persist, statuses };
}

describe('AutosaveQueue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounces text edits and writes only the last one', async () => {
    const { queue, persist } = setup();
    queue.push('a', { debounce: true });
    await vi.advanceTimersByTimeAsync(300);
    queue.push('ab', { debounce: true });
    await vi.advanceTimersByTimeAsync(399);
    expect(persist).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(persist.mock.calls).toEqual([['ab']]);
  });

  it('reports an unsaved value until storage confirms it, and keeps it if the write fails', async () => {
    const { queue } = setup();
    expect(queue.unsaved).toBeNull();
    queue.push('typed', { debounce: true });
    expect(queue.unsaved).toBe('typed');
    await queue.flush();
    expect(queue.unsaved).toBeNull();

    const failing = setup(vi.fn<(value: string) => Promise<void>>().mockRejectedValue(new Error('nope')));
    failing.queue.push('kept', { debounce: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(failing.queue.unsaved).toBe('kept');
  });

  it('saves picks straight away', async () => {
    const { queue, persist, statuses } = setup();
    queue.push('picked', { debounce: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(persist).toHaveBeenCalledWith('picked');
    expect(statuses).toEqual(['saving', 'saved']);
  });

  it('flush writes a pending debounced edit immediately', async () => {
    const { queue, persist } = setup();
    queue.push('typed', { debounce: true });
    await expect(queue.flush()).resolves.toBe(true);
    expect(persist).toHaveBeenCalledWith('typed');
    await vi.advanceTimersByTimeAsync(1000);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('never runs two writes at once, and finishes with the latest value', async () => {
    let release = () => {};
    const persist = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const { queue } = setup(persist);

    queue.push('first', { debounce: false });
    await vi.advanceTimersByTimeAsync(0);
    queue.push('second', { debounce: false });
    queue.push('third', { debounce: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(persist).toHaveBeenCalledTimes(1);

    release();
    await vi.advanceTimersByTimeAsync(0);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(persist.mock.calls).toEqual([['first'], ['third']]);
  });

  it('keeps a failed edit, reports it, and writes it on retry', async () => {
    const persist = succeeding().mockRejectedValueOnce(new Error('disk full'));
    const { queue, statuses } = setup(persist);

    queue.push('precious', { debounce: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(statuses).toEqual(['saving', 'failed']);

    await expect(queue.flush()).resolves.toBe(true);
    expect(persist.mock.calls).toEqual([['precious'], ['precious']]);
    expect(statuses.at(-1)).toBe('saved');
  });

  it('flush reports failure so navigation can stop', async () => {
    const persist = vi.fn(async () => {
      throw new Error('disk full');
    });
    const { queue } = setup(persist);
    queue.push('precious', { debounce: true });
    await expect(queue.flush()).resolves.toBe(false);
  });

  it('flush with nothing pending succeeds without writing', async () => {
    const { queue, persist } = setup();
    await expect(queue.flush()).resolves.toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });
});
