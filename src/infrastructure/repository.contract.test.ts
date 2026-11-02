import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FrozenPackError, type TechPackRepository } from '@/application/repository';
import { createDraft, type WorkflowEnv } from '@/application/techPacks';
import { seedCatalogue } from '@/domain/catalogue/seed';
import { createQuoteDraft, formatRequestReference, type QuoteRequest } from '@/domain/quote';
import type { TechPack } from '@/domain/techPack';
import { IndexedDbRepository } from './indexedDbRepository';
import { MemoryRepository } from './memoryRepository';

function createJournal() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

const unusedJournal = createJournal();
const fakeJournal = () => unusedJournal;

const implementations: [string, () => TechPackRepository][] = [
  ['MemoryRepository', () => new MemoryRepository()],
  ['IndexedDbRepository', () => new IndexedDbRepository(() => new IDBFactory(), 'test', fakeJournal)],
];

describe.each(implementations)('%s', (_name, create) => {
  function setup() {
    const repository = create();
    let id = 0;
    const env: WorkflowEnv = {
      repository,
      newId: () => `id-${++id}`,
      now: () => '2026-11-01T10:00:00.000Z',
    };
    return { repository, env };
  }

  const requestFor = (packs: TechPack[], submissionId: string) => (sequence: number): QuoteRequest => ({
    id: `request-${submissionId}`,
    reference: formatRequestReference(sequence),
    submissionId,
    status: 'quote_requested',
    items: packs.map((pack) => ({
      pack: { ...pack, status: 'quote_requested' as const },
      quantity: 300,
      comment: '',
      estimate: {} as QuoteRequest['items'][number]['estimate'],
    })),
    delivery: createQuoteDraft('x').delivery,
    submittedAt: '2026-11-01T11:00:00.000Z',
  });

  it('numbers references in order and reads packs back', async () => {
    const { repository, env } = setup();
    const first = await createDraft(env, seedCatalogue, 't-shirt');
    const second = await createDraft(env, seedCatalogue, 'hoodie');
    expect(first.reference).toBe('VND-0001');
    expect(second.reference).toBe('VND-0002');
    expect(await repository.getPack(second.id)).toEqual(second);
    expect(await repository.listPacks()).toHaveLength(2);
    expect(await repository.getPack('missing')).toBeNull();
  });

  it('refuses to create a coming-soon category', async () => {
    const { env } = setup();
    await expect(async () => createDraft(env, seedCatalogue, 'jacket')).rejects.toThrow(/not available/);
  });

  it('persists pack edits', async () => {
    const { repository, env } = setup();
    const pack = await createDraft(env, seedCatalogue, 't-shirt');
    await repository.updatePack({ ...pack, name: 'Edited' });
    expect((await repository.getPack(pack.id))?.name).toBe('Edited');
  });

  it('stores image assets', async () => {
    const { repository } = setup();
    const id = await repository.saveAsset(new Blob(['image-bytes'], { type: 'image/png' }));
    const stored = await repository.getAsset(id);
    expect(await stored?.text()).toBe('image-bytes');
    expect(stored?.type).toBe('image/png');
    expect(await repository.getAsset('missing')).toBeNull();
  });

  it('saves, loads and clears the quote draft', async () => {
    const { repository } = setup();
    expect(await repository.loadQuoteDraft()).toBeNull();
    const draft = createQuoteDraft('submission');
    await repository.saveQuoteDraft(draft);
    expect(await repository.loadQuoteDraft()).toEqual(draft);
    await repository.clearQuoteDraft();
    expect(await repository.loadQuoteDraft()).toBeNull();
  });

  it('commits atomically: creates the request, freezes packs, clears the draft', async () => {
    const { repository, env } = setup();
    const pack = await createDraft(env, seedCatalogue, 't-shirt');
    await repository.saveQuoteDraft(createQuoteDraft('submission'));

    const request = await repository.commitQuoteRequest('submission', requestFor([pack], 'submission'));

    expect(request.reference).toBe('QR-0001');
    expect(await repository.getRequest(request.id)).toEqual(request);
    expect(await repository.findRequestBySubmissionId('submission')).toEqual(request);
    expect((await repository.getPack(pack.id))?.status).toBe('quote_requested');
    expect(await repository.loadQuoteDraft()).toBeNull();
  });

  it('returns the existing request for a repeated submission id, writing nothing', async () => {
    const { repository, env } = setup();
    const pack = await createDraft(env, seedCatalogue, 't-shirt');
    const first = await repository.commitQuoteRequest('submission', requestFor([pack], 'submission'));
    await repository.saveQuoteDraft(createQuoteDraft('next'));

    const second = await repository.commitQuoteRequest('submission', requestFor([pack], 'submission'));

    expect(second).toEqual(first);
    expect(await repository.listRequests()).toHaveLength(1);
    expect(await repository.loadQuoteDraft()).not.toBeNull();
  });

  it('rolls everything back if any pack was already sent', async () => {
    const { repository, env } = setup();
    const sent = await createDraft(env, seedCatalogue, 't-shirt');
    const fresh = await createDraft(env, seedCatalogue, 'polo');
    await repository.commitQuoteRequest('first', requestFor([sent], 'first'));
    await repository.saveQuoteDraft(createQuoteDraft('second'));

    await expect(repository.commitQuoteRequest('second', requestFor([fresh, sent], 'second'))).rejects.toBeInstanceOf(
      FrozenPackError,
    );

    expect(await repository.listRequests()).toHaveLength(1);
    expect((await repository.getPack(fresh.id))?.status).toBe('draft');
    expect(await repository.loadQuoteDraft()).not.toBeNull();

    const next = await repository.commitQuoteRequest('third', requestFor([fresh], 'third'));
    expect(next.reference).toBe('QR-0002');
  });

  it('refuses to overwrite a frozen pack', async () => {
    const { repository, env } = setup();
    const pack = await createDraft(env, seedCatalogue, 't-shirt');
    await repository.commitQuoteRequest('submission', requestFor([pack], 'submission'));
    await expect(repository.updatePack({ ...pack, name: 'Too late' })).rejects.toBeInstanceOf(FrozenPackError);
    expect((await repository.getPack(pack.id))?.name).toBe('');
  });
});

