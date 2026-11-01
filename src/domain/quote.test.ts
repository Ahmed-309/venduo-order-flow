import { describe, expect, it } from 'vitest';
import {
  buildQuoteRequest,
  createQuoteDraft,
  normalizeEgyptianMobile,
  packIneligibilityReason,
  requestEstimatedTotal,
  validateDelivery,
  validateQuantity,
  validateQuoteSubmission,
  type QuoteDraft,
} from './quote';
import { isValidPantone, validateMockupFile } from './techPack';
import { catalogue, completeHoodie, completeTShirt, emptyPack } from './testing/builders';
import { formatEgp, formatEgpRange } from './money';

const delivery = { recipientName: 'Salma', mobile: '01012345678', governorate: 'Giza', city: 'Dokki', street: '' };

function readyDraft(): QuoteDraft {
  const pack = completeTShirt();
  return {
    ...createQuoteDraft('submission-1'),
    selectedPackIds: [pack.id],
    items: { [pack.id]: { quantity: 300, comment: ' Rush ' } },
    delivery,
  };
}

describe('normalizeEgyptianMobile', () => {
  it.each([
    ['01012345678', '01012345678'],
    ['01112345678', '01112345678'],
    ['01212345678', '01212345678'],
    ['01512345678', '01512345678'],
    ['+201012345678', '01012345678'],
    ['00201012345678', '01012345678'],
    ['+20 101 234 5678', '01012345678'],
    ['010-1234-5678', '01012345678'],
  ])('accepts %s', (input, expected) => {
    expect(normalizeEgyptianMobile(input)).toBe(expected);
  });

  it.each(['01312345678', '0101234567', '010123456789', '1012345678', '+2013012345678', 'phone', ''])(
    'rejects %s',
    (input) => {
      expect(normalizeEgyptianMobile(input)).toBeNull();
    },
  );
});

describe('validateDelivery', () => {
  it('requires recipient, mobile, governorate and city, not the street', () => {
    expect(validateDelivery(delivery)).toEqual({});
    const errors = validateDelivery({ recipientName: ' ', mobile: '123', governorate: '', city: '', street: '' });
    expect(Object.keys(errors).sort()).toEqual(['city', 'governorate', 'mobile', 'recipientName']);
  });
});

describe('validateQuantity', () => {
  it('enforces presence, whole numbers, the MOQ and the ceiling', () => {
    expect(validateQuantity(null, 100, catalogue)).toMatch(/Add/);
    expect(validateQuantity(100.5, 100, catalogue)).toMatch(/whole/);
    expect(validateQuantity(99, 100, catalogue)).toMatch(/at least 100/);
    expect(validateQuantity(100, 100, catalogue)).toBeNull();
    expect(validateQuantity(5001, 100, catalogue)).toMatch(/5,000/);
  });
});

describe('packIneligibilityReason', () => {
  it('explains incomplete and sent packs', () => {
    expect(packIneligibilityReason(emptyPack(), catalogue)).toBe('Add a name.');
    expect(packIneligibilityReason({ ...completeTShirt(), status: 'quote_requested' }, catalogue)).toMatch(/Already sent/);
    expect(packIneligibilityReason(completeTShirt(), catalogue)).toBeNull();
  });
});

describe('validateQuoteSubmission', () => {
  it('passes a complete draft', () => {
    expect(validateQuoteSubmission(readyDraft(), [completeTShirt()], catalogue)).toEqual([]);
  });

  it('needs at least one pack', () => {
    const draft = { ...readyDraft(), selectedPackIds: [] };
    expect(validateQuoteSubmission(draft, [], catalogue)).toEqual(['Pick at least one tech pack.']);
  });

  it('rejects quantities below each product MOQ', () => {
    const pack = completeHoodie();
    const draft = { ...readyDraft(), selectedPackIds: [pack.id], items: { [pack.id]: { quantity: 100, comment: '' } } };
    expect(validateQuoteSubmission(draft, [pack], catalogue)[0]).toMatch(/at least 150/);
  });

  it('rejects a pack that was already sent or has become incomplete', () => {
    const sent = { ...completeTShirt(), status: 'quote_requested' as const };
    expect(validateQuoteSubmission(readyDraft(), [sent], catalogue)[0]).toMatch(/Already sent/);
    const emptied = { ...completeTShirt(), name: '' };
    expect(validateQuoteSubmission(readyDraft(), [emptied], catalogue)[0]).toMatch(/Add a name/);
    expect(validateQuoteSubmission(readyDraft(), [], catalogue)[0]).toMatch(/no longer exists/);
  });
});

describe('buildQuoteRequest', () => {
  it('freezes a snapshot and sums independent products', () => {
    const shirt = completeTShirt();
    const hoodie = { ...completeHoodie(), id: 'hoodie-1' };
    const request = buildQuoteRequest({
      id: 'request-1',
      sequence: 3,
      draft: {
        ...readyDraft(),
        selectedPackIds: [shirt.id, hoodie.id],
        items: { [shirt.id]: { quantity: 300, comment: ' Rush ' }, [hoodie.id]: { quantity: 200, comment: '' } },
        delivery: { ...delivery, mobile: '+201012345678' },
      },
      packs: [shirt, hoodie],
      catalogue,
      now: '2026-11-02T10:00:00.000Z',
    });

    expect(request.reference).toBe('QR-0003');
    expect(request.delivery.mobile).toBe('01012345678');
    expect(request.items.map((item) => item.pack.status)).toEqual(['quote_requested', 'quote_requested']);
    expect(request.items[0].comment).toBe('Rush');
    expect(shirt.status).toBe('draft');

    const total = requestEstimatedTotal(request);
    expect(total.low).toBe(request.items[0].estimate.total.low + request.items[1].estimate.total.low);
  });
});

describe('small validators and formats', () => {
  it('validates mockup files', () => {
    expect(validateMockupFile({ type: 'image/png', size: 1000 })).toBeNull();
    expect(validateMockupFile({ type: 'image/gif', size: 1000 })).toMatch(/PNG/);
    expect(validateMockupFile({ type: 'image/webp', size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
  });

  it('validates Pantone codes', () => {
    expect(isValidPantone('19-4052 TCX')).toBe(true);
    expect(isValidPantone('Pantone 19-4052')).toBe(true);
    expect(isValidPantone('blue')).toBe(false);
  });

  it('formats money in EGP, never $', () => {
    expect(formatEgp(125000)).toBe('1,250 EGP');
    expect(formatEgpRange({ low: 110000, high: 140000 })).toBe('1,100–1,400 EGP');
    expect(formatEgpRange({ low: 125000, high: 125000 })).toBe('1,250 EGP');
  });
});
