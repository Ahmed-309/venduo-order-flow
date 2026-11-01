import { egp } from '../money';
import type { Catalogue, Category, ReadinessRule } from './types';

/** Illustrative assessment data: believable figures, not verified factory prices. */

const COMMON_RULES: ReadinessRule[] = [
  { kind: 'field', field: 'name', severity: 'block', message: 'Add a name.' },
  { kind: 'field', field: 'description', severity: 'block', message: 'Add a short description.' },
  { kind: 'mockups', severity: 'block', message: 'Add front and back mockups.' },
  { kind: 'measurements', severity: 'block', message: 'Pick a fit and check its measurements.' },
  { kind: 'fabric_placement', placement: 'body', severity: 'block', message: 'Add at least one body fabric.' },
];

const NO_TRIMS_WARNING: ReadinessRule = {
  kind: 'any_trim',
  severity: 'warn',
  message: 'No trims added. Is this intentional?',
};

const TOP_POINTS = [
  { id: 'chest', code: 'A', label: 'Chest width' },
  { id: 'length', code: 'B', label: 'Body length' },
  { id: 'sleeve', code: 'C', label: 'Sleeve length' },
];

const BOTTOM_POINTS = [
  { id: 'waist', code: 'A', label: 'Waist width' },
  { id: 'hip', code: 'B', label: 'Hip width' },
  { id: 'outseam', code: 'C', label: 'Outseam' },
];

function topFits(chest: number, length: number, sleeve: number): Category['fits'] {
  return [
    {
      id: 'regular',
      name: 'Regular',
      consumptionFactor: 1,
      points: {
        chest: { baseCm: chest, gradeCm: 2 },
        length: { baseCm: length, gradeCm: 1.5 },
        sleeve: { baseCm: sleeve, gradeCm: 0.5 },
      },
    },
    {
      id: 'boxy',
      name: 'Boxy',
      consumptionFactor: 1.08,
      points: {
        chest: { baseCm: chest + 4, gradeCm: 2.5 },
        length: { baseCm: length - 3, gradeCm: 1 },
        sleeve: { baseCm: sleeve, gradeCm: 0.5 },
      },
    },
    {
      id: 'oversized',
      name: 'Oversized',
      consumptionFactor: 1.18,
      points: {
        chest: { baseCm: chest + 8, gradeCm: 3 },
        length: { baseCm: length + 4, gradeCm: 2 },
        sleeve: { baseCm: sleeve + 3, gradeCm: 1 },
      },
    },
  ];
}

function bottomFits(waist: number, hip: number, outseam: number): Category['fits'] {
  return [
    {
      id: 'regular',
      name: 'Regular',
      consumptionFactor: 1,
      points: {
        waist: { baseCm: waist, gradeCm: 2 },
        hip: { baseCm: hip, gradeCm: 2 },
        outseam: { baseCm: outseam, gradeCm: 1 },
      },
    },
    {
      id: 'boxy',
      name: 'Boxy',
      consumptionFactor: 1.08,
      points: {
        waist: { baseCm: waist + 2, gradeCm: 2 },
        hip: { baseCm: hip + 4, gradeCm: 2.5 },
        outseam: { baseCm: outseam - 2, gradeCm: 1 },
      },
    },
    {
      id: 'oversized',
      name: 'Oversized',
      consumptionFactor: 1.18,
      points: {
        waist: { baseCm: waist + 4, gradeCm: 2.5 },
        hip: { baseCm: hip + 8, gradeCm: 3 },
        outseam: { baseCm: outseam + 2, gradeCm: 1.5 },
      },
    },
  ];
}

const sketches = (id: string) => ({ front: `/sketches/${id}-front.svg`, back: `/sketches/${id}-back.svg` });

