import { describe, expect, it } from 'vitest';
import { completeTShirt, emptyPack } from '@/domain/testing/builders';
import { MemoryRepository } from '@/infrastructure/memoryRepository';
import { loadQuoteWizard, submitQuote } from './quotes';
import { loadBuilder, loadOrders, type WorkflowEnv } from './techPacks';

const delivery = { recipientName: 'Salma', mobile: '01012345678', governorate: 'Giza', city: 'Dokki', street: '' };

async function setup() {
  const repository = new MemoryRepository();
  let id = 0;
  const env: WorkflowEnv = { repository, newId: () => `id-${++id}`, now: () => '2026-11-01T10:00:00.000Z' };
  const sent = await repository.createPack(() => ({ ...completeTShirt(), id: 'sent', updatedAt: '2026-11-01T08:00:00.000Z' }));
  await repository.createPack(() => ({ ...emptyPack(), id: 'draft', updatedAt: '2026-11-01T12:00:00.000Z' }));

  const { draft } = await loadQuoteWizard(env, sent.id);
  const result = await submitQuote(env, { ...draft, delivery });
  if (result.kind !== 'submitted') throw new Error('Expected the quote to submit');
  return { env, request: result.request };
}

describe('loadOrders', () => {
  it('lists drafts and requests together, newest first, with a sent pack only inside its request', async () => {
    const { env, request } = await setup();
    const { entries } = await loadOrders(env);
    expect(entries.map((entry) => (entry.kind === 'draft' ? entry.pack.id : entry.request.id))).toEqual([
      'draft',
      request.id,
    ]);
  });
});

describe('loadBuilder', () => {
  it('returns the estimate a sent pack went out with', async () => {
    const { env, request } = await setup();
    const { sentEstimate } = await loadBuilder(env, 'sent');
    expect(sentEstimate).toEqual(request.items[0].estimate);
    expect(sentEstimate?.quantity).toBe(request.items[0].quantity);
  });

  it('has no sent estimate for a draft', async () => {
    const { env } = await setup();
    expect((await loadBuilder(env, 'draft')).sentEstimate).toBeNull();
  });
});
