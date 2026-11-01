import { describe, expect, it } from 'vitest';
import { seedCatalogue } from '@/domain/catalogue/seed';
import type { QuoteDraft } from '@/domain/quote';
import { completeHoodie, completeTShirt, emptyPack } from '@/domain/testing/builders';
import type { TechPack } from '@/domain/techPack';
import { MemoryRepository } from '@/infrastructure/memoryRepository';
import { withFaults, NO_FAULTS, type FaultSettings } from '@/infrastructure/faultInjectingRepository';
import { loadQuoteWizard, submitQuote, togglePack } from './quotes';
import { saveTechPack, type WorkflowEnv } from './techPacks';

const delivery = { recipientName: 'Salma', mobile: '01012345678', governorate: 'Giza', city: 'Dokki', street: '' };

function setup() {
  const memory = new MemoryRepository();
  let faults: FaultSettings = NO_FAULTS;
  let id = 0;
  const env: WorkflowEnv = {
    repository: withFaults(memory, () => faults),
    newId: () => `id-${++id}`,
    now: () => '2026-11-01T10:00:00.000Z',
  };
  return { memory, env, setFaults: (next: Partial<FaultSettings>) => (faults = { ...NO_FAULTS, ...next }) };
}

async function addPack(env: WorkflowEnv, memory: MemoryRepository, pack: TechPack): Promise<TechPack> {
  return memory.createPack(() => ({ ...pack, id: env.newId() }));
}

async function readyDraft(env: WorkflowEnv, pack: TechPack): Promise<QuoteDraft> {
  const { draft } = await loadQuoteWizard(env, pack.id);
  return { ...draft, delivery };
}

describe('loadQuoteWizard', () => {
  it('persists a new draft so its submission id is stable across reloads', async () => {
    const { env, memory } = setup();
    const first = await loadQuoteWizard(env, null);
    const second = await loadQuoteWizard(env, null);
    expect(second.draft.submissionId).toBe(first.draft.submissionId);
    expect((await memory.loadQuoteDraft())?.submissionId).toBe(first.draft.submissionId);
  });

  it('preselects a complete pack, prefilling quantity at or above its MOQ', async () => {
    const { env, memory } = setup();
    const pack = await addPack(env, memory, { ...completeHoodie(), estimateQuantity: 50 });
    const { draft } = await loadQuoteWizard(env, pack.id);
    expect(draft.selectedPackIds).toEqual([pack.id]);
    expect(draft.items[pack.id].quantity).toBe(150);
  });

  it('does not preselect an incomplete pack, and hides sent packs', async () => {
    const { env, memory } = setup();
    const incomplete = await addPack(env, memory, emptyPack());
    await addPack(env, memory, { ...completeTShirt(), status: 'quote_requested' });
    const { draft, packs } = await loadQuoteWizard(env, incomplete.id);
    expect(draft.selectedPackIds).toEqual([]);
    expect(packs.map((pack) => pack.id)).toEqual([incomplete.id]);
  });

  it('unticks a saved selection whose pack has since become incomplete', async () => {
    const { env, memory } = setup();
    const pack = await addPack(env, memory, completeTShirt());
    await loadQuoteWizard(env, pack.id);
    await saveTechPack(env, { ...pack, name: '' });
    const { draft } = await loadQuoteWizard(env, null);
    expect(draft.selectedPackIds).toEqual([]);
  });

  it('keeps quantity and comment when a pack is unticked and ticked again', async () => {
    const { env, memory } = setup();
    const pack = await addPack(env, memory, completeTShirt());
    const { draft, catalogue } = await loadQuoteWizard(env, pack.id);
    const edited = { ...draft, items: { [pack.id]: { quantity: 777, comment: 'Keep' } } };
    const again = togglePack(togglePack(edited, pack, catalogue), pack, catalogue);
    expect(again.items[pack.id]).toEqual({ quantity: 777, comment: 'Keep' });
    expect(again.selectedPackIds).toEqual([pack.id]);
  });
});

