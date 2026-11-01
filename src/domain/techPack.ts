import type { Catalogue, Category, HubId, Placement, Size } from './catalogue/types';

export type TechPackStatus = 'draft' | 'quote_requested';

/** Default sketches come from the category; uploads point at a stored image by id. */
export type MockupImage =
  | { source: 'default' }
  | { source: 'upload'; assetId: string; fileName: string };

export type MockupSide = 'front' | 'back';

/**
 * Cell values are stored rather than derived, so changing the base size can leave every number
 * exactly as the brand sees it. See grading.ts for how they change.
 */
export interface Measurements {
  fitId: string;
  baseSize: Size;
  values: Record<string, Record<Size, number>>;
  /** Cells the brand set by hand; grading never overwrites them. */
  overrides: Record<string, Size[]>;
}

export type ColourChoice =
  | { kind: 'stock'; name: string }
  | { kind: 'custom'; pantone: string };

export interface FabricSelection {
  fabricId: string;
  placement: Placement;
  colour: ColourChoice;
}

export interface TrimSelection {
  trimId: string;
  colour: string;
}

export interface TechPack {
  id: string;
  reference: string;
  categoryId: string;
  name: string;
  description: string;
  mockups: Record<MockupSide, MockupImage>;
  measurements: Measurements | null;
  /** Set by the first fabric, cleared with the last one. */
  hubId: HubId | null;
  fabrics: FabricSelection[];
  trims: TrimSelection[];
  estimateQuantity: number;
  status: TechPackStatus;
  createdAt: string;
  updatedAt: string;
}

export type SectionId = 'details' | 'mockups' | 'measurements' | 'fabrics' | 'trims';

export const SECTION_TITLES: Record<SectionId, string> = {
  details: 'Details',
  mockups: 'Mockups',
  measurements: 'Measurements',
  fabrics: 'Fabrics',
  trims: 'Trims',
};

export const SECTION_IDS = Object.keys(SECTION_TITLES) as SectionId[];

export const DESCRIPTION_MAX_LENGTH = 200;
const DEFAULT_ESTIMATE_QUANTITY = 300;

export const formatPackReference = (sequence: number): string => `VND-${String(sequence).padStart(4, '0')}`;

export function createTechPack(input: { id: string; sequence: number; category: Category; now: string }): TechPack {
  return {
    id: input.id,
    reference: formatPackReference(input.sequence),
    categoryId: input.category.id,
    name: '',
    description: '',
    mockups: { front: { source: 'default' }, back: { source: 'default' } },
    measurements: null,
    hubId: null,
    fabrics: [],
    trims: [],
    estimateQuantity: DEFAULT_ESTIMATE_QUANTITY,
    status: 'draft',
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export const isFrozen = (pack: TechPack): boolean => pack.status !== 'draft';

export function displayName(pack: TechPack, catalogue: Catalogue): string {
  const category = catalogue.categories.find((candidate) => candidate.id === pack.categoryId);
  return pack.name.trim() || `Untitled ${category?.name.toLowerCase() ?? 'garment'}`;
}

/** "Clear section": removes the section's selections and overrides. Fabrics also unlock the hub. */
export function clearSection(pack: TechPack, section: SectionId): TechPack {
  switch (section) {
    case 'details':
      return { ...pack, name: '', description: '' };
    case 'mockups':
      return { ...pack, mockups: { front: { source: 'default' }, back: { source: 'default' } } };
    case 'measurements':
      return { ...pack, measurements: null };
    case 'fabrics':
      return { ...pack, fabrics: [], hubId: null };
    case 'trims':
      return { ...pack, trims: [] };
  }
}

const ACCEPTED_MOCKUP_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MOCKUP_MAX_BYTES = 5 * 1024 * 1024;

/** Returns a message for the brand, or null when the file can be used. */
export function validateMockupFile(file: { type: string; size: number }): string | null {
  if (!ACCEPTED_MOCKUP_TYPES.includes(file.type)) return 'Use a PNG, JPEG or WebP image.';
  if (file.size > MOCKUP_MAX_BYTES) return 'Use an image of 5 MB or less.';
  return null;
}

const PANTONE_PATTERN = /^(pantone\s*)?\d{2}-\d{4}(\s*(tcx|tpx|tpg))?$/i;

export const isValidPantone = (code: string): boolean => PANTONE_PATTERN.test(code.trim());
