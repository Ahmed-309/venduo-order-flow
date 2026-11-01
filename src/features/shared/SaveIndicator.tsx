import type { SaveStatus } from '@/application/autosaveQueue';

const LABELS: Record<SaveStatus, string> = {
  idle: 'All changes saved',
  saving: 'Saving',
  saved: 'All changes saved',
  failed: "We couldn't save your last change. It is still here on this screen.",
};

export function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === 'failed') {
    return (
      <div className="save-failed" role="alert">
        <span>{LABELS.failed}</span>
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Retry saving
        </button>
      </div>
    );
  }
  return (
    <p className="meta" role="status">
      {LABELS[status]}
    </p>
  );
}
