'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { loadBuilder, saveTechPack } from '@/application/techPacks';
import { findCategory, type Catalogue } from '@/domain/catalogue/types';
import { estimatePrice } from '@/domain/pricing';
import { evaluateReadiness } from '@/domain/readiness';
import { clearSection, displayName, isFrozen, SECTION_IDS, SECTION_TITLES, type SectionId, type TechPack } from '@/domain/techPack';
import { useNavigationGuard } from '@/features/shared/NavigationGuard';
import { useServices } from '@/features/shared/RepositoryProvider';
import { SaveIndicator } from '@/features/shared/SaveIndicator';
import { EmptyState, LoadFailure, LoadingRegion, Skeleton } from '@/features/shared/StateViews';
import { useAutosave } from '@/features/shared/useAutosave';
import { useResource } from '@/features/shared/useResource';
import { Rail, MobileSummary } from './Rail';
import { DetailsSection } from './sections/DetailsSection';
import { FabricsSection } from './sections/FabricsSection';
import { MeasurementsSection } from './sections/MeasurementsSection';
import { MockupsSection } from './sections/MockupsSection';
import { TrimsSection } from './sections/TrimsSection';
import { SectionShell } from './SectionShell';
import styles from './builder.module.css';

export function BuilderScreen({ packId }: { packId: string }) {
  const env = useServices();
  const resource = useResource(useCallback(() => loadBuilder(env, packId), [env, packId]));

  if (resource.status === 'loading') return <BuilderSkeleton />;
  if (resource.status === 'failed') return <LoadFailure what="this tech pack" onRetry={resource.retry} />;
  if (!resource.data.pack) {
    return (
      <EmptyState title="We couldn't find this tech pack" actionHref="/orders" actionLabel="Go to My orders">
        It may have been saved in another browser, because tech packs are stored on this device.
      </EmptyState>
    );
  }
  return <Builder key={resource.data.pack.id} initialPack={resource.data.pack} catalogue={resource.data.catalogue} />;
}

function BuilderSkeleton() {
  return (
    <LoadingRegion label="Loading your tech pack">
      <div className={styles.layout}>
        <div className="stack-16">
          <Skeleton height={32} width="40%" />
          {SECTION_IDS.map((id) => (
            <Skeleton key={id} height={72} radius={16} />
          ))}
        </div>
        <div className={styles.railColumn}>
          <Skeleton height={480} radius={16} />
        </div>
      </div>
    </LoadingRegion>
  );
}

export interface ChangeOptions {
  /** Text edits wait for a pause in typing; picks save straight away. */
  debounce?: boolean;
}

function Builder({ initialPack, catalogue }: { initialPack: TechPack; catalogue: Catalogue }) {
  const env = useServices();
  const router = useRouter();
  const [pack, setPack] = useState(initialPack);
  const [openSections, setOpenSections] = useState<Set<SectionId>>(() => new Set<SectionId>(['details']));
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const autosave = useAutosave<TechPack>((next) => saveTechPack(env, next));
  useNavigationGuard(autosave.flush);

  const readiness = useMemo(() => evaluateReadiness(pack, catalogue), [pack, catalogue]);
  const estimate = useMemo(() => estimatePrice(pack, pack.estimateQuantity, catalogue), [pack, catalogue]);
  const category = findCategory(catalogue, pack.categoryId);
  const readOnly = isFrozen(pack);

  function change(next: TechPack, options: ChangeOptions = {}) {
    setPack(next);
    autosave.push(next, { debounce: options.debounce ?? false });
  }

  function toggleSection(id: SectionId) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function goToSection(id: SectionId) {
    setIsSheetOpen(false);
    setOpenSections((current) => new Set(current).add(id));
    requestAnimationFrame(() => document.getElementById(`section-${id}`)?.scrollIntoView({ block: 'start' }));
  }

  async function requestQuote() {
    setIsLeaving(true);
    if (await autosave.flush()) router.push(`/quote?pack=${pack.id}`);
    else setIsLeaving(false);
  }

  const sectionProps = { pack, catalogue, category, readOnly, onChange: change };
  const content: Record<SectionId, React.ReactNode> = {
    details: <DetailsSection {...sectionProps} />,
    mockups: <MockupsSection {...sectionProps} />,
    measurements: <MeasurementsSection {...sectionProps} />,
    fabrics: <FabricsSection {...sectionProps} />,
    trims: <TrimsSection {...sectionProps} />,
  };

  const railProps = {
    pack,
    catalogue,
    readiness,
    estimate,
    readOnly,
    isLeaving,
    saveFailed: autosave.status === 'failed',
    onQuantityChange: (estimateQuantity: number) => change({ ...pack, estimateQuantity }, { debounce: true }),
    onGoToSection: goToSection,
    onRequestQuote: () => void requestQuote(),
  };

  return (
    <div className={styles.page}>
      <div className="page-head">
        <div className="stack-4">
          <h1 className="page-title">{displayName(pack, catalogue)}</h1>
          <p className="meta">
            <span className="tabular">{pack.reference}</span> · {category.name}
          </p>
        </div>
        {readOnly ? null : <SaveIndicator status={autosave.status} onRetry={() => void autosave.flush()} />}
      </div>

      {readOnly ? (
        <p className={`notice ${styles.frozenNotice}`}>
          This tech pack was sent for a quote, so it is frozen and opens read-only.
        </p>
      ) : null}

      <div className={styles.layout}>
        <div className="stack-16">
          {SECTION_IDS.map((id, index) => (
            <SectionShell
              key={id}
              id={id}
              number={index + 1}
              title={SECTION_TITLES[id]}
              state={readiness.sections[index].state}
              isOpen={openSections.has(id)}
              readOnly={readOnly}
              onToggle={() => toggleSection(id)}
              onClear={() => change(clearSection(pack, id))}
            >
              {content[id]}
            </SectionShell>
          ))}
        </div>
        <aside className={styles.railColumn} aria-label="Completeness and price">
          <Rail {...railProps} />
        </aside>
      </div>

      <MobileSummary {...railProps} isOpen={isSheetOpen} onOpenChange={setIsSheetOpen} />
    </div>
  );
}
