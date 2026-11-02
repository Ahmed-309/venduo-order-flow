export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

/**
 * Keeps edits flowing to storage without a Save button. One write runs at a time and only the
 * latest value is ever written next. A failed value stays pending, so nothing typed is lost.
 * No React here: the same queue serves the builder and the quote wizard, and tests run without a UI.
 */
export class AutosaveQueue<T> {
  private pending: { value: T } | null = null;
  private running: Promise<boolean> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private status: SaveStatus = 'idle';

  constructor(
    private readonly persist: (value: T) => Promise<void>,
    private readonly onStatus: (status: SaveStatus) => void,
    private readonly debounceMs: number,
  ) {}

  /** Records the latest value. Text edits debounce; a pick saves straight away. */
  push(value: T, options: { debounce: boolean }): void {
    this.pending = { value };
    this.clearTimer();
    if (options.debounce) {
      this.timer = setTimeout(() => void this.flush(), this.debounceMs);
    } else {
      void this.flush();
    }
  }

  /** The latest value storage has not confirmed, if any. */
  get unsaved(): T | null {
    return this.pending ? this.pending.value : null;
  }

  /** Writes anything outstanding. Resolves true once storage holds the latest value. */
  async flush(): Promise<boolean> {
    this.clearTimer();
    while (this.running) {
      const succeeded = await this.running;
      if (!succeeded) return false;
    }
    if (!this.pending) return this.status !== 'failed';

    this.running = this.drain();
    const succeeded = await this.running;
    this.running = null;
    return succeeded;
  }

  private async drain(): Promise<boolean> {
    while (this.pending) {
      const { pending } = this;
      this.setStatus('saving');
      try {
        await this.persist(pending.value);
      } catch {
        this.setStatus('failed');
        return false;
      }
      if (this.pending === pending) this.pending = null;
    }
    this.setStatus('saved');
    return true;
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private setStatus(status: SaveStatus): void {
    this.status = status;
    this.onStatus(status);
  }
}
