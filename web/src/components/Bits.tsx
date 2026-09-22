import type { ReactNode } from 'react';
import { avatarColor, initials } from '../lib/format';

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: avatarColor(name),
        fontSize: size * 0.4,
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/** The single number a row is really about. */
export function Score({
  value,
  suffix,
  emphasis = false,
}: {
  value: string;
  suffix?: string;
  emphasis?: boolean;
}) {
  return (
    <span className="num" style={{ fontWeight: emphasis ? 600 : 500, color: emphasis ? 'var(--text)' : 'var(--muted)' }}>
      {value}
      {suffix ? <span className="faint"> {suffix}</span> : null}
    </span>
  );
}

export function Metric({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className="metric">
      <span className="metric-value num" style={accent ? { color: 'var(--accent)' } : undefined}>
        {value}
      </span>
      <span className="metric-label">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-16 text-center">
      <h2 className="m-0 text-base font-semibold">{title}</h2>
      <p className="m-0 max-w-sm text-sm leading-relaxed muted">{message}</p>
      {action}
    </div>
  );
}
