'use client';

import { useState } from 'react';
import { findFabric, findTrim, hubName, type Fabric, type HubId, type Placement } from '@/domain/catalogue/types';
import { addFabric, availableFabrics, findIncompatibleTrims, freePlacements, removeFabric } from '@/domain/hub';
import { formatEgp } from '@/domain/money';
import { isValidPantone, type ColourChoice, type FabricSelection, type TrimSelection } from '@/domain/techPack';
import { Dialog } from '@/features/shared/Dialog';
import styles from '../builder.module.css';
import type { SectionProps } from './types';

const PLACEMENT_LABELS: Record<Placement, string> = {
  body: 'Body',
  sleeves: 'Sleeves',
  collar: 'Collar',
  lining: 'Lining',
};

const describeColour = (colour: ColourChoice) =>
  colour.kind === 'stock' ? colour.name : `Custom colour, Pantone ${colour.pantone}`;

interface PendingHubMove {
  selection: FabricSelection;
  hubId: HubId;
  trims: TrimSelection[];
}

export function FabricsSection({ pack, catalogue, category, readOnly, onChange }: SectionProps) {
  const [picking, setPicking] = useState<Fabric | null>(null);
  const [hubMove, setHubMove] = useState<PendingHubMove | null>(null);

  const placements = freePlacements(pack, category.placements.map((candidate) => candidate.placement));
  const fabrics = availableFabrics(pack, catalogue);
  const hubLabel = pack.hubId ? hubName(catalogue, pack.hubId) : null;

  function choose(selection: FabricSelection, hubId: HubId) {
    setPicking(null);
    const trims = findIncompatibleTrims(pack, hubId, catalogue);
    if (trims.length > 0) setHubMove({ selection, hubId, trims });
    else onChange(addFabric(pack, selection, hubId, catalogue));
  }

  return (
    <div className="stack-16">
      <p className="meta">A tech pack needs at least one body fabric.</p>

      {pack.fabrics.length > 0 ? (
        <ul className="stack-8" aria-label="Selected fabrics">
          {pack.fabrics.map((selection) => (
            <li key={selection.placement} className={styles.selected}>
              <span className="stack-4">
                <span className={styles.pickName}>
                  {PLACEMENT_LABELS[selection.placement]}: {findFabric(catalogue, selection.fabricId)?.name}
                </span>
                <span className="meta">{describeColour(selection.colour)}</span>
              </span>
              {readOnly ? null : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onChange(removeFabric(pack, selection.placement))}
                >
                  Remove
                  <span className="visually-hidden"> {PLACEMENT_LABELS[selection.placement]} fabric</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {hubLabel ? (
        <p className="meta">
          Showing {hubLabel} fabrics only, because your first fabric fixed the hub.
          {readOnly ? '' : ' Remove every fabric to choose from both hubs again.'}
        </p>
      ) : null}

      {readOnly ? null : (
        <>
          {placements.length === 0 ? <p className="meta">Every placement has a fabric. Remove one to change it.</p> : null}
          <ul className={styles.pickerList} aria-label="Fabrics you can add">
            {fabrics.map((fabric) => (
              <li key={fabric.id} className={styles.pickerCard}>
                <div className="stack-4">
                  <span className={styles.pickName}>{fabric.name}</span>
                  <span className="meta">
                    {fabric.gsm} GSM · {fabric.composition}
                  </span>
                  <span className="meta">{fabric.colours.join(', ')}</span>
                  {catalogue.hubs.map((hub) => {
                    const offer = fabric.offers[hub.id];
                    if (!offer || (pack.hubId && pack.hubId !== hub.id)) return null;
                    return (
                      <span key={hub.id} className="meta tabular">
                        {hub.name}: {formatEgp(offer.pricePerKg)} / kg · MOQ {offer.moq}
                      </span>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={placements.length === 0}
                  onClick={() => setPicking(fabric)}
                >
                  Select
                  <span className="visually-hidden"> {fabric.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {picking ? (
        <FabricDialog
          fabric={picking}
          lockedHubId={pack.hubId}
          placements={placements}
          catalogueHubs={catalogue.hubs}
          customColourNote={`A custom colour raises the MOQ to ${catalogue.pricing.customColour.moq} and adds ${catalogue.pricing.customColour.extraLeadWeeks} weeks to the lead time.`}
          onCancel={() => setPicking(null)}
          onConfirm={choose}
        />
      ) : null}

      {hubMove ? (
        <Dialog
          title={`Move to ${hubName(catalogue, hubMove.hubId)}?`}
          onClose={() => setHubMove(null)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setHubMove(null)}>
                Keep my trims
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onChange(addFabric(pack, hubMove.selection, hubMove.hubId, catalogue));
                  setHubMove(null);
                }}
              >
                Remove trims and continue
              </button>
            </>
          }
        >
          <div className="stack-8">
            <p>{hubName(catalogue, hubMove.hubId)} cannot supply these trims, so they will be removed:</p>
            <ul className="stack-4">
              {hubMove.trims.map((trim) => (
                <li key={trim.trimId} className={styles.pickName}>
                  {findTrim(catalogue, trim.trimId)?.name}
                </li>
              ))}
            </ul>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

interface FabricDialogProps {
  fabric: Fabric;
  lockedHubId: HubId | null;
  placements: Placement[];
  catalogueHubs: { id: HubId; name: string }[];
  customColourNote: string;
  onCancel: () => void;
  onConfirm: (selection: FabricSelection, hubId: HubId) => void;
}

const CUSTOM = '__custom__';

function FabricDialog({ fabric, lockedHubId, placements, catalogueHubs, customColourNote, onCancel, onConfirm }: FabricDialogProps) {
  const hubs = catalogueHubs.filter((hub) => fabric.offers[hub.id] && (!lockedHubId || lockedHubId === hub.id));
  const [hubId, setHubId] = useState(hubs[0].id);
  const [placement, setPlacement] = useState<Placement>(placements[0]);
  const [colourName, setColourName] = useState(fabric.colours[0]);
  const [pantone, setPantone] = useState('');

  const isCustom = colourName === CUSTOM;
  const pantoneProblem = isCustom && !isValidPantone(pantone) ? 'Use a Pantone code, for example 19-4052 TCX.' : null;

  function confirm() {
    if (pantoneProblem) return;
    const colour: ColourChoice = isCustom ? { kind: 'custom', pantone: pantone.trim() } : { kind: 'stock', name: colourName };
    onConfirm({ fabricId: fabric.id, placement, colour }, hubId);
  }

  return (
    <Dialog
      title={fabric.name}
      onClose={onCancel}
      footer={
        <>
          {pantoneProblem ? <p className="meta">Add a valid Pantone code to continue.</p> : null}
          <button type="button" className="btn btn-primary" disabled={pantoneProblem !== null} onClick={confirm}>
            Add fabric
          </button>
        </>
      }
    >
      <div className="stack-16">
        {hubs.length > 1 ? (
          <fieldset className="field">
            <legend className="label">Hub</legend>
            <div className="row-8">
              {hubs.map((hub) => (
                <label key={hub.id} className="choice-pill">
                  <input
                    className="visually-hidden"
                    type="radio"
                    name="fabric-hub"
                    checked={hubId === hub.id}
                    onChange={() => setHubId(hub.id)}
                  />
                  {hub.name}
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="meta">Made in {hubs[0].name}.</p>
        )}

        <label className="field">
          <span className="label">Placement</span>
          <select className="input" value={placement} onChange={(event) => setPlacement(event.target.value as Placement)}>
            {placements.map((candidate) => (
              <option key={candidate} value={candidate}>
                {PLACEMENT_LABELS[candidate]}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="field">
          <legend className="label">Colour</legend>
          <div className="row-8">
            {[...fabric.colours, CUSTOM].map((colour) => (
              <label key={colour} className="choice-pill">
                <input
                  className="visually-hidden"
                  type="radio"
                  name="fabric-colour"
                  checked={colourName === colour}
                  onChange={() => setColourName(colour)}
                />
                {colour === CUSTOM ? 'Custom Pantone' : colour}
              </label>
            ))}
          </div>
        </fieldset>

        {isCustom ? (
          <label className="field">
            <span className="label">Pantone code</span>
            <input
              className="input"
              value={pantone}
              placeholder="19-4052 TCX"
              aria-invalid={pantone !== '' && pantoneProblem !== null}
              onChange={(event) => setPantone(event.target.value)}
            />
            {pantone !== '' && pantoneProblem ? <span className="field-error">{pantoneProblem}</span> : null}
            <span className="notice">{customColourNote}</span>
          </label>
        ) : null}
      </div>
    </Dialog>
  );
}
