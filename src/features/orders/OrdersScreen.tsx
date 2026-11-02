'use client';

import { useCallback } from 'react';
import { loadOrders, type OrdersData } from '@/application/techPacks';
import { findCategory, type Catalogue } from '@/domain/catalogue/types';
import { formatEgpRange, formatQuantity } from '@/domain/money';
import { estimatePrice } from '@/domain/pricing';
import { requestEstimatedTotal, type QuoteRequest } from '@/domain/quote';
import { evaluateReadiness } from '@/domain/readiness';
import { displayName, type TechPack } from '@/domain/techPack';
import { MockupPicture } from '@/features/shared/MockupPicture';
import { GuardedLink } from '@/features/shared/NavigationGuard';
import { useServices } from '@/features/shared/RepositoryProvider';
import { EmptyState, LoadFailure, LoadingRegion, Skeleton } from '@/features/shared/StateViews';
import { StatusPill } from '@/features/shared/StatusPill';
import { useResource } from '@/features/shared/useResource';
import styles from './orders.module.css';

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function OrdersScreen() {
  const env = useServices();
  const resource = useResource(useCallback(() => loadOrders(env), [env]));

  return (
    <div className="stack-24">
      <div className="page-head">
        <h1 className="page-title">My orders</h1>
        {resource.status === 'ready' && resource.data.entries.length > 0 ? (
          <GuardedLink className="btn btn-primary" href="/">
            New tech pack
          </GuardedLink>
        ) : null}
      </div>
      {resource.status === 'loading' ? <OrdersSkeleton /> : null}
      {resource.status === 'failed' ? <LoadFailure what="your tech packs" onRetry={resource.retry} /> : null}
      {resource.status === 'ready' ? <OrdersList data={resource.data} /> : null}
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <LoadingRegion label="Loading your tech packs">
      <div className={`panel ${styles.list}`}>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={styles.skeletonRow}>
            <Skeleton height={64} width={48} />
            <div className="stack-8">
              <Skeleton height={16} width="50%" />
              <Skeleton height={14} width="70%" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

function OrdersList({ data }: { data: OrdersData }) {
  const { catalogue, entries } = data;
  if (entries.length === 0) {
    return (
      <EmptyState title="No tech packs yet" actionHref="/" actionLabel="Choose a style">
        Start with a garment and we will price it as you go.
      </EmptyState>
    );
  }

  return (
    <ul className={`panel ${styles.list}`} aria-label="Tech packs and quote requests">
      {entries.map((entry) =>
        entry.kind === 'draft' ? (
          <DraftRow key={entry.pack.id} pack={entry.pack} catalogue={catalogue} />
        ) : (
          <RequestRow key={entry.request.id} request={entry.request} catalogue={catalogue} />
        ),
      )}
    </ul>
  );
}

function DraftRow({ pack, catalogue }: { pack: TechPack; catalogue: Catalogue }) {
  const category = findCategory(catalogue, pack.categoryId);
  const name = displayName(pack, catalogue);
  const { blockers, canRequestQuote } = evaluateReadiness(pack, catalogue);
  const estimate = estimatePrice(pack, pack.estimateQuantity, catalogue);

  const next = canRequestQuote ? 'Ready to request a quote.' : `Next: ${blockers[0].text}`;

  return (
    <li>
      <GuardedLink className={styles.row} href={`/tech-packs/${pack.id}`}>
        <MockupPicture
          className={styles.thumbnail}
          image={pack.mockups.front}
          side="front"
          category={category}
          alt={`Front of ${name}`}
        />
        <span className={styles.rowMain}>
          <span className={styles.rowTitle}>{name}</span>
          <span className="meta">
            <span className="tabular">{pack.reference}</span> · {category.name}
          </span>
          <span className="meta">{next}</span>
        </span>
        <span className={styles.rowEnd}>
          <StatusPill status={pack.status} />
          <span className="meta tabular">{formatEgpRange(estimate.unit)} / unit</span>
        </span>
      </GuardedLink>
    </li>
  );
}

function RequestRow({ request, catalogue }: { request: QuoteRequest; catalogue: Catalogue }) {
  const names = request.items.map((item) => displayName(item.pack, catalogue)).join(', ');
  const quantity = request.items.reduce((sum, item) => sum + item.quantity, 0);
  const first = request.items[0].pack;

  return (
    <li>
      <GuardedLink className={styles.row} href={`/quote/confirmation/${request.id}`}>
        <MockupPicture
          className={styles.thumbnail}
          image={first.mockups.front}
          side="front"
          category={findCategory(catalogue, first.categoryId)}
          alt={`Front of ${displayName(first, catalogue)}`}
        />
        <span className={styles.rowMain}>
          <span className={`${styles.rowTitle} tabular`}>{request.reference}</span>
          <span className="meta">{names}</span>
          <span className="meta tabular">
            {formatQuantity(quantity)} units · sent {dateFormat.format(new Date(request.submittedAt))}
          </span>
        </span>
        <span className={styles.rowEnd}>
          <StatusPill status={request.status} />
          <span className="meta tabular">{formatEgpRange(requestEstimatedTotal(request))}</span>
        </span>
      </GuardedLink>
    </li>
  );
}