describe('submitQuote', () => {
  it('creates the request, freezes the pack and clears the draft', async () => {
    const { env, memory } = setup();
    const pack = await addPack(env, memory, completeTShirt());
    const result = await submitQuote(env, await readyDraft(env, pack));

    expect(result.kind).toBe('submitted');
    expect((await memory.getPack(pack.id))?.status).toBe('quote_requested');
    expect(await memory.loadQuoteDraft()).toBeNull();
  });

  it('supports several products from independent hubs', async () => {
    const { env, memory } = setup();
    const cairo = await addPack(env, memory, completeTShirt());
    const alexandria = await addPack(env, memory, {
      ...completeTShirt(),
      hubId: 'alexandria',
      fabrics: [{ fabricId: 'combed-jersey', placement: 'body', colour: { kind: 'stock', name: 'Black' } }],
    });
    const { draft, catalogue } = await loadQuoteWizard(env, cairo.id);
    const both = togglePack({ ...draft, delivery }, alexandria, catalogue);

    const result = await submitQuote(env, both);

    if (result.kind !== 'submitted') throw new Error(result.errors.join());
    expect(result.request.items.map((item) => item.estimate.hubId)).toEqual(['cairo', 'alexandria']);
    expect(result.request.items[1].quantity).toBe(300);
  });

  it('returns validation errors and writes nothing when the draft is invalid', async () => {
    const { env, memory } = setup();
    const pack = await addPack(env, memory, completeTShirt());
    const { draft } = await loadQuoteWizard(env, pack.id);
    const result = await submitQuote(env, draft);

    expect(result.kind).toBe('invalid');
    expect(await memory.listRequests()).toEqual([]);
    expect((await memory.getPack(pack.id))?.status).toBe('draft');
    expect(await memory.loadQuoteDraft()).not.toBeNull();
  });

  it('keeps the draft when a submission fails, and the same draft can succeed later', async () => {
    const { env, memory, setFaults } = setup();
    const pack = await addPack(env, memory, completeTShirt());
    const draft = await readyDraft(env, pack);

    setFaults({ submission: 'reject' });
    await expect(submitQuote(env, draft)).rejects.toThrow();
    expect(await memory.listRequests()).toEqual([]);
    expect(await memory.loadQuoteDraft()).not.toBeNull();
    expect((await memory.getPack(pack.id))?.status).toBe('draft');

    setFaults({});
    expect((await submitQuote(env, draft)).kind).toBe('submitted');
  });

  it('returns the same request when retrying after a lost success response', async () => {
    const { env, memory, setFaults } = setup();
    const pack = await addPack(env, memory, completeTShirt());
    const draft = await readyDraft(env, pack);

    setFaults({ submission: 'lost_response' });
    await expect(submitQuote(env, draft)).rejects.toThrow();
    const [saved] = await memory.listRequests();
    expect(saved.submissionId).toBe(draft.submissionId);

    // The pack is frozen by now, so revalidating first would wrongly refuse this retry.
    setFaults({});
    const retry = await submitQuote(env, draft);

    expect(retry).toEqual({ kind: 'submitted', request: saved });
    expect(await memory.listRequests()).toHaveLength(1);
  });

  it('refuses a sent pack under a new submission id', async () => {
    const { env, memory } = setup();
    const pack = await addPack(env, memory, completeTShirt());
    const draft = await readyDraft(env, pack);
    await submitQuote(env, draft);

    const result = await submitQuote(env, { ...draft, submissionId: 'another' });

    expect(result.kind).toBe('invalid');
    expect(await memory.listRequests()).toHaveLength(1);
  });

  it('uses the catalogue supplied by the repository', async () => {
    const { env } = setup();
    const { catalogue } = await loadQuoteWizard(env, null);
    expect(catalogue).toBe(seedCatalogue);
  });
});
