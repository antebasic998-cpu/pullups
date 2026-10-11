import { useEffect, useState, type ReactNode } from 'react';
import { avatarColor, initials } from '../lib/format';
import { useAvatarUrl } from '../lib/avatars';

/**
 * Round athlete avatar: the photo when there is one (looked up by `userId`, or passed as `url`),
 * otherwise coloured initials.
 */
export function Avatar({
  name,
  size = 32,
  userId,
  url,
}: {
  name: string;
  size?: number;
  userId?: string | null;
  /** Overrides the lookup – used to preview a photo that has not been saved yet. */
  url?: string | null;
}) {
  const known = useAvatarUrl(userId);
  const src = url ?? known;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const showPhoto = Boolean(src) && !failed;
  return (
    <span
      className={`avatar${showPhoto ? ' avatar-photo' : ''}`}
      style={{
        width: size,
        height: size,
        background: showPhoto ? 'var(--surface-3)' : avatarColor(name),
        fontSize: size * 0.38,
      }}
      aria-hidden="true"
    >
      {showPhoto ? <img src={src ?? undefined} alt="" draggable={false} onError={() => setFailed(true)} /> : initials(name)}
    </span>
  );
}

/** Eyebrow + big title on the left, an optional control (the exercise pill) on the right. */
export function PageHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow: ReactNode;
  title: string;
  right?: ReactNode;
}) {
  return (
    <header className="page-top">
      <div className="min-w-0">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
      </div>
      {right}
    </header>
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
    <div className="empty">
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </div>
  );
}
