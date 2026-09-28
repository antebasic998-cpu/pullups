import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useBodyLock } from '../lib/hooks';
import type { BadgeTier, CelebrationData } from '../types';

const TIER_COLOR: Record<BadgeTier, string> = {
  bronze: 'var(--bronze)',
  silver: 'var(--silver)',
  gold: 'var(--gold)',
  legend: 'var(--accent)',
};

interface CelebrationContextValue {
  celebrate: (data: CelebrationData) => void;
  dismiss: () => void;
}

const CelebrationContext = createContext<CelebrationContextValue | null>(null);

export function useCelebration() {
  const ctx = useContext(CelebrationContext);
  if (!ctx) throw new Error('useCelebration must be used within CelebrationProvider');
  return ctx;
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CelebrationData | null>(null);
  const [visible, setVisible] = useState(false);

  const dismiss = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => setData(null), 280);
  }, []);

  const celebrate = useCallback((celebrationData: CelebrationData) => {
    setData(celebrationData);
    setVisible(true);
  }, []);

  return (
    <CelebrationContext.Provider value={{ celebrate, dismiss }}>
      {children}
      {data ? <CelebrationOverlay visible={visible} data={data} onDismiss={dismiss} /> : null}
    </CelebrationContext.Provider>
  );
}

function CelebrationOverlay({
  visible,
  data,
  onDismiss,
}: {
  visible: boolean;
  data: CelebrationData;
  onDismiss: () => void;
}) {
  useBodyLock(visible);

  const [displayXp, setDisplayXp] = useState(0);
  const [progress, setProgress] = useState(data.oldProgress);
  const [pulse, setPulse] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    if (!visible) return;

    setDisplayXp(0);
    setProgress(data.oldProgress);
    setPulse(false);
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];

    const start = performance.now();
    const duration = 800;
    let raf = 0;
    const tickXp = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayXp(Math.round(eased * data.xpGained));
      if (t < 1) raf = requestAnimationFrame(tickXp);
    };
    raf = requestAnimationFrame(tickXp);

    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      timersRef.current.push(id);
    };

    if (data.leveledUp) {
      schedule(() => setProgress(100), 80);
      schedule(() => {
        setPulse(true);
        schedule(() => setPulse(false), 360);
      }, 480);
      schedule(() => setProgress(0), 920);
      schedule(() => setProgress(data.newProgress), 1020);
    } else {
      schedule(() => setProgress(data.newProgress), 220);
    }

    return () => {
      cancelAnimationFrame(raf);
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, [visible, data]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onDismiss]);

  if (!visible) return null;

  const heroEmoji = data.leveledUp
    ? '👑'
    : data.newBadges.length > 0
      ? data.newBadges[0].emoji
      : '⚡';
  const accentBorder = data.leveledUp ? 'var(--gold)' : 'var(--border)';

  return createPortal(
    <div className="celebration-root" role="dialog" aria-modal="true" aria-label="Result recorded">
      <button type="button" className="celebration-backdrop" aria-label="Close celebration" onClick={onDismiss} />
      <div
        className={`celebration-card celebration-card-enter ${pulse ? 'celebration-pulse' : ''}`}
        style={{ borderColor: accentBorder }}
      >
        <div className="celebration-header">
          <div
            className="celebration-icon-circle"
            style={{
              background: data.leveledUp ? 'rgba(226, 192, 105, 0.18)' : 'var(--accent-soft)',
              borderColor: data.leveledUp ? 'var(--gold)' : 'var(--accent-line)',
            }}
          >
            <span className="celebration-hero-emoji">{heroEmoji}</span>
          </div>

          {data.leveledUp ? (
            <span className="celebration-pill" style={{ background: 'var(--gold)', color: '#0f1305' }}>
              LEVEL UP!
            </span>
          ) : data.newBadges.length > 0 ? (
            <span className="celebration-pill" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>
              ACHIEVEMENT UNLOCKED!
            </span>
          ) : (
            <span className="celebration-pill" style={{ background: 'var(--surface-3)', color: 'var(--accent)' }}>
              RESULT RECORDED
            </span>
          )}

          <h2 className="celebration-title">
            {data.leveledUp
              ? `Level ${data.newLevel?.level ?? ''} · ${data.newLevel?.title ?? ''}`
              : `+${displayXp} XP`}
          </h2>
          <p className="celebration-subtitle muted">
            {data.leveledUp
              ? `Promoted from ${data.oldLevel?.title ?? 'previous level'}!`
              : `${data.reps} ${data.categoryName} logged for ${data.userName}`}
          </p>
        </div>

        {data.leveledUp ? (
          <div className="celebration-xp-banner" style={{ color: 'var(--accent)' }}>
            +{displayXp} XP earned
          </div>
        ) : null}

        <div className="celebration-progress-card">
          <div className="celebration-progress-row">
            <span className="text-sm font-semibold">
              Level {data.newLevel?.level ?? 1} · {data.newLevel?.title}
            </span>
            <span className="num text-xs muted">
              {data.newLevel?.isMax
                ? `${data.newXp} XP (max)`
                : `${data.newLevel?.xpIntoLevel ?? 0} / ${data.newLevel?.xpForLevel ?? 0} XP`}
            </span>
          </div>
          <div className="celebration-track">
            <div
              className="celebration-fill"
              style={{
                width: `${Math.max(0, Math.min(100, progress))}%`,
                background: data.leveledUp ? 'var(--gold)' : 'var(--accent)',
              }}
            />
          </div>
          <div className="celebration-progress-row">
            <span className="text-xs faint">
              {data.newLevel?.isMax
                ? 'Office legend · top rank'
                : `${data.newLevel?.xpToNext ?? 0} XP to ${data.newLevel?.nextTitle}`}
            </span>
            <span className="num text-xs muted">{Math.round(progress)}%</span>
          </div>
        </div>

        {data.newBadges.length > 0 ? (
          <div className="celebration-badges">
            <p className="celebration-badges-label faint">
              {data.newBadges.length === 1 ? 'NEW BADGE' : 'NEW BADGES'}
            </p>
            {data.newBadges.map((badge) => {
              const color = TIER_COLOR[badge.tier] ?? 'var(--muted)';
              return (
                <div key={badge.id} className="celebration-badge-row" style={{ borderColor: color }}>
                  <div className="celebration-badge-icon" style={{ borderColor: color }}>
                    {badge.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{badge.name}</span>
                      <span className="celebration-tier-tag" style={{ background: color }}>
                        {badge.tier.toUpperCase()}
                      </span>
                    </div>
                    <p className="m-0 mt-0.5 text-xs faint">{badge.how}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <button
          type="button"
          className="btn celebration-cta"
          style={{
            background: data.leveledUp ? 'var(--gold)' : 'var(--accent)',
            color: data.leveledUp ? '#0f1305' : 'var(--accent-ink)',
          }}
          onClick={onDismiss}
        >
          {data.leveledUp ? 'Awesome! 🏆' : 'Nice! 🔥'}
        </button>
        <p className="celebration-hint faint">Click outside or the button to close</p>
      </div>
    </div>,
    document.body,
  );
}
