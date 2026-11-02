'use client';

import { useCallback } from 'react';
import { loadConfirmation } from '@/application/quotes';
import { findCategory, hubName, type Catalogue } from '@/domain/catalogue/types';
import { formatEgpRange, formatQuantity } from '@/domain/money';
import { requestEstimatedTotal, type QuoteRequest } from '@/domain/quote';
import { displayName } from '@/domain/techPack';
import { MockupPicture } from '@/features/shared/MockupPicture';
import { GuardedLink } from '@/features/shared/NavigationGuard';
import { useServices } from '@/features/shared/RepositoryProvider';
import { EmptyState, LoadFailure, LoadingRegion, Skeleton } from '@/features/shared/StateViews';
import { StatusPill } from '@/features/shared/StatusPill';
import { useResource } from '@/features/shared/useResource';
import styles from './quote.module.css';

export function ConfirmationScreen({ requestId }: { requestId: string }) {
  const env = useServices();
  const resource = useResource(useCallback(() => loadConfirmation(env, requestId), [env, requestId]));

  if (resource.status === 'loading') {
    return (
      <LoadingRegion label="Loading your confirmation">
        <div className="stack-16">
          <Skeleton height={32} width="50%" />
          <Skeleton height={120} radius={16} />
          <Skeleton height={160} radius={16} />
        </div>
      </LoadingRegion>
    );
  }
  if (resource.status === 'failed') return <LoadFailure what="your confirmation" onRetry={resource.retry} />;
  if (!resource.data.request) {
    return (
      <EmptyState title="We couldn't find this request" actionHref="/orders" actionLabel="Go to My orders">
        Quote requests are stored on this device, so it may have been sent from another browser.
      </EmptyState>
    );
  }
  return <Confirmation request={resource.data.request} catalogue={resource.data.catalogue} />;
}

function Confirmation({ request, catalogue }: { request: QuoteRequest; catalogue: Catalogue }) {
  const { delivery } = request;
  const address = [delivery.street, delivery.city, delivery.governorate].filter(Boolean).join(', ');

  return (
    <div className="stack-24">
      <div className="stack-8">
        <h1 className="page-title">Your quote request is in</h1>
        <p className="row-8">
          <span className="tabular">Reference {request.reference}</span>
          <StatusPill status={request.status} />
        </p>
      </div>

      <section className="panel stack-8" aria-labelledby="sent-heading">
        <h2 id="sent-heading" className="section-title">
          What was sent
        </h2>
        <ul className="stack-16">
          {request.items.map((item) => {
            const category = findCategory(catalogue, item.pack.categoryId);
            const name = displayName(item.pack, catalogue);
            return (
              <li key={item.pack.id} className={styles.sentItem}>
                <MockupPicture
                  className={styles.thumbnail}
                  image={item.pack.mockups.front}
                  side="front"
                  category={category}
                  alt={`Front of ${name}`}
                />
                <div className="stack-4">
                  <p className={styles.productName}>{name}</p>
                  <p className="meta tabular">
                    {item.pack.reference} · {formatQuantity(item.quantity)} units
                    {item.estimate.hubId ? ` · ${hubName(catalogue, item.estimate.hubId)}` : ''}
                  </p>
                  <p className="meta tabular">
                    {formatEgpRange(item.estimate.unit)} / unit · {item.estimate.leadTimeWeeks} weeks
                  </p>
                  {item.comment ? <p className="meta">Comment: {item.comment}</p> : null}
                  <GuardedLink className="link-target" href={`/tech-packs/${item.pack.id}`}>
                    View tech pack<span className="visually-hidden"> {name}</span>
                  </GuardedLink>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel stack-4" aria-labelledby="total-heading">
        <h2 id="total-heading" className="section-title">
          Estimated total
        </h2>
        <p className={`${styles.total} tabular`}>{formatEgpRange(requestEstimatedTotal(request))}</p>
        <p className="meta">This is an estimate. The factory&apos;s quote sets the final price.</p>
      </section>

      <section className="panel stack-4" aria-labelledby="delivery-summary-heading">
        <h2 id="delivery-summary-heading" className="section-title">
          Delivery
        </h2>
        <p>{delivery.recipientName}</p>
        <p className="tabular">{delivery.mobile}</p>
        <p>{address}</p>
      </section>

      <section className="panel stack-8" aria-labelledby="next-heading">
        <h2 id="next-heading" className="section-title">
          What happens next
        </h2>
        <ol className={styles.nextSteps}>
          <li>Factories at each hub review your tech pack.</li>
          <li>You get a quote, and the status in My orders changes to Quote received.</li>
          <li>You approve it and move on to sampling.</li>
        </ol>
        <p className="meta">Your tech pack is now frozen, so what the factory prices is exactly what you sent.</p>
      </section>

      <div>
        <GuardedLink href="/orders" className="btn btn-primary">
          Go to My orders
        </GuardedLink>
      </div>
    </div>
  );
}