/** A second page load is a new repository over the same database and journal. */
const stashImplementations: [string, () => { first: TechPackRepository; reopen: () => TechPackRepository }][] = [
  [
    'MemoryRepository',
    () => {
      const repository = new MemoryRepository();
      return { first: repository, reopen: () => repository };
    },
  ],
  [
    'IndexedDbRepository',
    () => {
      const factory = new IDBFactory();
      const journal = createJournal();
      const open = () => new IndexedDbRepository(() => factory, 'test', () => journal);
      return { first: open(), reopen: open };
    },
  ],
];

describe.each(stashImplementations)('%s: edits stashed during unload', (_name, create) => {
  const later = '2026-11-01T12:00:00.000Z';

  async function setup() {
    const { first, reopen } = create();
    const env: WorkflowEnv = { repository: first, newId: () => 'pack', now: () => '2026-11-01T10:00:00.000Z' };
    return { first, reopen, pack: await createDraft(env, seedCatalogue, 't-shirt') };
  }

  it('applies the edit on the next load', async () => {
    const { first, reopen, pack } = await setup();
    first.stashUnsaved({ kind: 'pack', pack: { ...pack, name: 'Typed', updatedAt: later } });
    expect((await reopen().getPack(pack.id))?.name).toBe('Typed');
  });

  it('does not let an older edit replace a newer save', async () => {
    const { first, reopen, pack } = await setup();
    await first.updatePack({ ...pack, name: 'Newer', updatedAt: later });
    first.stashUnsaved({ kind: 'pack', pack: { ...pack, name: 'Older' } });
    expect((await reopen().getPack(pack.id))?.name).toBe('Newer');
  });

  it('never changes a pack that has been sent', async () => {
    const { first, reopen, pack } = await setup();
    await first.commitQuoteRequest('sent', () => ({
      id: 'request',
      reference: formatRequestReference(1),
      submissionId: 'sent',
      status: 'quote_requested',
      items: [
        {
          pack: { ...pack, status: 'quote_requested' },
          quantity: 300,
          comment: '',
          estimate: {} as QuoteRequest['items'][number]['estimate'],
        },
      ],
      delivery: createQuoteDraft('x').delivery,
      submittedAt: later,
    }));
    first.stashUnsaved({ kind: 'pack', pack: { ...pack, name: 'Too late', updatedAt: later } });
    expect((await reopen().getPack(pack.id))?.name).toBe('');
  });

  it('restores a quote draft edit, but does not bring back a cleared draft', async () => {
    const { first, reopen } = await setup();
    const draft = createQuoteDraft('submission');
    await first.saveQuoteDraft(draft);
    first.stashUnsaved({ kind: 'quote_draft', draft: { ...draft, step: 'delivery', savedAt: later } });
    const second = reopen();
    expect((await second.loadQuoteDraft())?.step).toBe('delivery');

    await second.clearQuoteDraft();
    second.stashUnsaved({ kind: 'quote_draft', draft: { ...draft, savedAt: later } });
    expect(await reopen().loadQuoteDraft()).toBeNull();
  });
});
