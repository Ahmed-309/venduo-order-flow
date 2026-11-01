import { seedCatalogue as catalogue } from '@/domain/catalogue/seed';
import { findCategory } from '@/domain/catalogue/types';
import { createMeasurements } from '@/domain/grading';
import { addFabric, addTrim } from '@/domain/hub';
import { buildQuoteRequest, createQuoteDraft, type QuoteRequest } from '@/domain/quote';
import { createTechPack, type TechPack } from '@/domain/techPack';

export type FixtureName = 'empty' | 'partial' | 'populated';

export interface FixtureData {
  packs: TechPack[];
  requests: QuoteRequest[];
  packSequence: number;
  requestSequence: number;
}

const stock = (name: string) => ({ kind: 'stock', name }) as const;

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

function draft(sequence: number, categoryId: string, days: number): TechPack {
  const now = daysAgo(days);
  return createTechPack({ id: `demo-${sequence}`, sequence, category: findCategory(catalogue, categoryId), now });
}

function withFit(pack: TechPack, fitId: string): TechPack {
  const category = findCategory(catalogue, pack.categoryId);
  return { ...pack, measurements: createMeasurements(category, fitId, catalogue.referenceSize) };
}

function partialHoodie(sequence: number): TechPack {
  return withFit(
    { ...draft(sequence, 'hoodie', 1), name: 'Campus hoodie', description: 'Heavyweight hoodie for the spring drop.' },
    'oversized',
  );
}

function completeTee(sequence: number): TechPack {
  const pack = withFit(
    { ...draft(sequence, 't-shirt', 2), name: 'Everyday tee', description: 'A soft regular-fit T-shirt.' },
    'regular',
  );
  return addFabric(pack, { fabricId: 'cotton-jersey', placement: 'body', colour: stock('Black') }, 'cairo', catalogue);
}

function customColourSweatshirt(sequence: number): TechPack {
  const pack = withFit(
    { ...draft(sequence, 'sweatshirt', 3), name: 'Harbour crewneck', description: 'Boxy crewneck in a brand colour.' },
    'boxy',
  );
  return addTrim(
    addFabric(
      pack,
      { fabricId: 'heavy-fleece', placement: 'body', colour: { kind: 'custom', pantone: '19-4052 TCX' } },
      'alexandria',
      catalogue,
    ),
    { trimId: 'flat-drawcord', colour: 'Black' },
  );
}

function sentRequest(sequence: number, pack: TechPack, quantity: number, days: number): QuoteRequest {
  return buildQuoteRequest({
    id: `demo-request-${sequence}`,
    sequence,
    draft: {
      ...createQuoteDraft(`demo-submission-${sequence}`),
      selectedPackIds: [pack.id],
      items: { [pack.id]: { quantity, comment: 'Samples before bulk, please.' } },
      delivery: {
        recipientName: 'Salma Hassan',
        mobile: '01012345678',
        governorate: 'Giza',
        city: 'Dokki',
        street: '12 Tahrir Street',
      },
    },
    packs: [pack],
    catalogue,
    now: daysAgo(days),
  });
}

export function buildFixture(name: FixtureName): FixtureData {
  if (name === 'empty') return { packs: [], requests: [], packSequence: 0, requestSequence: 0 };
  if (name === 'partial') return { packs: [partialHoodie(1)], requests: [], packSequence: 1, requestSequence: 0 };

  const polo = addTrim(
    addFabric(
      withFit({ ...draft(4, 'polo', 8), name: 'Club polo', description: 'Classic piqué polo.' }, 'regular'),
      { fabricId: 'pique', placement: 'body', colour: stock('Navy') },
      'cairo',
      catalogue,
    ),
    { trimId: 'recycled-button', colour: 'White' },
  );
  const request = sentRequest(1, polo, 500, 6);
  return {
    packs: [partialHoodie(1), completeTee(2), customColourSweatshirt(3), ...request.items.map((item) => item.pack)],
    requests: [request],
    packSequence: 4,
    requestSequence: 1,
  };
}
