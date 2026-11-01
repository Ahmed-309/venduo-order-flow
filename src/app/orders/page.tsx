import type { Metadata } from 'next';
import { OrdersScreen } from '@/features/orders/OrdersScreen';

export const metadata: Metadata = { title: 'My orders | Venduo' };

export default function Page() {
  return <OrdersScreen />;
}
