import { FrozenPackError, type TechPackRepository, type UnsavedChange } from '@/application/repository';
import { seedCatalogue } from '@/domain/catalogue/seed';
import type { QuoteDraft, QuoteRequest } from '@/domain/quote';
import type { TechPack } from '@/domain/techPack';

const DB_VERSION = 1;
const PACKS = 'packs';
const REQUESTS = 'requests';
const ASSETS = 'assets';
const QUOTE_DRAFT = 'quoteDraft';
const COUNTERS = 'counters';
const ALL_STORES = [PACKS, REQUESTS, ASSETS, QUOTE_DRAFT, COUNTERS];

const QUOTE_DRAFT_KEY = 'current';
const SUBMISSION_INDEX = 'submissionId';
const UNSAVED_KEY = 'venduo.unsaved';

function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function completion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Transaction aborted'));
    transaction.onerror = () => reject(transaction.error);
  });
}

async function nextSequence(transaction: IDBTransaction, counter: string): Promise<number> {
  const counters = transaction.objectStore(COUNTERS);
  const current = ((await toPromise(counters.get(counter))) as number | undefined) ?? 0;
  counters.put(current + 1, counter);
  return current + 1;
}

export class IndexedDbRepository implements TechPackRepository {
  private database: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly factory: () => IDBFactory,
    private readonly name: string,
    private readonly journal: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  ) {}

  /**
   * IndexedDB cannot finish a read-then-write during unload, because the page never hears the read
   * back. localStorage is synchronous, so the edit waits there until the next open applies it.
   */
  stashUnsaved(change: UnsavedChange) {
    try {
      const stashed = JSON.parse(this.journal().getItem(UNSAVED_KEY) ?? '[]') as UnsavedChange[];
      this.journal().setItem(UNSAVED_KEY, JSON.stringify([...stashed, change]));
    } catch {
      // The normal save is still running; this is only its safety net.
    }
  }

  private async applyUnsaved(db: IDBDatabase): Promise<void> {
    const stored = this.journal().getItem(UNSAVED_KEY);
    if (!stored) return;

    const transaction = db.transaction([PACKS, QUOTE_DRAFT], 'readwrite');
    const done = completion(transaction);
    const packs = transaction.objectStore(PACKS);
    const drafts = transaction.objectStore(QUOTE_DRAFT);
    for (const change of JSON.parse(stored) as UnsavedChange[]) {
      if (change.kind === 'pack') {
        const current = (await toPromise(packs.get(change.pack.id))) as TechPack | undefined;
        if (current?.status === 'draft' && current.updatedAt < change.pack.updatedAt) packs.put(change.pack);
      } else {
        const current = (await toPromise(drafts.get(QUOTE_DRAFT_KEY))) as QuoteDraft | undefined;
        if (current && (current.savedAt ?? '') < (change.draft.savedAt ?? '')) drafts.put(change.draft, QUOTE_DRAFT_KEY);
      }
    }
    await done;
    this.journal().removeItem(UNSAVED_KEY);
  }

  /** Opened on first use, because this module is also imported during server rendering. */
  private open(): Promise<IDBDatabase> {
    if (!this.database) {
      this.database = new Promise<IDBDatabase>((resolve, reject) => {
        const request = this.factory().open(this.name, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore(PACKS, { keyPath: 'id' });
          db.createObjectStore(REQUESTS, { keyPath: 'id' }).createIndex(SUBMISSION_INDEX, SUBMISSION_INDEX, {
            unique: true,
          });
          db.createObjectStore(ASSETS);
          db.createObjectStore(QUOTE_DRAFT);
          db.createObjectStore(COUNTERS);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
        .then(async (db) => {
          await this.applyUnsaved(db).catch(() => undefined);
          return db;
        })
        .catch((error) => {
          this.database = null;
          throw error;
        });
    }
    return this.database;
  }

  private async read<T>(store: string, query: (objects: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return toPromise(query(db.transaction(store).objectStore(store)));
  }

  private async write(store: string, change: (objects: IDBObjectStore) => void): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(store, 'readwrite');
    change(transaction.objectStore(store));
    await completion(transaction);
  }

  async loadCatalogue() {
    return seedCatalogue;
  }

  async createPack(build: (sequence: number) => TechPack) {
    const db = await this.open();
    const transaction = db.transaction([PACKS, COUNTERS], 'readwrite');
    const done = completion(transaction);
    const pack = build(await nextSequence(transaction, PACKS));
    transaction.objectStore(PACKS).put(pack);
    await done;
    return pack;
  }

  async getPack(id: string) {
    return (await this.read<TechPack | undefined>(PACKS, (packs) => packs.get(id))) ?? null;
  }

  listPacks() {
    return this.read<TechPack[]>(PACKS, (packs) => packs.getAll());
  }

  async updatePack(pack: TechPack) {
    const db = await this.open();
    const transaction = db.transaction(PACKS, 'readwrite');
    const done = completion(transaction);
    const packs = transaction.objectStore(PACKS);
    const stored = (await toPromise(packs.get(pack.id))) as TechPack | undefined;
    if (stored?.status !== 'draft') {
      transaction.abort();
      await done.catch(() => undefined);
      throw new FrozenPackError(pack.id);
    }
    packs.put(pack);
    await done;
  }

  async saveAsset(image: Blob) {
    const id = crypto.randomUUID();
    await this.write(ASSETS, (assets) => assets.put(image, id));
    return id;
  }

  async getAsset(id: string) {
    return (await this.read<Blob | undefined>(ASSETS, (assets) => assets.get(id))) ?? null;
  }

  async loadQuoteDraft() {
    return (await this.read<QuoteDraft | undefined>(QUOTE_DRAFT, (drafts) => drafts.get(QUOTE_DRAFT_KEY))) ?? null;
  }

  saveQuoteDraft(draft: QuoteDraft) {
    return this.write(QUOTE_DRAFT, (drafts) => drafts.put(draft, QUOTE_DRAFT_KEY));
  }

  clearQuoteDraft() {
    return this.write(QUOTE_DRAFT, (drafts) => drafts.delete(QUOTE_DRAFT_KEY));
  }

  async getRequest(id: string) {
    return (await this.read<QuoteRequest | undefined>(REQUESTS, (requests) => requests.get(id))) ?? null;
  }

  async findRequestBySubmissionId(submissionId: string) {
    const found = await this.read<QuoteRequest | undefined>(REQUESTS, (requests) =>
      requests.index(SUBMISSION_INDEX).get(submissionId),
    );
    return found ?? null;
  }

  listRequests() {
    return this.read<QuoteRequest[]>(REQUESTS, (requests) => requests.getAll());
  }

  async commitQuoteRequest(submissionId: string, build: (sequence: number) => QuoteRequest) {
    const db = await this.open();
    const transaction = db.transaction([PACKS, REQUESTS, QUOTE_DRAFT, COUNTERS], 'readwrite');
    const done = completion(transaction);
    const requests = transaction.objectStore(REQUESTS);

    const existing = (await toPromise(requests.index(SUBMISSION_INDEX).get(submissionId))) as QuoteRequest | undefined;
    if (existing) {
      await done;
      return existing;
    }

    const request = build(await nextSequence(transaction, REQUESTS));
    const packs = transaction.objectStore(PACKS);
    for (const item of request.items) {
      const stored = (await toPromise(packs.get(item.pack.id))) as TechPack | undefined;
      if (stored?.status !== 'draft') {
        transaction.abort();
        await done.catch(() => undefined);
        throw new FrozenPackError(item.pack.id);
      }
      packs.put(item.pack);
    }
    requests.put(request);
    transaction.objectStore(QUOTE_DRAFT).delete(QUOTE_DRAFT_KEY);
    await done;
    return request;
  }

  /** Demo tooling only: wipes everything so a fixture can start clean. */
  async replaceAll(data: { packs: TechPack[]; requests: QuoteRequest[]; packSequence: number; requestSequence: number }) {
    const db = await this.open();
    const transaction = db.transaction(ALL_STORES, 'readwrite');
    const done = completion(transaction);
    for (const store of ALL_STORES) transaction.objectStore(store).clear();
    for (const pack of data.packs) transaction.objectStore(PACKS).put(pack);
    for (const request of data.requests) transaction.objectStore(REQUESTS).put(request);
    transaction.objectStore(COUNTERS).put(data.packSequence, PACKS);
    transaction.objectStore(COUNTERS).put(data.requestSequence, REQUESTS);
    await done;
  }
}
