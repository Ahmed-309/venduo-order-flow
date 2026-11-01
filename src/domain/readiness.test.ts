import { describe, expect, it } from 'vitest';
import type { Catalogue, Category } from './catalogue/types';
import { evaluateReadiness } from './readiness';
import { catalogue, completeHoodie, completeTShirt, emptyPack, withBodyFabric, withDetails, withFit } from './testing/builders';
import { addTrim, removeTrim } from './hub';

const state = (pack: ReturnType<typeof emptyPack>, section: string, data: Catalogue = catalogue) =>
  evaluateReadiness(pack, data).sections.find((candidate) => candidate.id === section)?.state;

describe('evaluateReadiness', () => {
  it('blocks a new draft with one message per missing requirement', () => {
    const { blockers, canRequestQuote } = evaluateReadiness(emptyPack(), catalogue);
    expect(canRequestQuote).toBe(false);
    expect(blockers.map((blocker) => blocker.text)).toEqual([
      'Add a name.',
      'Add a short description.',
      'Pick a fit and check its measurements.',
      'Add at least one body fabric.',
    ]);
  });

  it('counts the prefilled default sketches as satisfying mockups', () => {
    const pack = emptyPack();
    expect(pack.mockups.front).toEqual({ source: 'default' });
    expect(state(pack, 'mockups')).toBe('complete');
  });

  it('only warns about missing trims on a T-shirt', () => {
    const result = evaluateReadiness(completeTShirt(), catalogue);
    expect(result.canRequestQuote).toBe(true);
    expect(result.warnings.map((warning) => warning.text)).toEqual(['No trims added. Is this intentional?']);
    expect(state(completeTShirt(), 'trims')).toBe('optional');
  });

  it('blocks a hoodie without a drawcord, because its category data says so', () => {
    const noCord = removeTrim(completeHoodie(), 'flat-drawcord');
    const result = evaluateReadiness(noCord, catalogue);
    expect(result.canRequestQuote).toBe(false);
    expect(result.blockers.map((blocker) => blocker.text)).toEqual(['Add a drawcord. A hoodie needs one.']);
    expect(state(noCord, 'trims')).toBe('incomplete');
    expect(evaluateReadiness(completeHoodie(), catalogue).canRequestQuote).toBe(true);
  });

  it('a non-drawcord trim does not satisfy the hoodie rule', () => {
    const zipOnly = addTrim(removeTrim(completeHoodie(), 'flat-drawcord'), { trimId: 'nylon-zip', colour: 'Black' });
    expect(evaluateReadiness(zipOnly, catalogue).canRequestQuote).toBe(false);
  });

  it('marks an optional section complete once it has content', () => {
    const pack = addTrim(completeTShirt(), { trimId: 'flat-drawcord', colour: 'White' });
    expect(state({ ...pack, categoryId: 't-shirt' }, 'trims')).toBe('complete');
  });

  it('measures progress against the sections that block the quote', () => {
    expect(evaluateReadiness(emptyPack(), catalogue).progress).toBeCloseTo(1 / 4);
    expect(evaluateReadiness(withFit(withDetails(emptyPack())), catalogue).progress).toBeCloseTo(3 / 4);
    expect(evaluateReadiness(completeTShirt(), catalogue).progress).toBe(1);
  });

  it('supports a new garment type through catalogue data alone', () => {
    const hoodie = catalogue.categories.find((category) => category.id === 'hoodie') as Category;
    const skirt: Category = {
      ...hoodie,
      id: 'skirt',
      name: 'Skirt',
      rules: [
        ...hoodie.rules.filter((rule) => rule.kind !== 'trim_kind'),
        { kind: 'trim_kind', trimKind: 'zip', severity: 'block', message: 'Add a zip. A skirt needs one.' },
      ],
    };
    const data: Catalogue = {
      ...catalogue,
      categories: [...catalogue.categories, skirt],
      fabrics: catalogue.fabrics.map((fabric) => ({ ...fabric, categoryIds: [...fabric.categoryIds, 'skirt'] })),
      trims: catalogue.trims.map((trim) => ({ ...trim, categoryIds: [...trim.categoryIds, 'skirt'] })),
    };
    const pack = { ...withBodyFabric(withFit(withDetails(emptyPack('hoodie'))), 'french-terry', 'cairo'), categoryId: 'skirt' };

    expect(evaluateReadiness(pack, data).blockers.map((blocker) => blocker.text)).toEqual(['Add a zip. A skirt needs one.']);
    const withZip = { ...pack, trims: [{ trimId: 'nylon-zip', colour: 'Black' }] };
    expect(evaluateReadiness(withZip, data).canRequestQuote).toBe(true);
  });
});

describe('seed catalogue', () => {
  const available = catalogue.categories.filter((category) => category.availability === 'available');

  it('meets the minimum seed from the brief', () => {
    expect(available.length).toBeGreaterThanOrEqual(6);
    expect(catalogue.families.length).toBeGreaterThanOrEqual(2);
    expect(catalogue.fabrics.length).toBeGreaterThanOrEqual(8);
    expect(catalogue.trims.length).toBeGreaterThanOrEqual(6);
    for (const category of available) expect(category.fits.length).toBeGreaterThanOrEqual(2);
  });

  it('lets every category satisfy its blocking trim rules at every hub that has a body fabric for it', () => {
    for (const category of available) {
      for (const hub of catalogue.hubs) {
        const hasFabric = catalogue.fabrics.some(
          (fabric) => fabric.categoryIds.includes(category.id) && fabric.offers[hub.id],
        );
        if (!hasFabric) continue;
        for (const rule of category.rules) {
          if (rule.kind !== 'trim_kind' || rule.severity !== 'block') continue;
          const trimKind = rule.trimKind;
          const canSatisfy = catalogue.trims.some(
            (trim) => trim.kind === trimKind && trim.categoryIds.includes(category.id) && trim.offers[hub.id],
          );
          expect(canSatisfy, `${category.id} at ${hub.id} needs a ${trimKind}`).toBe(true);
        }
      }
    }
  });

  it('gives every category a body fabric at both hubs', () => {
    for (const category of available) {
      for (const hub of catalogue.hubs) {
        const hasFabric = catalogue.fabrics.some(
          (fabric) => fabric.categoryIds.includes(category.id) && fabric.offers[hub.id],
        );
        expect(hasFabric, `${category.id} at ${hub.id}`).toBe(true);
      }
    }
  });
});
