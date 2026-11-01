'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { DemoPanel } from '@/features/demo/DemoPanel';
import { GuardedLink } from './NavigationGuard';

const NAV = [
  { href: '/', label: 'New tech pack' },
  { href: '/orders', label: 'My orders' },
];

export function AppHeader() {
  const pathname = usePathname();
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <GuardedLink className="brand" href="/">
          venduo
        </GuardedLink>
        <nav aria-label="Main" className="app-nav">
          {NAV.map(({ href, label }) => (
            <GuardedLink key={href} href={href} className="nav-link" aria-current={pathname === href ? 'page' : undefined}>
              {label}
            </GuardedLink>
          ))}
          <button type="button" className="nav-link" onClick={() => setIsDemoOpen(true)}>
            Demo
          </button>
        </nav>
      </div>
      {isDemoOpen ? <DemoPanel onClose={() => setIsDemoOpen(false)} /> : null}
    </header>
  );
}
