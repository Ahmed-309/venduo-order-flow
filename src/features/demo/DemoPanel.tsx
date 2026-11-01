'use client';

import { useState } from 'react';
import { Dialog } from '@/features/shared/Dialog';
import {
  loadFixture,
  readFaultSettings,
  writeFaultSettings,
  type FaultSettings,
  type FixtureName,
} from '@/infrastructure/container';

const FIXTURES: { name: FixtureName; label: string }[] = [
  { name: 'empty', label: 'Empty' },
  { name: 'partial', label: 'Partial' },
  { name: 'populated', label: 'Populated' },
];

/**
 * For reviewers: shows every state on demand (brief 8.4). Settings change how the repository
 * behaves; no screen knows this panel exists.
 */
export function DemoPanel({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<FaultSettings>(readFaultSettings);
  const [isLoadingFixture, setIsLoadingFixture] = useState(false);

  function update(change: Partial<FaultSettings>) {
    const next = { ...settings, ...change };
    setSettings(next);
    writeFaultSettings(next);
  }

  async function applyFixture(name: FixtureName) {
    setIsLoadingFixture(true);
    await loadFixture(name);
    // A full page load, because mounted screens are still holding the data just replaced.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/orders');
  }

  return (
    <Dialog
      title="Demo states"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload this screen
        </button>
      }
    >
      <div className="stack-16">
        <p className="meta">Replace your local data, or make storage slow or failing, to see every state.</p>

        <fieldset className="field">
          <legend className="label">Data (replaces everything saved here)</legend>
          <div className="row-8">
            {FIXTURES.map(({ name, label }) => (
              <button
                key={name}
                type="button"
                className="btn btn-secondary"
                disabled={isLoadingFixture}
                onClick={() => void applyFixture(name)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span className="label">Storage speed</span>
          <select
            className="input"
            value={settings.delayMs}
            onChange={(event) => update({ delayMs: Number(event.target.value) })}
          >
            <option value={0}>Normal</option>
            <option value={1500}>Slow, 1.5 seconds</option>
            <option value={5000}>Very slow, 5 seconds</option>
          </select>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.failReads}
            onChange={(event) => update({ failReads: event.target.checked })}
          />
          <span>Loading fails</span>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.failWrites}
            onChange={(event) => update({ failWrites: event.target.checked })}
          />
          <span>Saving fails</span>
        </label>

        <label className="field">
          <span className="label">Sending a quote request</span>
          <select
            className="input"
            value={settings.submission}
            onChange={(event) => update({ submission: event.target.value as FaultSettings['submission'] })}
          >
            <option value="normal">Works</option>
            <option value="reject">Fails, nothing is sent</option>
            <option value="lost_response">Sends, but the response is lost</option>
          </select>
        </label>
      </div>
    </Dialog>
  );
}
