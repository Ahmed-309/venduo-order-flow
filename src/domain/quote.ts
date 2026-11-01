import type { Catalogue } from './catalogue/types';
import type { MoneyRange } from './money';
import { effectiveMoq } from './moq';
import { estimatePrice, type PriceEstimate } from './pricing';
import { evaluateReadiness } from './readiness';
import { displayName, isFrozen, type TechPack } from './techPack';

export interface QuoteItemInput {
  /** Null while the field is empty. */
  quantity: number | null;
  comment: string;
}

export interface DeliveryDetails {
  recipientName: string;
  mobile: string;
  governorate: string;
  city: string;
  street: string;
}

export type QuoteStep = 'products' | 'details' | 'delivery';

/** The request being prepared. Persisted so it survives a refresh and keeps its submission id. */
export interface QuoteDraft {
  submissionId: string;
  step: QuoteStep;
  selectedPackIds: string[];
  items: Record<string, QuoteItemInput>;
  delivery: DeliveryDetails;
  savedAt: string | null;
}

export interface QuoteRequestItem {
  /** An immutable copy of the pack as it was sent. */
  pack: TechPack;
  quantity: number;
  comment: string;
  estimate: PriceEstimate;
}

/** Only quote_requested is reachable today; the others are here so the list can show them later. */
export type QuoteRequestStatus = 'quote_requested' | 'quote_received' | 'sampling';

export interface QuoteRequest {
  id: string;
  reference: string;
  submissionId: string;
  status: QuoteRequestStatus;
  items: QuoteRequestItem[];
  delivery: DeliveryDetails;
  submittedAt: string;
}

export const formatRequestReference = (sequence: number): string => `QR-${String(sequence).padStart(4, '0')}`;

export function createQuoteDraft(submissionId: string): QuoteDraft {
  return {
    submissionId,
    step: 'products',
    selectedPackIds: [],
    items: {},
    delivery: { recipientName: '', mobile: '', governorate: '', city: '', street: '' },
    savedAt: null,
  };
}

/** Accepts 01XXXXXXXXX with an optional +20 or 0020 prefix. Returns 11 local digits, or null. */
export function normalizeEgyptianMobile(input: string): string | null {
  const compact = input.replace(/[\s()-]/g, '');
  const national = compact.replace(/^(\+20|0020)/, '');
  const hadPrefix = national !== compact;
  const local = hadPrefix && !national.startsWith('0') ? `0${national}` : national;
  return /^01[0125]\d{8}$/.test(local) ? local : null;
}

export type DeliveryField = 'recipientName' | 'mobile' | 'governorate' | 'city';
export type DeliveryErrors = Partial<Record<DeliveryField, string>>;

export function validateDelivery(delivery: DeliveryDetails): DeliveryErrors {
  const errors: DeliveryErrors = {};
  if (!delivery.recipientName.trim()) errors.recipientName = 'Add the name of the person receiving this.';
  if (!normalizeEgyptianMobile(delivery.mobile)) {
    errors.mobile = 'Use an Egyptian mobile number, for example 01012345678.';
  }
  if (!delivery.governorate) errors.governorate = 'Pick a governorate.';
  if (!delivery.city.trim()) errors.city = 'Add a city.';
  return errors;
}

/** Returns a message for the brand, or null when the quantity can be sent. */
export function validateQuantity(quantity: number | null, moq: number, catalogue: Catalogue): string | null {
  if (quantity === null) return 'Add a quantity.';
  if (!Number.isInteger(quantity)) return 'Use a whole number.';
  if (quantity < moq) return `Use at least ${moq}, the minimum for this product.`;
  const { max } = catalogue.pricing.quantity;
  if (quantity > max) return `Use ${max.toLocaleString('en-US')} or fewer.`;
  return null;
}

/** Why a pack cannot be ticked in step one, or null when it can. */
export function packIneligibilityReason(pack: TechPack, catalogue: Catalogue): string | null {
  if (isFrozen(pack)) return 'Already sent for a quote.';
  return evaluateReadiness(pack, catalogue).blockers[0]?.text ?? null;
}

/** Every reason this draft cannot be sent right now. Run against freshly loaded packs. */
export function validateQuoteSubmission(draft: QuoteDraft, packs: TechPack[], catalogue: Catalogue): string[] {
  const errors: string[] = [];
  if (draft.selectedPackIds.length === 0) errors.push('Pick at least one tech pack.');

  for (const packId of draft.selectedPackIds) {
    const pack = packs.find((candidate) => candidate.id === packId);
    if (!pack) {
      errors.push('A selected tech pack no longer exists.');
      continue;
    }
    const name = displayName(pack, catalogue);
    const reason = packIneligibilityReason(pack, catalogue);
    if (reason) {
      errors.push(`${name}: ${reason}`);
      continue;
    }
    const quantityError = validateQuantity(
      draft.items[packId]?.quantity ?? null,
      effectiveMoq(pack, catalogue).value,
      catalogue,
    );
    if (quantityError) errors.push(`${name}: ${quantityError}`);
  }

  errors.push(...Object.values(validateDelivery(draft.delivery)));
  return errors;
}

export function buildQuoteRequest(input: {
  id: string;
  sequence: number;
  draft: QuoteDraft;
  packs: TechPack[];
  catalogue: Catalogue;
  now: string;
}): QuoteRequest {
  const { draft, packs, catalogue } = input;
  const items = draft.selectedPackIds.map((packId): QuoteRequestItem => {
    const pack = packs.find((candidate) => candidate.id === packId);
    if (!pack) throw new Error(`Unknown pack: ${packId}`);
    const quantity = draft.items[packId].quantity as number;
    return {
      pack: { ...pack, status: 'quote_requested', estimateQuantity: quantity, updatedAt: input.now },
      quantity,
      comment: draft.items[packId].comment.trim(),
      estimate: estimatePrice(pack, quantity, catalogue),
    };
  });
  return {
    id: input.id,
    reference: formatRequestReference(input.sequence),
    submissionId: draft.submissionId,
    status: 'quote_requested',
    items,
    delivery: {
      ...draft.delivery,
      mobile: normalizeEgyptianMobile(draft.delivery.mobile) ?? draft.delivery.mobile,
      recipientName: draft.delivery.recipientName.trim(),
      city: draft.delivery.city.trim(),
      street: draft.delivery.street.trim(),
    },
    submittedAt: input.now,
  };
}

export function requestEstimatedTotal(request: QuoteRequest): MoneyRange {
  return request.items.reduce(
    (total, item) => ({ low: total.low + item.estimate.total.low, high: total.high + item.estimate.total.high }),
    { low: 0, high: 0 },
  );
}
