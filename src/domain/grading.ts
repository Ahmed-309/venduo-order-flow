import { SIZES, type Category, type Fit, type Size } from './catalogue/types';
import type { Measurements } from './techPack';

const roundCm = (value: number): number => Math.round(value * 10) / 10;

const sizeDistance = (from: Size, to: Size): number => SIZES.indexOf(to) - SIZES.indexOf(from);

const isOverridden = (measurements: Measurements, pointId: string, size: Size): boolean =>
  (measurements.overrides[pointId] ?? []).includes(size);

function gradedValue(anchor: number, anchorSize: Size, size: Size, gradeCm: number): number {
  return roundCm(anchor + sizeDistance(anchorSize, size) * gradeCm);
}

function gradeCmFor(fit: Fit, pointId: string): number {
  return fit.points[pointId]?.gradeCm ?? 0;
}

function findFit(category: Category, fitId: string): Fit {
  const fit = category.fits.find((candidate) => candidate.id === fitId);
  if (!fit) throw new Error(`Unknown fit: ${fitId}`);
  return fit;
}

/** Recalculates one point from its base cell: value = base + size distance × increment. */
function gradePoint(measurements: Measurements, pointId: string, fit: Fit): Record<Size, number> {
  const current = measurements.values[pointId];
  const anchor = current[measurements.baseSize];
  const next = { ...current };
  for (const size of SIZES) {
    if (size === measurements.baseSize || isOverridden(measurements, pointId, size)) continue;
    next[size] = gradedValue(anchor, measurements.baseSize, size, gradeCmFor(fit, pointId));
  }
  return next;
}

/** Calculates every size from its base cell while preserving explicit overrides. */
export function gradeMeasurements(measurements: Measurements, fit: Fit): Measurements {
  const values: Measurements['values'] = {};
  for (const pointId of Object.keys(measurements.values)) {
    values[pointId] = gradePoint(measurements, pointId, fit);
  }
  return { ...measurements, values };
}

/** The fit's preset, graded out from the catalogue's reference size, with no overrides. */
export function createMeasurements(category: Category, fitId: string, referenceSize: Size): Measurements {
  const fit = findFit(category, fitId);
  const values: Measurements['values'] = {};
  for (const point of category.points) {
    const preset = fit.points[point.id];
    values[point.id] = Object.fromEntries(
      SIZES.map((size) => [size, gradedValue(preset.baseCm, referenceSize, size, preset.gradeCm)]),
    ) as Record<Size, number>;
  }
  return { fitId, baseSize: referenceSize, values, overrides: {} };
}

/**
 * Moving the base changes no number and no override. It only decides which cell later edits
 * grade from. An overridden cell can become the base: its value is then the grading anchor.
 */
export function changeBaseSize(measurements: Measurements, baseSize: Size): Measurements {
  return { ...measurements, baseSize };
}

/** Editing the base cell regrades its point; editing any other cell records an override. */
export function setMeasurement(
  measurements: Measurements,
  category: Category,
  pointId: string,
  size: Size,
  value: number,
): Measurements {
  const values = {
    ...measurements.values,
    [pointId]: { ...measurements.values[pointId], [size]: roundCm(value) },
  };
  if (size === measurements.baseSize) {
    const fit = findFit(category, measurements.fitId);
    const edited = { ...measurements, values };
    return { ...edited, values: { ...values, [pointId]: gradePoint(edited, pointId, fit) } };
  }
  const overridden = measurements.overrides[pointId] ?? [];
  return {
    ...measurements,
    values,
    overrides: {
      ...measurements.overrides,
      [pointId]: overridden.includes(size) ? overridden : [...overridden, size],
    },
  };
}

/** Puts a hand-set cell back on the graded line of the current base. The base cell has no line to return to. */
export function resetMeasurement(
  measurements: Measurements,
  category: Category,
  pointId: string,
  size: Size,
): Measurements {
  if (size === measurements.baseSize) return measurements;
  const fit = findFit(category, measurements.fitId);
  const anchor = measurements.values[pointId][measurements.baseSize];
  return {
    ...measurements,
    values: {
      ...measurements.values,
      [pointId]: {
        ...measurements.values[pointId],
        [size]: gradedValue(anchor, measurements.baseSize, size, gradeCmFor(fit, pointId)),
      },
    },
    overrides: {
      ...measurements.overrides,
      [pointId]: (measurements.overrides[pointId] ?? []).filter((candidate) => candidate !== size),
    },
  };
}

/** True when the brand has changed anything a fresh preset would lose. */
export function hasEditedMeasurements(
  measurements: Measurements,
  category: Category,
  referenceSize: Size,
): boolean {
  const preset = createMeasurements(category, measurements.fitId, referenceSize);
  return JSON.stringify(preset.values) !== JSON.stringify(measurements.values);
}

export function areMeasurementsValid(measurements: Measurements | null, category: Category): boolean {
  if (!measurements) return false;
  if (!category.fits.some((fit) => fit.id === measurements.fitId)) return false;
  return category.points.every((point) =>
    SIZES.every((size) => {
      const value = measurements.values[point.id]?.[size];
      return typeof value === 'number' && Number.isFinite(value) && value > 0;
    }),
  );
}
