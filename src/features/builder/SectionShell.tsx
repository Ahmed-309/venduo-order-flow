'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SectionState } from '@/domain/readiness';
import type { SectionId } from '@/domain/techPack';
import styles from './builder.module.css';

const SECTION_STATES: Record<SectionState, { label: string; className: string; icon: ReactNode }> = {
  complete: { label: 'Complete', className: styles.stateComplete, icon: <path d="M3 8.5 6.5 12 13 4.5" /> },
  incomplete: {
    label: 'Incomplete',
    className: styles.stateIncomplete,
    icon: <circle cx="8" cy="8" r="6.5" strokeDasharray="3 2.1" />,
  },
  optional: { label: 'Optional', className: styles.stateOptional, icon: <path d="M3.5 8h9" /> },
};

/** Each state has its own shape, so colour never carries the meaning alone. */
export function SectionStateIcon({ state }: { state: SectionState }) {
  const { label, className, icon } = SECTION_STATES[state];
  return (
    <span className={`${styles.stateIcon} ${className}`}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        {icon}
      </svg>
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

interface SectionShellProps {
  id: SectionId;
  number: number;
  title: string;
  state: SectionState;
  isOpen: boolean;
  readOnly: boolean;
  onToggle: () => void;
  onClear: () => void;
  children: ReactNode;
}

export function SectionShell({ id, number, title, state, isOpen, readOnly, onToggle, onClear, children }: SectionShellProps) {
  const panelId = `section-panel-${id}`;

  return (
    <section id={`section-${id}`} className={`panel ${styles.section}`}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionHeading}>
          <button
            type="button"
            className={styles.sectionToggle}
            aria-expanded={isOpen}
            aria-controls={panelId}
            onClick={onToggle}
          >
            <span className={`${styles.sectionNumber} tabular`} aria-hidden="true">
              {String(number).padStart(2, '0')}
            </span>
            <span className="section-title">{title}</span>
            <SectionStateIcon state={state} />
          </button>
        </h2>
        {readOnly ? null : <ClearMenu title={title} onClear={onClear} />}
      </div>
      <div id={panelId} hidden={!isOpen} className={styles.sectionBody}>
        {children}
      </div>
    </section>
  );
}

function ClearMenu({ title, onClear }: { title: string; onClear: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const item = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    item.current?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [isOpen]);

  function close() {
    setIsOpen(false);
    trigger.current?.focus();
  }

  return (
    <div
      ref={container}
      className="menu"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) close();
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="menu-trigger"
        aria-label={`${title} options`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        ⋮
      </button>
      {isOpen ? (
        <div className="menu-list" role="menu" aria-label={`${title} options`}>
          <button
            ref={item}
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              onClear();
              close();
            }}
          >
            Clear section
          </button>
        </div>
      ) : null}
    </div>
  );
}
