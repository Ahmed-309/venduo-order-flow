import type { Catalogue } from '@/domain/catalogue/types';
import type { QuoteDraft, QuoteRequest } from '@/domain/quote';
import type { TechPack } from '@/domain/techPack';

export type UnsavedChange = { kind: 'pack'; pack: TechPack } | { kind: 'quote_draft'; draft: QuoteDraft };

/**
 * Everything the app needs from storage. Screens and workflows depend on this contract only, so
 * replacing IndexedDB with a server means writing one new implementation of this interface.
 */
export interface TechPackRepository {
  /**
   * Keeps an edit that may not finish writing because the page is unloading, so it must not wait on
   * anything. It is applied on next load, unless the pack was sent or a newer save exists by then.
   */
  stashUnsaved(change: UnsavedChange): void;

  loadCatalogue(): Promise<Catalogue>;

  /** `build` receives the next reference number and runs inside the write, so numbers never repeat. */
  createPack(build: (sequence: number) => TechPack): Promise<TechPack>;
  getPack(id: string): Promise<TechPack | null>;
  listPacks(): Promise<TechPack[]>;
  /** Rejects with FrozenPackError if the stored pack has already been sent. */
  updatePack(pack: TechPack): Promise<void>;

  /** Stores an image and returns its id. Assets are immutable: a new upload gets a new id. */
  saveAsset(image: Blob): Promise<string>;
  getAsset(id: string): Promise<Blob | null>;

  loadQuoteDraft(): Promise<QuoteDraft | null>;
  saveQuoteDraft(draft: QuoteDraft): Promise<void>;
  clearQuoteDraft(): Promise<void>;

  getRequest(id: string): Promise<QuoteRequest | null>;
  findRequestBySubmissionId(submissionId: string): Promise<QuoteRequest | null>;
  listRequests(): Promise<QuoteRequest[]>;
  /**
   * In one atomic write: creates the request, freezes its packs and clears the quote draft.
   * If a request with this submission id already exists, returns it and writes nothing.
   * Rejects with FrozenPackError if a pack was sent in the meantime, leaving everything unchanged.
   */
  commitQuoteRequest(submissionId: string, build: (sequence: number) => QuoteRequest): Promise<QuoteRequest>;
}

export class FrozenPackError extends Error {
  constructor(packId: string) {
    super(`Tech pack ${packId} has been sent and can no longer change.`);
    this.name = 'FrozenPackError';
  }
}