export const seedCatalogue: Catalogue = {
  referenceSize: 'M',
  families: [
    { id: 'tops', name: 'Tops' },
    { id: 'bottoms', name: 'Bottoms' },
  ],
  hubs: [
    { id: 'cairo', name: 'Cairo', moq: 100 },
    { id: 'alexandria', name: 'Alexandria', moq: 150 },
  ],
  categories: [
    {
      id: 't-shirt',
      familyId: 'tops',
      name: 'T-shirt',
      availability: 'available',
      sketches: sketches('t-shirt'),
      moq: 100,
      labour: { cairo: egp(55), alexandria: egp(50) },
      finishing: egp(12),
      productionWeeks: { cairo: 4, alexandria: 5 },
      placements: [
        { placement: 'body', consumptionKg: 0.2 },
        { placement: 'sleeves', consumptionKg: 0.05 },
        { placement: 'collar', consumptionKg: 0.02 },
      ],
      points: TOP_POINTS,
      fits: topFits(52, 70, 21),
      rules: [...COMMON_RULES, NO_TRIMS_WARNING],
    },
    {
      id: 'hoodie',
      familyId: 'tops',
      name: 'Hoodie',
      availability: 'available',
      sketches: sketches('hoodie'),
      moq: 150,
      labour: { cairo: egp(135), alexandria: egp(125) },
      finishing: egp(22),
      productionWeeks: { cairo: 6, alexandria: 7 },
      placements: [
        { placement: 'body', consumptionKg: 0.55 },
        { placement: 'sleeves', consumptionKg: 0.15 },
        { placement: 'lining', consumptionKg: 0.08 },
      ],
      points: TOP_POINTS,
      fits: topFits(58, 70, 65),
      rules: [
        ...COMMON_RULES,
        { kind: 'trim_kind', trimKind: 'drawcord', severity: 'block', message: 'Add a drawcord. A hoodie needs one.' },
      ],
    },
    {
      id: 'polo',
      familyId: 'tops',
      name: 'Polo',
      availability: 'available',
      sketches: sketches('polo'),
      moq: 150,
      labour: { cairo: egp(85), alexandria: egp(80) },
      finishing: egp(16),
      productionWeeks: { cairo: 5, alexandria: 5 },
      placements: [
        { placement: 'body', consumptionKg: 0.24 },
        { placement: 'sleeves', consumptionKg: 0.05 },
        { placement: 'collar', consumptionKg: 0.03 },
      ],
      points: TOP_POINTS,
      fits: topFits(53, 71, 23),
      rules: [
        ...COMMON_RULES,
        { kind: 'trim_kind', trimKind: 'button', severity: 'warn', message: 'No buttons added. Is this intentional?' },
      ],
    },
    {
      id: 'sweatshirt',
      familyId: 'tops',
      name: 'Sweatshirt',
      availability: 'available',
      sketches: sketches('sweatshirt'),
      moq: 150,
      labour: { cairo: egp(110), alexandria: egp(100) },
      finishing: egp(18),
      productionWeeks: { cairo: 5, alexandria: 6 },
      placements: [
        { placement: 'body', consumptionKg: 0.48 },
        { placement: 'sleeves', consumptionKg: 0.14 },
        { placement: 'collar', consumptionKg: 0.03 },
      ],
      points: TOP_POINTS,
      fits: topFits(56, 68, 63),
      rules: [...COMMON_RULES, NO_TRIMS_WARNING],
    },
    {
      id: 'trousers',
      familyId: 'bottoms',
      name: 'Trousers',
      availability: 'available',
      sketches: sketches('trousers'),
      moq: 200,
      labour: { cairo: egp(120), alexandria: egp(110) },
      finishing: egp(20),
      productionWeeks: { cairo: 6, alexandria: 6 },
      placements: [
        { placement: 'body', consumptionKg: 0.5 },
        { placement: 'lining', consumptionKg: 0.06 },
      ],
      points: BOTTOM_POINTS,
      fits: bottomFits(40, 52, 104),
      rules: [
        ...COMMON_RULES,
        { kind: 'trim_kind', trimKind: 'zip', severity: 'warn', message: 'No zip added. Is this intentional?' },
      ],
    },
    {
      id: 'shorts',
      familyId: 'bottoms',
      name: 'Shorts',
      availability: 'available',
      sketches: sketches('shorts'),
      moq: 150,
      labour: { cairo: egp(70), alexandria: egp(65) },
      finishing: egp(14),
      productionWeeks: { cairo: 4, alexandria: 5 },
      placements: [
        { placement: 'body', consumptionKg: 0.3 },
        { placement: 'lining', consumptionKg: 0.05 },
      ],
      points: BOTTOM_POINTS,
      fits: bottomFits(40, 54, 48),
      rules: [...COMMON_RULES, NO_TRIMS_WARNING],
    },
    {
      id: 'jacket',
      familyId: 'tops',
      name: 'Jacket',
      availability: 'coming_soon',
      sketches: sketches('jacket'),
      moq: 0,
      labour: {},
      finishing: 0,
      productionWeeks: {},
      placements: [],
      points: [],
      fits: [],
      rules: [],
    },
  ],
  fabrics: [
    {
      id: 'cotton-jersey',
      name: 'Cotton jersey',
      gsm: 180,
      composition: '100% cotton',
      colours: ['Optic white', 'Black', 'Heather grey', 'Navy'],
      categoryIds: ['t-shirt', 'polo'],
      offers: { cairo: { pricePerKg: egp(340), moq: 100, leadWeeks: 2 } },
    },
    {
      id: 'combed-jersey',
      name: 'Combed cotton jersey',
      gsm: 220,
      composition: '100% combed cotton',
      colours: ['Ecru', 'Black', 'Olive', 'Clay'],
      categoryIds: ['t-shirt', 'hoodie', 'sweatshirt'],
      offers: { alexandria: { pricePerKg: egp(410), moq: 200, leadWeeks: 3 } },
    },
    {
      id: 'french-terry',
      name: 'French terry',
      gsm: 320,
      composition: '95% cotton, 5% elastane',
      colours: ['Black', 'Heather grey', 'Forest', 'Sand'],
      categoryIds: ['hoodie', 'sweatshirt', 'shorts'],
      offers: {
        cairo: { pricePerKg: egp(420), moq: 150, leadWeeks: 3 },
        alexandria: { pricePerKg: egp(395), moq: 250, leadWeeks: 4 },
      },
    },
    {
      id: 'heavy-fleece',
      name: 'Heavy brushed fleece',
      gsm: 380,
      composition: '80% cotton, 20% polyester',
      colours: ['Black', 'Charcoal', 'Burgundy'],
      categoryIds: ['hoodie', 'sweatshirt'],
      offers: { alexandria: { pricePerKg: egp(460), moq: 200, leadWeeks: 4 } },
    },
    {
      id: 'pique',
      name: 'Cotton piqué',
      gsm: 220,
      composition: '100% cotton',
      colours: ['White', 'Navy', 'Bottle green'],
      categoryIds: ['polo'],
      offers: {
        cairo: { pricePerKg: egp(380), moq: 150, leadWeeks: 3 },
        alexandria: { pricePerKg: egp(365), moq: 200, leadWeeks: 3 },
      },
    },
    {
      id: 'cotton-twill',
      name: 'Cotton twill',
      gsm: 260,
      composition: '100% cotton',
      colours: ['Khaki', 'Navy', 'Black'],
      categoryIds: ['trousers', 'shorts'],
      offers: { cairo: { pricePerKg: egp(360), moq: 200, leadWeeks: 3 } },
    },
    {
      id: 'stretch-twill',
      name: 'Stretch twill',
      gsm: 280,
      composition: '97% cotton, 3% elastane',
      colours: ['Stone', 'Charcoal', 'Olive'],
      categoryIds: ['trousers', 'shorts'],
      offers: { alexandria: { pricePerKg: egp(430), moq: 250, leadWeeks: 4 } },
    },
    {
      id: 'linen-blend',
      name: 'Linen blend',
      gsm: 190,
      composition: '55% linen, 45% cotton',
      colours: ['Natural', 'Sky', 'Terracotta'],
      categoryIds: ['trousers', 'shorts'],
      offers: { alexandria: { pricePerKg: egp(520), moq: 200, leadWeeks: 5 } },
    },
  ],
  trims: [
    {
      id: 'metal-zip',
      name: 'Metal zip, 18 cm',
      kind: 'zip',
      colours: ['Antique brass', 'Nickel'],
      quantityPerGarment: 1,
      categoryIds: ['trousers', 'shorts'],
      offers: { cairo: { price: egp(18), moq: 200, leadWeeks: 2 } },
    },
    {
      id: 'nylon-zip',
      name: 'Nylon zip, 18 cm',
      kind: 'zip',
      colours: ['Black', 'Navy', 'Stone'],
      quantityPerGarment: 1,
      categoryIds: ['trousers', 'shorts', 'hoodie'],
      offers: {
        cairo: { price: egp(9), moq: 100, leadWeeks: 1 },
        alexandria: { price: egp(8), moq: 200, leadWeeks: 2 },
      },
    },
    {
      id: 'flat-drawcord',
      name: 'Flat cotton drawcord',
      kind: 'drawcord',
      colours: ['White', 'Black', 'Sand'],
      quantityPerGarment: 1,
      categoryIds: ['hoodie', 'sweatshirt', 'shorts'],
      offers: {
        cairo: { price: egp(7), moq: 100, leadWeeks: 1 },
        alexandria: { price: egp(6), moq: 150, leadWeeks: 1 },
      },
    },
    {
      id: 'waxed-drawcord',
      name: 'Round waxed drawcord',
      kind: 'drawcord',
      colours: ['Black', 'Olive'],
      quantityPerGarment: 1,
      categoryIds: ['hoodie', 'shorts', 'trousers'],
      offers: { alexandria: { price: egp(11), moq: 250, leadWeeks: 2 } },
    },
    {
      id: 'corozo-button',
      name: 'Corozo button, 15 mm',
      kind: 'button',
      colours: ['Natural', 'Dark brown'],
      quantityPerGarment: 3,
      categoryIds: ['polo', 'trousers'],
      offers: { cairo: { price: egp(5), moq: 250, leadWeeks: 2 } },
    },
    {
      id: 'recycled-button',
      name: 'Recycled polyester button, 15 mm',
      kind: 'button',
      colours: ['White', 'Black', 'Navy'],
      quantityPerGarment: 3,
      categoryIds: ['polo', 'trousers'],
      offers: {
        cairo: { price: egp(2), moq: 100, leadWeeks: 1 },
        alexandria: { price: egp(2), moq: 150, leadWeeks: 1 },
      },
    },
  ],
  pricing: {
    quantityTiers: [
      { minQuantity: 0, factor: 1 },
      { minQuantity: 300, factor: 0.95 },
      { minQuantity: 1000, factor: 0.9 },
      { minQuantity: 3000, factor: 0.85 },
    ],
    uncertainty: { complete: 0.1, partial: 0.25 },
    customColour: { moq: 300, extraLeadWeeks: 2 },
    quantity: { min: 50, max: 5000, step: 50 },
  },
  governorates: [
    'Alexandria', 'Aswan', 'Asyut', 'Beheira', 'Beni Suef', 'Cairo', 'Dakahlia', 'Damietta', 'Faiyum',
    'Gharbia', 'Giza', 'Ismailia', 'Kafr El Sheikh', 'Luxor', 'Matrouh', 'Minya', 'Monufia', 'New Valley',
    'North Sinai', 'Port Said', 'Qalyubia', 'Qena', 'Red Sea', 'Sharqia', 'Sohag', 'South Sinai', 'Suez',
  ],
};
