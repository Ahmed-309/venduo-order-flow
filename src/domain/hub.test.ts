import { describe, expect, it } from 'vitest';
import { addFabric, addTrim, availableFabrics, availableTrims, canSelectTrims, findIncompatibleTrims, removeFabric } from './hub';
import { clearSection } from './techPack';
import { catalogue, emptyPack, withBodyFabric } from './testing/builders';

const fabricIds = (pack: ReturnType<typeof emptyPack>) => availableFabrics(pack, catalogue).map((fabric) => fabric.id);
const stock = { kind: 'stock', name: 'Black' } as const;

describe('hub lock', () => {
  it('filters fabrics to the category before a hub is set', () => {
    expect(fabricIds(emptyPack('t-shirt'))).toEqual(['cotton-jersey', 'combed-jersey']);
  });

  it('locks the hub on the first fabric and filters what is left', () => {
    const pack = withBodyFabric(emptyPack('hoodie'), 'french-terry', 'cairo');
    expect(pack.hubId).toBe('cairo');
    expect(fabricIds(pack)).toEqual(['french-terry']);
    expect(() => withBodyFabric(pack, 'french-terry', 'alexandria')).toThrow(/locked/);
  });

  it('refuses a fabric at a hub that does not offer it', () => {
    expect(() => withBodyFabric(emptyPack('t-shirt'), 'combed-jersey', 'cairo')).toThrow(/not offered/);
  });

  it('keeps the lock while any fabric remains and releases it with the last one', () => {
    let pack = withBodyFabric(emptyPack('hoodie'), 'french-terry', 'cairo');
    pack = addFabric(pack, { fabricId: 'french-terry', placement: 'sleeves', colour: stock }, 'cairo', catalogue);
    pack = removeFabric(pack, 'body');
    expect(pack.hubId).toBe('cairo');
    pack = removeFabric(pack, 'sleeves');
    expect(pack.hubId).toBeNull();
  });

  it('clearing fabrics unlocks the hub', () => {
    const pack = withBodyFabric(emptyPack('hoodie'), 'french-terry', 'cairo');
    const cleared = clearSection(pack, 'fabrics');
    expect(cleared.hubId).toBeNull();
    expect(cleared.fabrics).toEqual([]);
  });

  it('disables trims until a fabric sets the hub', () => {
    const pack = emptyPack('hoodie');
    expect(canSelectTrims(pack)).toBe(false);
    expect(availableTrims(pack, catalogue)).toEqual([]);
    expect(() => addTrim(pack, { trimId: 'flat-drawcord', colour: 'White' })).toThrow();
  });

  it('shows only trims the locked hub can supply', () => {
    const pack = withBodyFabric(emptyPack('trousers'), 'cotton-twill', 'cairo');
    const ids = availableTrims(pack, catalogue).map((trim) => trim.id);
    expect(ids).toContain('metal-zip');
    expect(ids).not.toContain('waxed-drawcord');
  });
});

describe('moving to a new hub with provisional trims', () => {
  function provisional() {
    let pack = withBodyFabric(emptyPack('trousers'), 'cotton-twill', 'cairo');
    pack = addTrim(pack, { trimId: 'metal-zip', colour: 'Nickel' });
    pack = addTrim(pack, { trimId: 'nylon-zip', colour: 'Black' });
    return removeFabric(pack, 'body');
  }

  it('retains trims after the last fabric is removed', () => {
    const pack = provisional();
    expect(pack.hubId).toBeNull();
    expect(pack.trims.map((trim) => trim.trimId)).toEqual(['metal-zip', 'nylon-zip']);
  });

  it('identifies only the trims the new hub cannot supply', () => {
    expect(findIncompatibleTrims(provisional(), 'alexandria', catalogue).map((trim) => trim.trimId)).toEqual(['metal-zip']);
    expect(findIncompatibleTrims(provisional(), 'cairo', catalogue)).toEqual([]);
  });

  it('confirming removes only incompatible trims and selects the fabric and hub', () => {
    const moved = withBodyFabric(provisional(), 'stretch-twill', 'alexandria');
    expect(moved.hubId).toBe('alexandria');
    expect(moved.fabrics.map((fabric) => fabric.fabricId)).toEqual(['stretch-twill']);
    expect(moved.trims.map((trim) => trim.trimId)).toEqual(['nylon-zip']);
  });

  it('cancelling is simply not applying: the pack is left untouched', () => {
    const before = provisional();
    findIncompatibleTrims(before, 'alexandria', catalogue);
    expect(before.trims).toHaveLength(2);
    expect(before.hubId).toBeNull();
  });
});
