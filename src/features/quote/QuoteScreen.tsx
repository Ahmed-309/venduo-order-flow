'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { loadQuoteWizard, saveQuoteDraft, stashQuoteDraft, submitQuote, togglePack, type QuoteWizardData } from '@/application/quotes';
import { findCategory } from '@/domain/catalogue/types';
import { formatEgpRange } from '@/domain/money';
import { effectiveMoq } from '@/domain/moq';
import { estimatePrice } from '@/domain/pricing';
import {
  packIneligibilityReason,
  validateDelivery,
  validateQuantity,
  type DeliveryDetails,
  type DeliveryField,
  type QuoteDraft,
  type QuoteStep,
} from '@/domain/quote';
import { displayName, type TechPack } from '@/domain/techPack';
import { MockupPicture } from '@/features/shared/MockupPicture';
import { useNavigationGuard } from '@/features/shared/NavigationGuard';
import { useServices } from '@/features/shared/RepositoryProvider';
import { SaveIndicator } from '@/features/shared/SaveIndicator';
import { EmptyState, LoadFailure, LoadingRegion, Skeleton } from '@/features/shared/StateViews';
import { useAutosave } from '@/features/shared/useAutosave';
import { useResource } from '@/features/shared/useResource';
import styles from './quote.module.css';

const STEPS: { id: QuoteStep; label: string }[] = [
  { id: 'products', label: 'Products' },
  { id: 'details', label: 'Details' },
  { id: 'delivery', label: 'Delivery' },
];

export function QuoteScreen({ preselectPackId }: { preselectPackId: string | null }) {
  const env = useServices();
  const resource = useResource(useCallback(() => loadQuoteWizard(env, preselectPackId), [env, preselectPackId]));

  return (
    <div className="stack-24">
      <h1 className="page-title">Request a quote</h1>
      {resource.status === 'loading' ? (
        <LoadingRegion label="Loading your quote request">
          <div className="stack-16">
            <Skeleton height={44} />
            <Skeleton height={96} radius={16} />
            <Skeleton height={96} radius={16} />
          </div>
        </LoadingRegion>
      ) : null}
      {resource.status === 'failed' ? <LoadFailure what="your quote request" onRetry={resource.retry} /> : null}
      {resource.status === 'ready' ? <Wizard data={resource.data} /> : null}
    </div>
  );
}

