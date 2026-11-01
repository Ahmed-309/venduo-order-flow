import type { ReactNode } from 'react';
import { GuardedLink } from './NavigationGuard';

export function LoadFailure({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="panel state-view" role="alert">
      <p className="section-title">We couldn&apos;t load {what}.</p>
      <button type="button" className="btn btn-primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  actionHref,
  actionLabel,
}: {
  title: string;
  children: ReactNode;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="panel state-view">
      <p className="section-title">{title}</p>
      <p className="meta">{children}</p>
      <GuardedLink className="btn btn-primary" href={actionHref}>
        {actionLabel}
      </GuardedLink>
    </div>
  );
}

/** A grey block sized like the content it stands in for. */
export function Skeleton({ height, width = '100%', radius = 8 }: { height: number; width?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius }} />;
}

/** Announces the wait to screen readers; the skeleton shapes are for sighted users. */
export function LoadingRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-label={label} aria-busy="true">
      {children}
    </div>
  );
}
