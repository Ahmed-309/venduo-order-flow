import { seedCatalogue } from '../catalogue/seed';
import { findCategory } from '../catalogue/types';
import { createMeasurements } from '../grading';
import { addFabric, addTrim } from '../hub';
import { createTechPack, type TechPack } from '../techPack';

/** Small pack builders shared by the domain and application tests. */

export const catalogue = seedCatalogue;

export function emptyPack(categoryId = 't-shirt'): TechPack {
  return createTechPack({
    id: `pack-${categoryId}`,
    sequence: 7,
    category: findCategory(catalogue, categoryId),
    now: '2026-11-01T10:00:00.000Z',
  });
}

export function withDetails(pack: TechPack): TechPack {
  return { ...pack, name: 'Sample', description: 'A sample garment.' };
}

export function withFit(pack: TechPack, fitId = 'regular'): TechPack {
  const category = findCategory(catalogue, pack.categoryId);
  return { ...pack, measurements: createMeasurements(category, fitId, catalogue.referenceSize) };
}

export function withBodyFabric(pack: TechPack, fabricId: string, hubId: string): TechPack {
  return addFabric(pack, { fabricId, placement: 'body', colour: { kind: 'stock', name: 'Black' } }, hubId, catalogue);
}

/** A T-shirt that passes every blocking rule, with no trims, at Cairo. */
export function completeTShirt(): TechPack {
  return withBodyFabric(withFit(withDetails(emptyPack('t-shirt'))), 'cotton-jersey', 'cairo');
}

/** A hoodie that passes every blocking rule at Cairo. */
export function completeHoodie(): TechPack {
  const pack = withBodyFabric(withFit(withDetails(emptyPack('hoodie'))), 'french-terry', 'cairo');
  return addTrim(pack, { trimId: 'flat-drawcord', colour: 'White' });
}
