'use client';

import { hubName, type Catalogue } from '@/domain/catalogue/types';
import { formatEgpRange, formatQuantity } from '@/domain/money';
import type { PriceEstimate } from '@/domain/pricing';
import type { Readiness } from '@/domain/readiness';
import { SECTION_TITLES, type SectionId, type TechPack } from '@/domain/techPack';
import { Dialog } from '@/features/shared/Dialog';
import { SECTION_STATE_PILLS } from './SectionShell';
import styles from './builder.module.css';

interface RailProps {
  pack: TechPack;
  catalogue: Catalogue;
  readiness: Readiness;
  estimate: PriceEstimate;
  readOnly: boolean;
  isLeaving: boolean;
  saveFailed: boolean;
  onQuantityChange: (quantity: number) => void;
  onGoToSection: (id: SectionId) => void;
  onRequestQuote: () => void;
}

export function Rail(props: RailProps) {
  return (
    <div className="stack-16">
      <Estimate {...props} />
      <Completeness {...props} />
      {props.readOnly ? null : <QuoteAction {...props} />}
    </div>
  );
}

function Completeness({ readiness, onGoToSection }: RailProps) {
  const percent = Math.round(readiness.progress * 100);
  const isDone = readiness.canRequestQuote;

  return (
    <section className="panel stack-8" aria-labelledby="completeness-heading">
      <h2 id="completeness-heading" className="section-title">
        Completeness
      </h2>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label="Required sections done"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={isDone ? styles.progressDone : styles.progressFill} style={{ width: `${percent}%` }} />
      </div>
      <ul className={styles.railSections}>
        {readiness.sections.map((section) => {
          const pill = SECTION_STATE_PILLS[section.state];
          return (
            <li key={section.id}>
              <button type="button" className={styles.railRow} onClick={() => onGoToSection(section.id)}>
                <span>{SECTION_TITLES[section.id]}</span>
                <span className={`pill ${pill.className}`}>{pill.label}</span>
              </button>
              {section.messages.length > 0 ? (
                <ul className={styles.railMessages}>
                  {section.messages.map((message) => (
                    <li key={message.text} className={message.severity === 'block' ? styles.railBlocker : 'meta'}>
                      {message.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Estimate({ pack, catalogue, estimate, readOnly, onQuantityChange }: RailProps) {
  const { min, max, step } = catalogue.pricing.quantity;

  return (
    <section className="panel stack-8" aria-labelledby="estimate-heading">
      <h2 id="estimate-heading" className="section-title">
        Price estimate
      </h2>

      <label className="field">
        <span className={styles.quantityLabel}>
          <span className="label">Quantity</span>
          <span className="tabular">{formatQuantity(estimate.quantity)} units</span>
        </span>
        <input
          className={styles.slider}
          type="range"
          min={min}
          max={max}
          step={step}
          value={estimate.quantity}
          disabled={readOnly}
          aria-valuetext={`${formatQuantity(estimate.quantity)} units`}
          onChange={(event) => onQuantityChange(Number(event.target.value))}
        />
      </label>

      <dl className={styles.figures}>
        <div>
          <dt className="meta">Unit price</dt>
          <dd className={`${styles.unitPrice} tabular`}>{formatEgpRange(estimate.unit)} / unit</dd>
        </div>
        <div>
          <dt className="meta">Total</dt>
          <dd className="tabular">{formatEgpRange(estimate.total)}</dd>
        </div>
        <div>
          <dt className="meta">Lead time</dt>
          <dd className="tabular">
            {estimate.isComplete ? '' : 'About '}
            {estimate.leadTimeWeeks} weeks
          </dd>
        </div>
        <div>
          <dt className="meta">Hub</dt>
          <dd>{pack.hubId ? hubName(catalogue, pack.hubId) : 'Not set yet'}</dd>
        </div>
      </dl>

      <p className="meta">
        {pack.hubId
          ? 'Your first fabric fixed the hub, so only its fabrics and trims show. Remove every fabric to choose again.'
          : 'Your first fabric will fix the hub.'}
      </p>

      <p className="notice">
        {estimate.moq.reason}
        {estimate.isBelowMoq ? ` ${formatQuantity(estimate.quantity)} units is below it, so raise the quantity before you order.` : ''}
      </p>

      {estimate.assumptions.length > 0 ? (
        <div className="stack-4">
          <h3 className="label">What this estimate assumes</h3>
          <ul className={`${styles.assumptions} meta`}>
            {estimate.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function QuoteAction({ readiness, isLeaving, saveFailed, onRequestQuote }: RailProps) {
  const reason = readiness.blockers.map((blocker) => blocker.text).join(' ');
  return (
    <div className={`stack-8 ${styles.quoteAction}`}>
      {saveFailed ? (
        <p className="notice" role="alert">
          Your last change isn&apos;t saved yet, so the quote can&apos;t start. Request it again to retry.
        </p>
      ) : null}
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!readiness.canRequestQuote || isLeaving}
        aria-describedby={reason ? 'quote-blockers' : undefined}
        onClick={onRequestQuote}
      >
        Request a quote
      </button>
      {reason ? (
        <p id="quote-blockers" className="meta">
          To request a quote: {reason}
        </p>
      ) : null}
      {isLeaving ? <p className="meta">Saving your latest changes.</p> : null}
    </div>
  );
}

interface MobileSummaryProps extends RailProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/** Below 768px the rail collapses to this bar, which opens the same content as a sheet. */
export function MobileSummary({ isOpen, onOpenChange, ...railProps }: MobileSummaryProps) {
  const { readiness, estimate } = railProps;
  const done = readiness.sections.filter((section) => section.state === 'complete').length;

  return (
    <>
      <button type="button" className={styles.summaryBar} aria-haspopup="dialog" onClick={() => onOpenChange(true)}>
        <span className="stack-4">
          <span className="meta">{done} of {readiness.sections.length} sections complete</span>
          <span className={`${styles.summaryPrice} tabular`}>{formatEgpRange(estimate.unit)} / unit</span>
        </span>
        <span className={styles.summaryOpen}>Summary</span>
      </button>
      {isOpen ? (
        <Dialog title="Summary" variant="sheet" onClose={() => onOpenChange(false)}>
          <Rail {...railProps} />
        </Dialog>
      ) : null}
    </>
  );
}
