import type { Metadata } from 'next';
import { ConfirmationScreen } from '@/features/quote/ConfirmationScreen';

export const metadata: Metadata = { title: 'Quote requested | Venduo' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConfirmationScreen requestId={id} />;
}
