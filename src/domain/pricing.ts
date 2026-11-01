import { findCategory, findFabric, findTrim, type Catalogue, type Category, type HubId } from './catalogue/types';
import type { MoneyRange, Piastres } from './money';
import { effectiveMoq, type EffectiveMoq } from './moq';
import { evaluateReadiness } from './readiness';
import type { TechPack } from './techPack';

export interface PriceEstimate {
  quantity: number;
  hubId: HubId | null;
  unit: MoneyRange;
  total: MoneyRange;
  leadTimeWeeks: number;
  moq: EffectiveMoq;
  isBelowMoq: boolean;
  /** True when the pack is complete, so the narrower uncertainty band applies. */
  isComplete: boolean;
  /** What the estimate had to guess. Empty when nothing was guessed. */
  assumptions: string[];
}

const ZERO: MoneyRange = { low: 0, high: 0 };

const addRange = (a: MoneyRange, b: MoneyRange): MoneyRange => ({ low: a.low + b.low, high: a.high + b.high });

const scaleRange = (range: MoneyRange, factor: number): MoneyRange => ({
  low: range.low * factor,
  high: range.high * factor,
});

function spread(values: number[]): MoneyRange {
  return values.length === 0 ? ZERO : { low: Math.min(...values), high: Math.max(...values) };
}

/** A per-hub figure for the chosen hub, or for every hub when none is chosen. */
function perHubValues(values: Record<HubId, number>, hubId: HubId | null): number[] {
  return hubId === null ? Object.values(values) : [values[hubId]];
}

function offersAtHub<Offer>(offers: Partial<Record<HubId, Offer>>, hubId: HubId | null): Offer[] {
  return Object.entries(offers)
    .filter(([offerHubId]) => hubId === null || offerHubId === hubId)
    .map(([, offer]) => offer as Offer);
}

function consumptionFactors(pack: TechPack, category: Category): MoneyRange {
  const fit = category.fits.find((candidate) => candidate.id === pack.measurements?.fitId);
  return fit
    ? { low: fit.consumptionFactor, high: fit.consumptionFactor }
    : spread(category.fits.map((candidate) => candidate.consumptionFactor));
}

function fabricCost(pack: TechPack, category: Category, catalogue: Catalogue, assumptions: string[]): MoneyRange {
  const factors = consumptionFactors(pack, category);
  if (!pack.measurements) assumptions.push('No fit picked yet, so fabric use spans every fit.');

  let cost = ZERO;
  for (const selection of pack.fabrics) {
    const offer = pack.hubId ? findFabric(catalogue, selection.fabricId)?.offers[pack.hubId] : undefined;
    const placement = category.placements.find((candidate) => candidate.placement === selection.placement);
    if (!offer || !placement) continue;
    cost = addRange(cost, scaleRange(factors, placement.consumptionKg * offer.pricePerKg));
  }

  if (!pack.fabrics.some((fabric) => fabric.placement === 'body')) {
    const kg = category.placements.find((candidate) => candidate.placement === 'body')?.consumptionKg ?? 0;
    const prices = spread(
      catalogue.fabrics
        .filter((fabric) => fabric.categoryIds.includes(category.id))
        .flatMap((fabric) => offersAtHub(fabric.offers, pack.hubId).map((offer) => offer.pricePerKg)),
    );
    cost = addRange(cost, { low: kg * factors.low * prices.low, high: kg * factors.high * prices.high });
    assumptions.push(`No body fabric yet, so this uses the range of ${category.name.toLowerCase()} fabrics.`);
  }
  return cost;
}

function trimCost(pack: TechPack, category: Category, catalogue: Catalogue, assumptions: string[]): MoneyRange {
  let cost = ZERO;
  for (const selection of pack.trims) {
    const trim = findTrim(catalogue, selection.trimId);
    if (!trim) continue;
    const prices = offersAtHub(trim.offers, pack.hubId).map((offer) => offer.price * trim.quantityPerGarment);
    cost = addRange(cost, spread(prices));
  }

  for (const rule of category.rules) {
    if (rule.kind !== 'trim_kind' || rule.severity !== 'block') continue;
    const trimKind = rule.trimKind;
    if (pack.trims.some((selection) => findTrim(catalogue, selection.trimId)?.kind === trimKind)) continue;
    const prices = catalogue.trims
      .filter((trim) => trim.kind === trimKind && trim.categoryIds.includes(category.id))
      .flatMap((trim) =>
        offersAtHub(trim.offers, pack.hubId).map((offer) => offer.price * trim.quantityPerGarment),
      );
    cost = addRange(cost, spread(prices));
    assumptions.push(`No ${trimKind} yet, so this uses the range of ${trimKind}s.`);
  }
  return cost;
}

function quantityFactor(quantity: number, catalogue: Catalogue): number {
  let factor = 1;
  for (const tier of catalogue.pricing.quantityTiers) {
    if (quantity >= tier.minQuantity) factor = tier.factor;
  }
  return factor;
}

function leadTimeWeeks(pack: TechPack, category: Category, catalogue: Catalogue): number {
  const weeks = perHubValues(category.productionWeeks, pack.hubId);
  if (pack.hubId) {
    const hubId = pack.hubId;
    for (const selection of pack.fabrics) {
      const offer = findFabric(catalogue, selection.fabricId)?.offers[hubId];
      if (offer) weeks.push(offer.leadWeeks);
    }
    for (const selection of pack.trims) {
      const offer = findTrim(catalogue, selection.trimId)?.offers[hubId];
      if (offer) weeks.push(offer.leadWeeks);
    }
  }
  const hasCustomColour = pack.fabrics.some((fabric) => fabric.colour.kind === 'custom');
  return Math.max(...weeks) + (hasCustomColour ? catalogue.pricing.customColour.extraLeadWeeks : 0);
}

/** Whole pounds, so the total shown always equals the unit price shown × quantity. */
const toWholePounds = (amount: number): Piastres => Math.round(amount / 100) * 100;

/**
 * unit = (fabric kg × EGP/kg + trims + labour + finishing) × quantity factor, ± uncertainty.
 * Anything not chosen yet is priced as the range of what it could be, and listed in assumptions.
 */
export function estimatePrice(pack: TechPack, quantity: number, catalogue: Catalogue): PriceEstimate {
  const category = findCategory(catalogue, pack.categoryId);
  const assumptions: string[] = [];

  const fabric = fabricCost(pack, category, catalogue, assumptions);
  const trims = trimCost(pack, category, catalogue, assumptions);
  const labour = spread(perHubValues(category.labour, pack.hubId));
  if (pack.hubId === null) assumptions.push('No hub yet, so labour spans both hubs.');
  const finishing: MoneyRange = { low: category.finishing, high: category.finishing };

  const isComplete = evaluateReadiness(pack, catalogue).canRequestQuote;
  const { complete, partial } = catalogue.pricing.uncertainty;
  const uncertainty = isComplete ? complete : partial;

  const baseCost = addRange(addRange(fabric, trims), addRange(labour, finishing));
  const cost = scaleRange(baseCost, quantityFactor(quantity, catalogue));
  const unit: MoneyRange = {
    low: toWholePounds(cost.low * (1 - uncertainty)),
    high: toWholePounds(cost.high * (1 + uncertainty)),
  };
  const moq = effectiveMoq(pack, catalogue);

  return {
    quantity,
    hubId: pack.hubId,
    unit,
    total: { low: unit.low * quantity, high: unit.high * quantity },
    leadTimeWeeks: leadTimeWeeks(pack, category, catalogue),
    moq,
    isBelowMoq: quantity < moq.value,
    isComplete,
    assumptions,
  };
}
