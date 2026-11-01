import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppHeader } from '@/features/shared/AppHeader';
import { NavigationGuardProvider } from '@/features/shared/NavigationGuard';
import { ServicesProvider } from '@/features/shared/RepositoryProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Venduo: from tech pack to quote request',
  description: 'Spec a garment, see a live price and ask a factory for a quote.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={GeistSans.className}>
      <body>
        <ServicesProvider>
          <NavigationGuardProvider>
            <AppHeader />
            <main className="page">{children}</main>
          </NavigationGuardProvider>
        </ServicesProvider>
      </body>
    </html>
  );
}
