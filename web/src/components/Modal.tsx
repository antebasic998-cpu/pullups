import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBodyLock } from '../lib/hooks';
import { XIcon } from './Icons';

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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="fixed inset-0" style={{ background: 'var(--overlay)', animation: 'fadeIn 0.16s ease both' }} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card fade-in relative my-auto w-full"
        style={{ maxWidth: width, padding: '1.25rem', boxShadow: '0 24px 60px -30px rgba(0,0,0,0.65)' }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="m-0 text-base font-semibold tracking-tight">{title}</h2>
            {subtitle ? <p className="m-0 mt-0.5 text-xs muted">{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <XIcon size={16} />
          </button>
        </div>

        {children}

        {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>,
    document.body,
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
