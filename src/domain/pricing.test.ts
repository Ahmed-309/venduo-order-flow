import { describe, expect, it } from 'vitest';
import { addFabric, addTrim } from './hub';
import { egp } from './money';
import { effectiveMoq } from './moq';
import { estimatePrice } from './pricing';
import { catalogue, completeHoodie, completeTShirt, emptyPack, withBodyFabric, withDetails, withFit } from './testing/builders';

const custom = { kind: 'custom', pantone: '19-4052 TCX' } as const;
const stock = { kind: 'stock', name: 'Black' } as const;

function withCustomColour() {
  return addFabric(emptyPack('t-shirt'), { fabricId: 'cotton-jersey', placement: 'body', colour: custom }, 'cairo', catalogue);
}

describe('estimatePrice', () => {
  it('gives a meaningful, labelled range on an empty pack', () => {
    const estimate = estimatePrice(emptyPack('hoodie'), 300, catalogue);
    expect(estimate.unit.low).toBeGreaterThan(0);
    expect(estimate.unit.high).toBeGreaterThan(estimate.unit.low);
    expect(estimate.hubId).toBeNull();
    expect(estimate.isComplete).toBe(false);
    expect(estimate.assumptions.length).toBeGreaterThan(0);
  });

  it('gets narrower as the pack fills in', () => {
    const width = (pack: ReturnType<typeof emptyPack>) => {
      const { unit } = estimatePrice(pack, 300, catalogue);
      return unit.high - unit.low;
    };
    const empty = emptyPack('t-shirt');
    const fitted = withFit(empty);
    const withFabric = withBodyFabric(fitted, 'cotton-jersey', 'cairo');
    const complete = withDetails(withFabric);
    expect(width(fitted)).toBeLessThan(width(empty));
    expect(width(withFabric)).toBeLessThan(width(fitted));
    expect(width(complete)).toBeLessThan(width(withFabric));
    expect(estimatePrice(complete, 300, catalogue).assumptions).toEqual([]);
  });

  it('computes a complete pack from the documented formula', () => {
    // T-shirt at Cairo, Regular: 0.2 kg × 340 + labour 55 + finishing 12 = 135 EGP.
    // Complete pack, ±10%: 121.5 and 148.5, rounded to whole pounds.
    const { unit } = estimatePrice(completeTShirt(), 100, catalogue);
    expect(unit).toEqual({ low: egp(122), high: egp(149) });
  });

  it('applies the quantity tiers, so larger orders cost less per unit', () => {
    const at = (quantity: number) => estimatePrice(completeTShirt(), quantity, catalogue).unit.high;
    expect(at(299)).toBeGreaterThan(at(300));
    expect(at(300)).toBeGreaterThan(at(1000));
    expect(at(1000)).toBeGreaterThan(at(3000));
    expect(at(3000)).toBe(at(5000));
  });

  it('total is the unit range × quantity', () => {
    const estimate = estimatePrice(completeTShirt(), 450, catalogue);
    expect(estimate.total).toEqual({ low: estimate.unit.low * 450, high: estimate.unit.high * 450 });
  });

  it('stores integer piastres', () => {
    const { unit, total } = estimatePrice(completeHoodie(), 777, catalogue);
    for (const value of [unit.low, unit.high, total.low, total.high]) expect(Number.isInteger(value)).toBe(true);
  });

  it('includes every selected material', () => {
    const base = completeHoodie();
    const sleeves = addFabric(base, { fabricId: 'french-terry', placement: 'sleeves', colour: stock }, 'cairo', catalogue);
    const zip = addTrim(base, { trimId: 'nylon-zip', colour: 'Black' });
    const baseHigh = estimatePrice(base, 300, catalogue).unit.high;
    expect(estimatePrice(sleeves, 300, catalogue).unit.high).toBeGreaterThan(baseHigh);
    expect(estimatePrice(zip, 300, catalogue).unit.high).toBeGreaterThan(baseHigh);
  });

  it('prices a required trim that is still missing, as an assumption', () => {
    const noCord = { ...completeHoodie(), trims: [] };
    const estimate = estimatePrice(noCord, 300, catalogue);
    expect(estimate.assumptions).toContain('No drawcord yet, so this uses the range of drawcords.');
  });

  it('uses the fit consumption factor', () => {
    const regular = withBodyFabric(withFit(emptyPack('t-shirt'), 'regular'), 'cotton-jersey', 'cairo');
    const oversized = withBodyFabric(withFit(emptyPack('t-shirt'), 'oversized'), 'cotton-jersey', 'cairo');
    expect(estimatePrice(oversized, 300, catalogue).unit.high).toBeGreaterThan(estimatePrice(regular, 300, catalogue).unit.high);
  });

  it('adds two weeks to the longest lead time for a custom colour', () => {
    expect(estimatePrice(completeTShirt(), 300, catalogue).leadTimeWeeks).toBe(4);
    expect(estimatePrice(withCustomColour(), 300, catalogue).leadTimeWeeks).toBe(6);
  });

  it('keeps an estimate below MOQ visible and flags it', () => {
    const estimate = estimatePrice(completeTShirt(), 50, catalogue);
    expect(estimate.unit.low).toBeGreaterThan(0);
    expect(estimate.isBelowMoq).toBe(true);
    expect(estimatePrice(completeTShirt(), 100, catalogue).isBelowMoq).toBe(false);
  });
});

describe('effectiveMoq', () => {
  it('uses the garment minimum before a hub is chosen', () => {
    expect(effectiveMoq(emptyPack('trousers'), catalogue)).toMatchObject({
      value: 200,
      reason: 'MOQ 200 because of the trousers minimum.',
    });
  });

  it('is raised by the hub', () => {
    const pack = withBodyFabric(emptyPack('t-shirt'), 'combed-jersey', 'alexandria');
    expect(effectiveMoq(pack, catalogue).value).toBe(200);
    expect(effectiveMoq(pack, catalogue).drivers.map((driver) => driver.kind)).toEqual(['fabric']);
  });

  it('is raised by every chosen material, including trims', () => {
    const pack = addTrim(withBodyFabric(emptyPack('trousers'), 'cotton-twill', 'cairo'), { trimId: 'corozo-button', colour: 'Natural' });
    expect(effectiveMoq(pack, catalogue)).toMatchObject({ value: 250, reason: 'MOQ 250 because of Corozo button, 15 mm.' });
  });

  it('is raised by a custom colour, with the brief wording', () => {
    expect(effectiveMoq(withCustomColour(), catalogue)).toMatchObject({
      value: 300,
      reason: 'MOQ 300 because of your custom colour.',
    });
  });

  it('names every driver in a tie', () => {
    const pack = withBodyFabric(emptyPack('hoodie'), 'french-terry', 'cairo');
    const moq = effectiveMoq(pack, catalogue);
    expect(moq.value).toBe(150);
    expect(moq.drivers.map((driver) => driver.kind)).toEqual(['category', 'fabric']);
    expect(moq.reason).toBe('MOQ 150 because of the hoodie minimum and French terry.');
  });
});
