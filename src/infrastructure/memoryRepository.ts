import { FrozenPackError, type TechPackRepository } from '@/application/repository';
import { seedCatalogue } from '@/domain/catalogue/seed';
import type { QuoteDraft, QuoteRequest } from '@/domain/quote';
import type { TechPack } from '@/domain/techPack';

const copy = <T>(value: T): T => structuredClone(value);

/**
 * A second implementation of the contract. It backs the application tests, and the shared contract
 * test runs against it and IndexedDB alike, which is what shows storage can be replaced.
 */
export class MemoryRepository implements TechPackRepository {
  private packs = new Map<string, TechPack>();
  private requests = new Map<string, QuoteRequest>();
  private assets = new Map<string, Blob>();
  private quoteDraft: QuoteDraft | null = null;
  private packSequence = 0;
  private requestSequence = 0;

  async loadCatalogue() {
    return seedCatalogue;
  }

  async createPack(build: (sequence: number) => TechPack) {
    this.packSequence += 1;
    const pack = build(this.packSequence);
    this.packs.set(pack.id, copy(pack));
    return copy(pack);
  }

  async getPack(id: string) {
    const pack = this.packs.get(id);
    return pack ? copy(pack) : null;
  }

  async listPacks() {
    return copy([...this.packs.values()]);
  }

  async updatePack(pack: TechPack) {
    if (this.packs.get(pack.id)?.status !== 'draft') throw new FrozenPackError(pack.id);
    this.packs.set(pack.id, copy(pack));
  }

  async saveAsset(image: Blob) {
    const id = `asset-${this.assets.size + 1}`;
    this.assets.set(id, image);
    return id;
  }

  async getAsset(id: string) {
    return this.assets.get(id) ?? null;
  }

  async loadQuoteDraft() {
    return this.quoteDraft ? copy(this.quoteDraft) : null;
  }

  async saveQuoteDraft(draft: QuoteDraft) {
    this.quoteDraft = copy(draft);
  }

  async clearQuoteDraft() {
    this.quoteDraft = null;
  }

  async getRequest(id: string) {
    const request = this.requests.get(id);
    return request ? copy(request) : null;
  }

  async findRequestBySubmissionId(submissionId: string) {
    const request = [...this.requests.values()].find((candidate) => candidate.submissionId === submissionId);
    return request ? copy(request) : null;
  }

  async listRequests() {
    return copy([...this.requests.values()]);
  }

  async commitQuoteRequest(submissionId: string, build: (sequence: number) => QuoteRequest) {
    const existing = await this.findRequestBySubmissionId(submissionId);
    if (existing) return existing;

    const request = build(this.requestSequence + 1);
    for (const item of request.items) {
      if (this.packs.get(item.pack.id)?.status !== 'draft') throw new FrozenPackError(item.pack.id);
    }
    this.requestSequence += 1;
    this.requests.set(request.id, copy(request));
    for (const item of request.items) this.packs.set(item.pack.id, copy(item.pack));
    this.quoteDraft = null;
    return copy(request);
  }
}