function Wizard({ data }: { data: QuoteWizardData }) {
  const { catalogue, packs } = data;
  const env = useServices();
  const router = useRouter();
  const [draft, setDraft] = useState(data.draft);
  const [isSending, setIsSending] = useState(false);
  const [sendErrors, setSendErrors] = useState<string[]>([]);
  const [sendFailed, setSendFailed] = useState(false);

  const autosave = useAutosave<QuoteDraft>(
    (next) => saveQuoteDraft(env, next),
    (next) => stashQuoteDraft(env, next),
  );
  useNavigationGuard(autosave.flush);

  // ?pack= has done its job once the draft holds the selection. Left in the URL, a reload
  // would tick the pack again even after the brand has unticked it.
  useEffect(() => {
    window.history.replaceState(null, '', '/quote');
  }, []);

  function change(next: QuoteDraft, options: { debounce?: boolean } = {}) {
    setDraft(next);
    autosave.push(next, { debounce: options.debounce ?? false });
  }

  async function send() {
    setIsSending(true);
    setSendErrors([]);
    setSendFailed(false);
    try {
      // The draft, with its submission id, must be stored before anything goes out.
      if (await autosave.flush()) {
        const result = await submitQuote(env, draft);
        if (result.kind === 'submitted') {
          router.push(`/quote/confirmation/${result.request.id}`);
          return; // Stay in the sending state until the next screen takes over.
        }
        setSendErrors(result.errors);
      } else {
        setSendFailed(true);
      }
    } catch {
      setSendFailed(true);
    }
    setIsSending(false);
  }

  if (packs.length === 0) {
    return (
      <EmptyState title="Nothing to quote yet" actionHref="/" actionLabel="Choose a style">
        Build a complete tech pack, then come back to send it to a factory.
      </EmptyState>
    );
  }

  const selectedPacks = draft.selectedPackIds.flatMap((id) => packs.filter((pack) => pack.id === id));
  const stepIndex = STEPS.findIndex((step) => step.id === draft.step);

  const quantityProblems = selectedPacks.filter(
    (pack) => validateQuantity(draft.items[pack.id]?.quantity ?? null, effectiveMoq(pack, catalogue).value, catalogue) !== null,
  );
  const deliveryErrors = validateDelivery(draft.delivery);

  let blocked: string | null = null;
  if (draft.step === 'products' && selectedPacks.length === 0) blocked = 'Tick at least one complete tech pack to continue.';
  if (draft.step === 'details' && quantityProblems.length > 0) blocked = 'Give every product a quantity at or above its minimum.';
  if (draft.step === 'delivery' && Object.keys(deliveryErrors).length > 0) blocked = 'Fill in the required delivery details to send.';
  if (isSending) blocked = 'Sending your request.';

  const goTo = (step: QuoteStep) => change({ ...draft, step });

  return (
    <div className="stack-16">
      <ol className={styles.stepper} aria-label="Steps">
        {STEPS.map((step, index) => (
          <li key={step.id} className={styles.step} aria-current={step.id === draft.step ? 'step' : undefined}>
            <span className={`${styles.stepNumber} tabular`}>{index + 1}</span>
            {step.label}
          </li>
        ))}
      </ol>

      <SaveIndicator status={autosave.status} onRetry={() => void autosave.flush()} />

      {draft.step === 'products' ? (
        <ProductsStep draft={draft} data={data} onChange={change} />
      ) : null}
      {draft.step === 'details' ? (
        <DetailsStep draft={draft} data={data} packs={selectedPacks} onChange={change} />
      ) : null}
      {draft.step === 'delivery' ? (
        <DeliveryStep
          draft={draft}
          governorates={catalogue.governorates}
          errors={deliveryErrors}
          disabled={isSending}
          onChange={change}
        />
      ) : null}

      {sendFailed ? (
        <p className="notice" role="alert">
          We couldn&apos;t confirm your request was sent. Your details are safe. Send it again and you will not get a duplicate.
        </p>
      ) : null}
      {sendErrors.length > 0 ? (
        <div className="notice" role="alert">
          <p>This request needs a change before it can go:</p>
          <ul>
            {sendErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.actions}>
        {stepIndex > 0 ? (
          <button type="button" className="btn btn-secondary" disabled={isSending} onClick={() => goTo(STEPS[stepIndex - 1].id)}>
            Back
          </button>
        ) : null}
        {draft.step === 'delivery' ? (
          <button type="button" className="btn btn-primary" disabled={blocked !== null} aria-describedby={blocked ? 'step-blocked' : undefined} onClick={() => void send()}>
            {sendFailed ? 'Send again' : 'Send quote request'}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={blocked !== null} aria-describedby={blocked ? 'step-blocked' : undefined} onClick={() => goTo(STEPS[stepIndex + 1].id)}>
            Continue
          </button>
        )}
        {blocked ? (
          <p id="step-blocked" className="meta">
            {blocked}
          </p>
        ) : null}
      </div>
    </div>
  );
}

interface StepProps {
  draft: QuoteDraft;
  data: QuoteWizardData;
  onChange: (next: QuoteDraft, options?: { debounce?: boolean }) => void;
}

function PackThumb({ pack, data }: { pack: TechPack; data: QuoteWizardData }) {
  return (
    <MockupPicture
      className={styles.thumbnail}
      image={pack.mockups.front}
      side="front"
      category={findCategory(data.catalogue, pack.categoryId)}
      alt=""
    />
  );
}

function ProductsStep({ draft, data, onChange }: StepProps) {
  const { catalogue, packs } = data;
  return (
    <fieldset className="stack-8">
      <legend className="section-title">Which tech packs should go out for a quote?</legend>
      {packs.map((pack) => {
        const reason = packIneligibilityReason(pack, catalogue);
        const name = displayName(pack, catalogue);
        return (
          <label key={pack.id} className={`panel ${styles.productRow} ${reason ? styles.productDisabled : ''}`}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={draft.selectedPackIds.includes(pack.id)}
              disabled={reason !== null}
              onChange={() => onChange(togglePack(draft, pack, catalogue))}
            />
            <PackThumb pack={pack} data={data} />
            <span className="stack-4">
              <span className={styles.productName}>{name}</span>
              <span className="meta tabular">
                {pack.reference} · {findCategory(catalogue, pack.categoryId).name}
              </span>
              {reason ? <span className="meta">Not ready yet. {reason}</span> : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function DetailsStep({ draft, data, packs, onChange }: StepProps & { packs: TechPack[] }) {
  const { catalogue } = data;
  return (
    <div className="stack-16">
      <h2 className="section-title">How many of each?</h2>
      {packs.map((pack) => {
        const item = draft.items[pack.id] ?? { quantity: null, comment: '' };
        const moq = effectiveMoq(pack, catalogue);
        const error = validateQuantity(item.quantity, moq.value, catalogue);
        const estimate = estimatePrice(pack, item.quantity && item.quantity > 0 ? item.quantity : moq.value, catalogue);
        const name = displayName(pack, catalogue);
        const setItem = (change: Partial<typeof item>) =>
          onChange({ ...draft, items: { ...draft.items, [pack.id]: { ...item, ...change } } }, { debounce: true });

        return (
          <section key={pack.id} className={`panel ${styles.detailCard}`} aria-label={name}>
            <div className="stack-16">
              <div className={styles.detailHead}>
                <PackThumb pack={pack} data={data} />
                <span className="stack-4">
                  <span className={styles.productName}>{name}</span>
                  <span className="meta tabular">{pack.reference}</span>
                </span>
              </div>
              <label className="field">
                <span className="label">Quantity</span>
                <input
                  className="input tabular"
                  type="number"
                  inputMode="numeric"
                  min={moq.value}
                  value={item.quantity ?? ''}
                  aria-invalid={error !== null}
                  aria-describedby={`moq-${pack.id}`}
                  onChange={(event) => setItem({ quantity: event.target.value === '' ? null : Number(event.target.value) })}
                />
                {error ? <span className="field-error">{error}</span> : null}
                <span id={`moq-${pack.id}`} className="meta">
                  {moq.reason}
                </span>
              </label>
              <label className="field">
                <span className="label">Comment for the factory (optional)</span>
                <textarea
                  className="input"
                  value={item.comment}
                  onChange={(event) => setItem({ comment: event.target.value })}
                />
              </label>
            </div>
            <dl className={styles.liveEstimate}>
              <div>
                <dt className="meta">Unit price</dt>
                <dd className="tabular">{formatEgpRange(estimate.unit)} / unit</dd>
              </div>
              <div>
                <dt className="meta">Total</dt>
                <dd className="tabular">{formatEgpRange(estimate.total)}</dd>
              </div>
              <div>
                <dt className="meta">Lead time</dt>
                <dd className="tabular">{estimate.leadTimeWeeks} weeks</dd>
              </div>
            </dl>
          </section>
        );
      })}
    </div>
  );
}

interface DeliveryStepProps {
  draft: QuoteDraft;
  governorates: string[];
  errors: ReturnType<typeof validateDelivery>;
  disabled: boolean;
  onChange: StepProps['onChange'];
}

function DeliveryStep({ draft, governorates, errors, disabled, onChange }: DeliveryStepProps) {
  const [touched, setTouched] = useState<Partial<Record<DeliveryField, boolean>>>({});
  const { delivery } = draft;

  const set = (change: Partial<DeliveryDetails>, debounce = true) =>
    onChange({ ...draft, delivery: { ...delivery, ...change } }, { debounce });
  const errorFor = (field: DeliveryField) => (touched[field] ? errors[field] : undefined);
  const touch = (field: DeliveryField) => () => setTouched((current) => ({ ...current, [field]: true }));

  function field(name: DeliveryField, label: string, input: Record<string, unknown> = {}) {
    const error = errorFor(name);
    return (
      <label className="field">
        <span className="label">{label}</span>
        <input
          className="input"
          value={delivery[name]}
          disabled={disabled}
          required
          aria-invalid={error !== undefined}
          onBlur={touch(name)}
          onChange={(event) => set({ [name]: event.target.value })}
          {...input}
        />
        {error ? <span className="field-error">{error}</span> : null}
      </label>
    );
  }

  return (
    <section className="panel stack-16" aria-labelledby="delivery-heading">
      <h2 id="delivery-heading" className="section-title">
        Where should the factory reach you?
      </h2>
      {field('recipientName', 'Recipient name', { autoComplete: 'name' })}
      {field('mobile', 'Egyptian mobile number', { type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '01012345678' })}
      <label className="field">
        <span className="label">Governorate</span>
        <select
          className="input"
          value={delivery.governorate}
          disabled={disabled}
          required
          aria-invalid={errorFor('governorate') !== undefined}
          onBlur={touch('governorate')}
          onChange={(event) => set({ governorate: event.target.value }, false)}
        >
          <option value="">Pick a governorate</option>
          {governorates.map((governorate) => (
            <option key={governorate} value={governorate}>
              {governorate}
            </option>
          ))}
        </select>
        {errorFor('governorate') ? <span className="field-error">{errorFor('governorate')}</span> : null}
      </label>
      {field('city', 'City', { autoComplete: 'address-level2' })}
      <label className="field">
        <span className="label">Street address (optional)</span>
        <input
          className="input"
          value={delivery.street}
          disabled={disabled}
          autoComplete="street-address"
          onChange={(event) => set({ street: event.target.value })}
        />
      </label>
    </section>
  );
}
