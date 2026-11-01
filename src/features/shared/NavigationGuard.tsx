'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, type ComponentProps, type MouseEvent, type ReactNode } from 'react';

type Guard = () => Promise<boolean>;
type GuardRef = { current: Guard | null };

const GuardContext = createContext<GuardRef>({ current: null });

/** Lets a screen with unsaved edits flush them before an in-app link moves away. */
export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const guard = useRef<Guard | null>(null);
  return <GuardContext.Provider value={guard}>{children}</GuardContext.Provider>;
}

/** Registers a flush for as long as the calling screen is mounted. It returns false to stay put. */
export function useNavigationGuard(guard: Guard): void {
  const ref = useContext(GuardContext);
  useEffect(() => {
    ref.current = guard;
    return () => {
      ref.current = null;
    };
  }, [ref, guard]);
}

export function GuardedLink({ href, onClick, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const guard = useContext(GuardContext);
  const router = useRouter();

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (!guard.current || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    if (await guard.current()) router.push(href);
  }

  return <Link href={href} onClick={handleClick} {...props} />;
}
