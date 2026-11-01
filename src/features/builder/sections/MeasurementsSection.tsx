'use client';

import { useState } from 'react';
import { SIZES, type Category, type Size } from '@/domain/catalogue/types';
import {
  changeBaseSize,
  createMeasurements,
  hasEditedMeasurements,
  resetMeasurement,
  setMeasurement,
} from '@/domain/grading';
import type { Measurements } from '@/domain/techPack';
import { Dialog } from '@/features/shared/Dialog';
import styles from '../builder.module.css';
import type { SectionProps } from './types';

const MAX_CM = 300;

function parseCm(text: string): number | null {
  const value = Number(text);
  return text.trim() !== '' && Number.isFinite(value) && value > 0 && value <= MAX_CM ? value : null;
}

export function MeasurementsSection({ pack, catalogue, category, readOnly, onChange }: SectionProps) {
  const measurements = pack.measurements;
  const [pendingFitId, setPendingFitId] = useState<string | null>(null);

  function applyFit(fitId: string) {
    onChange({ ...pack, measurements: createMeasurements(category, fitId, catalogue.referenceSize) });
  }

  function pickFit(fitId: string) {
    if (measurements && hasEditedMeasurements(measurements, category, catalogue.referenceSize)) {
      setPendingFitId(fitId);
    } else {
      applyFit(fitId);
    }
  }

  const change = (next: Measurements, debounce = false) => onChange({ ...pack, measurements: next }, { debounce });

  return (
    <div className="stack-16">
      <fieldset className="field">
        <legend className="label">Fit</legend>
        <div className="row-8">
          {category.fits.map((fit) => (
            <label key={fit.id} className="choice-pill">
              <input
                className="visually-hidden"
                type="radio"
                name="fit"
                checked={measurements?.fitId === fit.id}
                disabled={readOnly}
                onChange={() => pickFit(fit.id)}
              />
              {fit.name}
            </label>
          ))}
        </div>
      </fieldset>

      {measurements ? (
        <SizeTable
          measurements={measurements}
          category={category}
          readOnly={readOnly}
          onChange={change}
        />
      ) : (
        <p className="meta">Pick a fit to see its size table.</p>
      )}

      {pendingFitId ? (
        <Dialog
          title="Replace your measurements?"
          onClose={() => setPendingFitId(null)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setPendingFitId(null)}>
                Keep my measurements
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  applyFit(pendingFitId);
                  setPendingFitId(null);
                }}
              >
                Use the new fit
              </button>
            </>
          }
        >
          <p>A new fit starts from its own preset, so the values you edited will be replaced.</p>
        </Dialog>
      ) : null}
    </div>
  );
}

interface SizeTableProps {
  measurements: Measurements;
  category: Category;
  readOnly: boolean;
  onChange: (next: Measurements, debounce?: boolean) => void;
}

function SizeTable({ measurements, category, readOnly, onChange }: SizeTableProps) {
  const overrides = category.points.flatMap((point) =>
    (measurements.overrides[point.id] ?? []).map((size) => ({ point, size })),
  );

  return (
    <div className="stack-16">
      <label className={`field ${styles.baseSize}`}>
        <span className="label">Base size</span>
        <select
          className="input"
          value={measurements.baseSize}
          disabled={readOnly}
          onChange={(event) => onChange(changeBaseSize(measurements, event.target.value as Size))}
        >
          {SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <p className="meta">Edit a value in the base column and the other sizes re-grade. Edit any other cell to set that size by hand.</p>

      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Size table, in centimetres">
        <table className={styles.sizeTable}>
          <thead>
            <tr>
              <th scope="col">Point (cm)</th>
              {SIZES.map((size) => (
                <th key={size} scope="col" className={size === measurements.baseSize ? styles.baseColumnHead : undefined}>
                  {size}
                  {size === measurements.baseSize ? ' · base' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {category.points.map((point) => (
              <tr key={point.id}>
                <th scope="row">
                  {point.code}: {point.label}
                </th>
                {SIZES.map((size) => (
                  <td key={size}>
                    <MeasurementCell
                      label={`${point.label}, size ${size}, in centimetres`}
                      value={measurements.values[point.id][size]}
                      isBase={size === measurements.baseSize}
                      isOverridden={(measurements.overrides[point.id] ?? []).includes(size)}
                      readOnly={readOnly}
                      onCommit={(value) => onChange(setMeasurement(measurements, category, point.id, size, value), true)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {overrides.length > 0 ? (
        <div className="stack-4">
          <h3 className="label">Set by hand</h3>
          <ul className="stack-4">
            {overrides.map(({ point, size }) => (
              <li key={`${point.id}-${size}`} className={styles.overrideRow}>
                <span className="tabular">
                  {point.label}, {size}: {measurements.values[point.id][size]} cm
                </span>
                {readOnly || size === measurements.baseSize ? (
                  size === measurements.baseSize ? <span className="meta">Now the base for this point</span> : null
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => onChange(resetMeasurement(measurements, category, point.id, size))}
                  >
                    Reset {size} to graded
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

interface MeasurementCellProps {
  label: string;
  value: number;
  isBase: boolean;
  isOverridden: boolean;
  readOnly: boolean;
  onCommit: (value: number) => void;
}

function MeasurementCell({ label, value, isBase, isOverridden, readOnly, onCommit }: MeasurementCellProps) {
  // While the field has focus, its text may be mid-edit ("5", "52.") or not yet valid.
  const [text, setText] = useState<string | null>(null);
  const isInvalid = text !== null && parseCm(text) === null;

  const classes = [styles.cellInput, 'tabular', isBase ? styles.cellBase : '', isOverridden ? styles.cellOverride : ''];

  return (
    <input
      className={classes.join(' ')}
      inputMode="decimal"
      aria-label={label}
      aria-invalid={isInvalid}
      title={isInvalid ? `Use a number between 0 and ${MAX_CM}` : undefined}
      value={text ?? String(value)}
      disabled={readOnly}
      onChange={(event) => {
        setText(event.target.value);
        const parsed = parseCm(event.target.value);
        if (parsed !== null) onCommit(parsed);
      }}
      onBlur={() => setText(null)}
    />
  );
}
