'use client';

import { useState } from 'react';
import { findTrim, hubName, type Trim } from '@/domain/catalogue/types';
import { addTrim, availableTrims, canSelectTrims, removeTrim } from '@/domain/hub';
import { formatEgp } from '@/domain/money';
import { Dialog } from '@/features/shared/Dialog';
import styles from '../builder.module.css';
import type { SectionProps } from './types';

export function TrimsSection({ pack, catalogue, readOnly, onChange }: SectionProps) {
  const [picking, setPicking] = useState<Trim | null>(null);
  const hubId = pack.hubId;

  const selectedIds = new Set(pack.trims.map((trim) => trim.trimId));
  const trims = availableTrims(pack, catalogue).filter((trim) => !selectedIds.has(trim.id));

  return (
    <div className="stack-16">
      {pack.trims.length > 0 ? (
        <ul className="stack-8" aria-label="Selected trims">
          {pack.trims.map((selection) => (
            <li key={selection.trimId} className={styles.selected}>
              <span className="stack-4">
                <span className={styles.pickName}>{findTrim(catalogue, selection.trimId)?.name}</span>
                <span className="meta">{selection.colour}</span>
              </span>
              {readOnly ? null : (
                <button type="button" className="btn btn-ghost" onClick={() => onChange(removeTrim(pack, selection.trimId))}>
                  Remove
                  <span className="visually-hidden"> {findTrim(catalogue, selection.trimId)?.name}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {readOnly ? null : !canSelectTrims(pack) ? (
        <p className="meta">
          {pack.trims.length > 0
            ? 'These trims are on hold until you pick a fabric. If its hub cannot supply one, we will ask before removing it.'
            : 'Pick a fabric first. Its hub decides which trims are available.'}
        </p>
      ) : (
        <ul className={styles.pickerList} aria-label="Trims you can add">
          {trims.map((trim) => {
            const offer = hubId ? trim.offers[hubId] : undefined;
            return (
              <li key={trim.id} className={styles.pickerCard}>
                <div className="stack-4">
                  <span className={styles.pickName}>{trim.name}</span>
                  <span className="meta">{trim.colours.join(', ')}</span>
                  {offer && hubId ? (
                    <span className="meta tabular">
                      {hubName(catalogue, hubId)}: {formatEgp(offer.price)} each · {trim.quantityPerGarment} per garment · MOQ{' '}
                      {offer.moq}
                    </span>
                  ) : null}
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => setPicking(trim)}>
                  Select
                  <span className="visually-hidden"> {trim.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {picking ? (
        <TrimDialog
          trim={picking}
          onCancel={() => setPicking(null)}
          onConfirm={(colour) => {
            onChange(addTrim(pack, { trimId: picking.id, colour }));
            setPicking(null);
          }}
        />
      ) : null}
    </div>
  );
}

function TrimDialog({ trim, onCancel, onConfirm }: { trim: Trim; onCancel: () => void; onConfirm: (colour: string) => void }) {
  const [colour, setColour] = useState(trim.colours[0]);
  return (
    <Dialog
      title={trim.name}
      onClose={onCancel}
      footer={
        <button type="button" className="btn btn-primary" onClick={() => onConfirm(colour)}>
          Add trim
        </button>
      }
    >
      <fieldset className="field">
        <legend className="label">Colour</legend>
        <div className="row-8">
          {trim.colours.map((candidate) => (
            <label key={candidate} className="choice-pill">
              <input
                className="visually-hidden"
                type="radio"
                name="trim-colour"
                checked={colour === candidate}
                onChange={() => setColour(candidate)}
              />
              {candidate}
            </label>
          ))}
        </div>
      </fieldset>
    </Dialog>
  );
}
