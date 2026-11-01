import type { Catalogue } from '@/domain/catalogue/types';
import { effectiveMoq } from '@/domain/moq';
import {
  buildQuoteRequest,
  createQuoteDraft,
  packIneligibilityReason,
  validateQuoteSubmission,
  type QuoteDraft,
  type QuoteRequest,
} from '@/domain/quote';
import { isFrozen, type TechPack } from '@/domain/techPack';
import type { WorkflowEnv } from './techPacks';

export interface QuoteWizardData {
  catalogue: Catalogue;
  /** Every pack not yet sent, including incomplete ones, which show but cannot be ticked. */
  packs: TechPack[];
  draft: QuoteDraft;
}

function selectPack(draft: QuoteDraft, pack: TechPack, catalogue: Catalogue): QuoteDraft {
  if (draft.selectedPackIds.includes(pack.id)) return draft;
  const existing = draft.items[pack.id];
  return {
    ...draft,
    selectedPackIds: [...draft.selectedPackIds, pack.id],
    items: {
      ...draft.items,
      [pack.id]: existing ?? {
        quantity: Math.max(pack.estimateQuantity, effectiveMoq(pack, catalogue).value),
        comment: '',
      },
    },
  };
}

/** Ticks or unticks a pack. Unticking keeps its quantity and comment in case it comes back. */
export function togglePack(draft: QuoteDraft, pack: TechPack, catalogue: Catalogue): QuoteDraft {
  if (draft.selectedPackIds.includes(pack.id)) {
    return { ...draft, selectedPackIds: draft.selectedPackIds.filter((id) => id !== pack.id) };
  }
  return selectPack(draft, pack, catalogue);
}

/**
 * Restores the saved draft, or starts one with a fresh submission id. The new draft is persisted
 * before returning, so the id is stable from the first moment the wizard is on screen.
 */
export async function loadQuoteWizard(env: WorkflowEnv, preselectPackId: string | null): Promise<QuoteWizardData> {
  const [catalogue, allPacks, saved] = await Promise.all([
    env.repository.loadCatalogue(),
    env.repository.listPacks(),
    env.repository.loadQuoteDraft(),
  ]);
  const packs = allPacks.filter((pack) => !isFrozen(pack));

  let draft = saved ?? createQuoteDraft(env.newId());
  // Packs edited since the draft was saved may no longer qualify; they fall back to unticked.
  draft = {
    ...draft,
    selectedPackIds: draft.selectedPackIds.filter((id) => {
      const pack = packs.find((candidate) => candidate.id === id);
      return pack !== undefined && packIneligibilityReason(pack, catalogue) === null;
    }),
  };

  const preselected = packs.find((pack) => pack.id === preselectPackId);
  if (preselected && packIneligibilityReason(preselected, catalogue) === null) {
    draft = selectPack(draft, preselected, catalogue);
  }

  if (!saved || draft !== saved) await env.repository.saveQuoteDraft(draft);
  return { catalogue, packs, draft };
}

export function saveQuoteDraft(env: WorkflowEnv, draft: QuoteDraft): Promise<void> {
  return env.repository.saveQuoteDraft({ ...draft, savedAt: env.now() });
}

export type SubmitResult =
  | { kind: 'submitted'; request: QuoteRequest }
  | { kind: 'invalid'; errors: string[] };

/**
 * Safe to call again after any failure. The existing request is looked up before validation,
 * so a retry after a lost success response returns it even though its packs are frozen by then.
 */
export async function submitQuote(env: WorkflowEnv, draft: QuoteDraft): Promise<SubmitResult> {
  const { repository } = env;
  const existing = await repository.findRequestBySubmissionId(draft.submissionId);
  if (existing) return { kind: 'submitted', request: existing };

  const [catalogue, packs] = await Promise.all([repository.loadCatalogue(), repository.listPacks()]);
  const errors = validateQuoteSubmission(draft, packs, catalogue);
  if (errors.length > 0) return { kind: 'invalid', errors };

  const request = await repository.commitQuoteRequest(draft.submissionId, (sequence) =>
    buildQuoteRequest({ id: env.newId(), sequence, draft, packs, catalogue, now: env.now() }),
  );
  return { kind: 'submitted', request };
}

export interface ConfirmationData {
  catalogue: Catalogue;
  request: QuoteRequest | null;
}

export async function loadConfirmation(env: WorkflowEnv, requestId: string): Promise<ConfirmationData> {
  const [catalogue, request] = await Promise.all([env.repository.loadCatalogue(), env.repository.getRequest(requestId)]);
  return { catalogue, request };
}
