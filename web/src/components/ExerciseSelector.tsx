import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../api';
import type { ExerciseCategory } from '../types';
import { BarIcon, CheckIcon, ChevronDownIcon } from './Icons';

interface Props {
  selected: ExerciseCategory | null;
  onSelect: (category: ExerciseCategory) => void;
  /** Kept for call-site compatibility – both variants are already compact. */
  compact?: boolean;
  loading?: boolean;
  initialSlug?: string | null;
  /** "pill" = Arena header dropdown, "seg" = inline segmented control (used in the Log sheet). */
  variant?: 'pill' | 'seg';
  /** Shown instead of the selector when there is only one exercise to pick from. */
  fallback?: ReactNode;
}

export function ExerciseSelector({ selected, onSelect, loading, initialSlug, variant = 'pill', fallback }: Props) {
  const [categories, setCategories] = useState<ExerciseCategory[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    void api.categories().then((res) => {
      if (active && res.categories?.length > 0) {
        setCategories(res.categories);
        if (!selected) {
          const match = initialSlug ? res.categories.find((c) => c.slug === initialSlug) : null;
          onSelect(match ?? res.categories[0]);
        }
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSlug]);

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (categories.length <= 1) return <>{fallback ?? null}</>;

  const isSelected = (cat: ExerciseCategory) => selected?.id === cat.id || selected?.slug === cat.slug;

  if (variant === 'seg') {
    return (
      <div className="seg" role="tablist" aria-label="Exercise category">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={isSelected(cat)}
            data-active={isSelected(cat)}
            className="seg-item"
            onClick={() => onSelect(cat)}
          >
            {cat.name}
          </button>
        ))}
      </div>
    );
  }

  const current = categories.find(isSelected) ?? categories[0];

  return (
    <div className="ex-wrap" ref={wrapRef}>
      <button
        type="button"
        className="ex-pill"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Exercise: ${current.name}`}
        onClick={() => setOpen((v) => !v)}
        style={{ opacity: loading ? 0.7 : 1 }}
      >
        <BarIcon size={18} strokeWidth={2} />
        <span>{current.name}</span>
        <ChevronDownIcon size={15} strokeWidth={2.4} />
      </button>

      {open ? (
        <div className="ex-menu" role="listbox" aria-label="Exercise category">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="option"
              aria-selected={isSelected(cat)}
              data-active={isSelected(cat)}
              onClick={() => {
                onSelect(cat);
                setOpen(false);
              }}
            >
              <BarIcon size={17} strokeWidth={2} />
              <span>{cat.name}</span>
              {isSelected(cat) ? <CheckIcon size={16} strokeWidth={2.6} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
