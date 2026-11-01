'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { createDraft, loadOrders } from '@/application/techPacks';
import type { Catalogue, Category } from '@/domain/catalogue/types';
import { GuardedLink } from '@/features/shared/NavigationGuard';
import { useServices } from '@/features/shared/RepositoryProvider';
import { EmptyState, LoadFailure, LoadingRegion, Skeleton } from '@/features/shared/StateViews';
import { useResource } from '@/features/shared/useResource';
import styles from './styles.module.css';

export function StyleScreen() {
  const env = useServices();
  const resource = useResource(useCallback(() => loadOrders(env), [env]));

  return (
    <div className="stack-24">
      <div className="stack-4">
        <h1 className="page-title">Choose a style</h1>
        <p className="meta">Pick a garment to start its tech pack. You can leave and come back at any time.</p>
      </div>
      {resource.status === 'loading' ? <StyleSkeleton /> : null}
      {resource.status === 'failed' ? <LoadFailure what="the styles" onRetry={resource.retry} /> : null}
      {resource.status === 'ready' ? (
        <StyleGrid
          catalogue={resource.data.catalogue}
          draftCount={resource.data.packs.filter((pack) => pack.status === 'draft').length}
        />
      ) : null}
    </div>
  );
}

function StyleSkeleton() {
  return (
    <LoadingRegion label="Loading styles">
      <div className={styles.grid}>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} height={204} radius={16} />
        ))}
      </div>
    </LoadingRegion>
  );
}

function StyleGrid({ catalogue, draftCount }: { catalogue: Catalogue; draftCount: number }) {
  const env = useServices();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [hasFailed, setHasFailed] = useState(false);

  async function pick(category: Category) {
    setPendingId(category.id);
    setHasFailed(false);
    try {
      const pack = await createDraft(env, catalogue, category.id);
      router.push(`/tech-packs/${pack.id}`);
    } catch {
      setPendingId(null);
      setHasFailed(true);
    }
  }

  if (catalogue.categories.length === 0) {
    return (
      <EmptyState title="No styles yet" actionHref="/orders" actionLabel="Go to My orders">
        The catalogue has no garments to choose from at the moment.
      </EmptyState>
    );
  }

  return (
    <div className="stack-24">
      {draftCount > 0 ? (
        <p className="meta">
          You have {draftCount} {draftCount === 1 ? 'draft' : 'drafts'} in progress.{' '}
          <GuardedLink href="/orders">Continue in My orders</GuardedLink>
        </p>
      ) : null}
      {hasFailed ? (
        <p className="notice" role="alert">
          We couldn&apos;t start your tech pack. Pick the style again to retry.
        </p>
      ) : null}
      {catalogue.families.map((family) => (
        <section key={family.id} className="stack-8" aria-labelledby={`family-${family.id}`}>
          <h2 id={`family-${family.id}`} className="section-title">
            {family.name}
          </h2>
          <div className={styles.grid}>
            {catalogue.categories
              .filter((category) => category.familyId === family.id)
              .map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={styles.tile}
                  disabled={category.availability !== 'available' || pendingId !== null}
                  onClick={() => void pick(category)}
                >
                  <img className={styles.sketch} src={category.sketches.front} alt="" />
                  <span className={styles.tileName}>{category.name}</span>
                  {category.availability === 'coming_soon' ? <span className="meta">Coming soon</span> : null}
                  {pendingId === category.id ? <span className="meta">Creating your draft</span> : null}
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
