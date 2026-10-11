import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBodyLock } from '../lib/hooks';
import { XIcon } from './Icons';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  label: string;
}

/**
 * The Arena bottom sheet: slides up from the bottom edge on phones (grab handle,
 * 30px corners) and becomes a centred dialog from 640px up. Every dialog in the
 * app is built on it, so they all share one shape.
 */
export function Sheet({ open, onClose, children, width = 560, label }: SheetProps) {
  useBodyLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="sheet-root">
      <div className="sheet-dim" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={label} className="sheet" style={{ maxWidth: width }}>
        <div className="grab" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({ open, title, subtitle, onClose, children, footer, width = 520 }: ModalProps) {
  return (
    <Sheet open={open} onClose={onClose} width={width} label={title}>
      <div className="sheet-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <button type="button" className="ib" onClick={onClose} aria-label="Close">
          <XIcon size={20} strokeWidth={2.2} />
        </button>
      </div>

      <div className="sheet-body">{children}</div>

      {footer ? <div className="sheet-foot">{footer}</div> : null}
    </Sheet>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  busy,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      width={430}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
        {message}
      </div>
    </Modal>
  );
}
