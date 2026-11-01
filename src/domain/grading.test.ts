import { describe, expect, it } from 'vitest';
import { findCategory } from './catalogue/types';
import {
  areMeasurementsValid,
  changeBaseSize,
  createMeasurements,
  gradeMeasurements,
  hasEditedMeasurements,
  resetMeasurement,
  setMeasurement,
} from './grading';
import { catalogue } from './testing/builders';

const category = findCategory(catalogue, 't-shirt');
const regular = () => createMeasurements(category, 'regular', 'M');

describe('grading', () => {
  it('builds a preset as base + size distance × increment', () => {
    expect(regular().values.chest).toEqual({ XS: 48, S: 50, M: 52, L: 54, XL: 56, XXL: 58 });
    expect(regular().values.length).toEqual({ XS: 67, S: 68.5, M: 70, L: 71.5, XL: 73, XXL: 74.5 });
  });

  it('regrades the other sizes when the base cell is edited', () => {
    const edited = setMeasurement(regular(), category, 'chest', 'M', 60);
    expect(edited.values.chest).toEqual({ XS: 56, S: 58, M: 60, L: 62, XL: 64, XXL: 66 });
    expect(edited.values.length).toEqual(regular().values.length);
    expect(edited.overrides).toEqual({});
  });

  it('records an override for a non-base cell and changes nothing else', () => {
    const edited = setMeasurement(regular(), category, 'chest', 'L', 57);
    expect(edited.values.chest.L).toBe(57);
    expect(edited.values.chest.XL).toBe(56);
    expect(edited.overrides.chest).toEqual(['L']);
  });

  it('keeps a manual override when the base is regraded', () => {
    const overridden = setMeasurement(regular(), category, 'chest', 'L', 57);
    const regraded = setMeasurement(overridden, category, 'chest', 'M', 60);
    expect(regraded.values.chest.L).toBe(57);
    expect(regraded.values.chest.XL).toBe(64);
  });

  it('preserves every value and override when the base size changes', () => {
    const overridden = setMeasurement(regular(), category, 'chest', 'L', 57);
    const moved = changeBaseSize(overridden, 'S');
    expect(moved.baseSize).toBe('S');
    expect(moved.values).toEqual(overridden.values);
    expect(moved.overrides).toEqual(overridden.overrides);
  });

  it('regrades only non-overridden cells from the new base', () => {
    const overridden = setMeasurement(regular(), category, 'chest', 'L', 57);
    const edited = setMeasurement(changeBaseSize(overridden, 'S'), category, 'chest', 'S', 40);
    expect(edited.values.chest).toEqual({ XS: 38, S: 40, M: 42, L: 57, XL: 46, XXL: 48 });
  });

  it('treats an overridden cell that becomes the base as the grading anchor', () => {
    const overridden = setMeasurement(regular(), category, 'chest', 'L', 57);
    const moved = changeBaseSize(overridden, 'L');
    expect(moved.values.chest.L).toBe(57);
    expect(moved.values.chest.XL).toBe(56);

    const regraded = setMeasurement(moved, category, 'chest', 'L', 58);
    expect(regraded.values.chest).toEqual({ XS: 52, S: 54, M: 56, L: 58, XL: 60, XXL: 62 });

    const anchored = gradeMeasurements(moved, category.fits[0]);
    expect(anchored.values.chest.XL).toBe(59);
  });

  it('resets an override back onto the graded line', () => {
    const overridden = setMeasurement(regular(), category, 'chest', 'L', 57);
    const reset = resetMeasurement(overridden, category, 'chest', 'L');
    expect(reset.values.chest.L).toBe(54);
    expect(reset.overrides.chest).toEqual([]);
  });

  it('leaves the base cell alone on reset', () => {
    const measurements = regular();
    expect(resetMeasurement(measurements, category, 'chest', 'M')).toBe(measurements);
  });

  it('avoids float drift in graded values', () => {
    const edited = setMeasurement(regular(), category, 'length', 'M', 70.3);
    expect(edited.values.length.L).toBe(71.8);
    expect(edited.values.length.XXL).toBe(74.8);
  });

  it('rejects measurements that grade to zero or below', () => {
    expect(areMeasurementsValid(regular(), category)).toBe(true);
    expect(areMeasurementsValid(null, category)).toBe(false);
    expect(areMeasurementsValid(setMeasurement(regular(), category, 'sleeve', 'M', 0.5), category)).toBe(false);
  });

  it('knows when a preset has been edited', () => {
    expect(hasEditedMeasurements(regular(), category, 'M')).toBe(false);
    expect(hasEditedMeasurements(setMeasurement(regular(), category, 'chest', 'M', 60), category, 'M')).toBe(true);
  });
});
