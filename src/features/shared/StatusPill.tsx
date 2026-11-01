import type { QuoteRequestStatus } from '@/domain/quote';
import type { TechPackStatus } from '@/domain/techPack';

type OrderStatus = TechPackStatus | QuoteRequestStatus;

const STATUSES: Record<OrderStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'pill-neutral' },
  quote_requested: { label: 'Quote requested', className: 'pill-warning' },
  quote_received: { label: 'Quote received', className: 'pill-info' },
  sampling: { label: 'Sampling', className: 'pill-success' },
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const { label, className } = STATUSES[status];
  return <span className={`pill ${className}`}>{label}</span>;
}
