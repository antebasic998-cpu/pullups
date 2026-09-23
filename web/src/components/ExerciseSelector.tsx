import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ExerciseCategory } from '../types';

interface Props {
  selected: ExerciseCategory | null;
  onSelect: (category: ExerciseCategory) => void;
  compact?: boolean;
  loading?: boolean;
  initialSlug?: string | null;
}

export function ExerciseSelector({ selected, onSelect, compact, loading, initialSlug }: Props) {
  const [categories, setCategories] = useState<ExerciseCategory[]>([]);

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
  }, [initialSlug]);

  if (categories.length <= 1) return null;

  return (
    <div
      className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1 text-sm"
      role="tablist"
      aria-label="Exercise category"
    >
      {categories.map((cat) => {
        const isSelected = selected?.id === cat.id || selected?.slug === cat.slug;
        const icon = cat.slug.includes('chin') ? '🤸' : '💪';
        const showSpinner = isSelected && loading;
        return (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            data-active={isSelected}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${
              compact ? 'text-xs' : 'text-sm'
            } ${
              isSelected
                ? 'bg-[var(--accent)] text-[var(--bg)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
            onClick={() => onSelect(cat)}
          >
            <span className="inline-flex items-center justify-center w-4 h-4">
              {showSpinner ? (
                <span
                  className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden="true"
                />
              ) : (
                <span>{icon}</span>
              )}
            </span>
            <span>{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}
