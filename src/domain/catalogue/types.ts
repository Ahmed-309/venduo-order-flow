import type { Piastres } from '../money';

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export type Size = (typeof SIZES)[number];

export type HubId = string;
export type Placement = 'body' | 'sleeves' | 'collar' | 'lining';
export type Severity = 'block' | 'warn';

export interface Family {
  id: string;
  name: string;
}

export interface Hub {
  id: HubId;
  name: string;
  moq: number;
}

export interface MeasurementPoint {
  id: string;
  /** Letter shown in the size table, for example "A". */
  code: string;
  label: string;
}

export interface Fit {
  id: string;
  name: string;
  /** Multiplies the fabric consumption of every placement. */
  consumptionFactor: number;
  /** Preset per point: value at the catalogue's reference size, and cm added per size step. */
  points: Record<string, { baseCm: number; gradeCm: number }>;
}

/**
 * What a garment needs before it can be quoted. This is the data behind brief rule 7.1:
 * a garment type's needs change here, and the fixed evaluator in readiness.ts stays as it is.
 */
export type ReadinessRule = { severity: Severity; message: string } & (
  | { kind: 'field'; field: 'name' | 'description' }
  | { kind: 'mockups' }
  | { kind: 'measurements' }
  | { kind: 'fabric_placement'; placement: Placement }
  | { kind: 'trim_kind'; trimKind: string }
  | { kind: 'any_trim' }
);

export interface Category {
  id: string;
  familyId: string;
  name: string;
  availability: 'available' | 'coming_soon';
  sketches: { front: string; back: string };
  moq: number;
  labour: Record<HubId, Piastres>;
  finishing: Piastres;
  productionWeeks: Record<HubId, number>;
  /** Placements offered for this garment, with their own consumption before the fit factor. */
  placements: { placement: Placement; consumptionKg: number }[];
  points: MeasurementPoint[];
  fits: Fit[];
  rules: ReadinessRule[];
}

export interface FabricOffer {
  pricePerKg: Piastres;
  moq: number;
  leadWeeks: number;
}

export interface Fabric {
  id: string;
  name: string;
  gsm: number;
  composition: string;
  colours: string[];
  categoryIds: string[];
  offers: Partial<Record<HubId, FabricOffer>>;
}

export interface TrimOffer {
  price: Piastres;
  moq: number;
  leadWeeks: number;
}

export interface Trim {
  id: string;
  name: string;
  kind: string;
  colours: string[];
  /** How many pieces one garment uses. */
  quantityPerGarment: number;
  categoryIds: string[];
  offers: Partial<Record<HubId, TrimOffer>>;
}

export interface PricingParameters {
  /** Sorted ascending by minQuantity; the highest tier reached applies. */
  quantityTiers: { minQuantity: number; factor: number }[];
  uncertainty: { complete: number; partial: number };
  customColour: { moq: number; extraLeadWeeks: number };
  quantity: { min: number; max: number; step: number };
}

export interface Catalogue {
  families: Family[];
  categories: Category[];
  hubs: Hub[];
  fabrics: Fabric[];
  trims: Trim[];
  pricing: PricingParameters;
  /** The size that a fit's preset baseCm values describe. */
  referenceSize: Size;
  governorates: string[];
}

export function findCategory(catalogue: Catalogue, categoryId: string): Category {
  const category = catalogue.categories.find((candidate) => candidate.id === categoryId);
  if (!category) throw new Error(`Unknown category: ${categoryId}`);
  return category;
}

export const findFabric = (catalogue: Catalogue, fabricId: string): Fabric | undefined =>
  catalogue.fabrics.find((fabric) => fabric.id === fabricId);

export const findTrim = (catalogue: Catalogue, trimId: string): Trim | undefined =>
  catalogue.trims.find((trim) => trim.id === trimId);

export const hubName = (catalogue: Catalogue, hubId: HubId): string =>
  catalogue.hubs.find((hub) => hub.id === hubId)?.name ?? hubId;
