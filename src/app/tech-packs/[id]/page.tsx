import type { Metadata } from 'next';
import { BuilderScreen } from '@/features/builder/BuilderScreen';

export const metadata: Metadata = { title: 'Tech pack | Venduo' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BuilderScreen packId={id} />;
}
