import type { Metadata } from 'next';
import { QuoteScreen } from '@/features/quote/QuoteScreen';

export const metadata: Metadata = { title: 'Request a quote | Venduo' };

export default async function Page({ searchParams }: { searchParams: Promise<{ pack?: string }> }) {
  const { pack } = await searchParams;
  return <QuoteScreen preselectPackId={pack ?? null} />;
}
