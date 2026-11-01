'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Slides up from the bottom edge, for the phone summary sheet. */
  variant?: 'centre' | 'sheet';
}

/**
 * Built on the native <dialog>: showModal() traps focus, makes the page behind inert and closes
 * on Escape. Focus goes back to the element that opened it. Render it only while it is open.
 */
export function Dialog({ title, onClose, children, footer, variant = 'centre' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      // React has already removed the dialog here, so the browser cannot restore focus itself.
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog dialog-${variant}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="dialog-inner">
        <header className="dialog-header">
          <h2 className="section-title">{title}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer ? <footer className="dialog-footer">{footer}</footer> : null}
      </div>
    </dialog>
  );
}
