import { EXERCISE_ICONS } from '../lib/categoryUtils';

/** Grid of emoji to choose an exercise icon from. */
export function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return (
    <div className="icon-grid" role="radiogroup" aria-label="Exercise icon">
      {EXERCISE_ICONS.map((icon) => (
        <button
          key={icon}
          type="button"
          role="radio"
          aria-checked={value === icon}
          aria-label={`Icon ${icon}`}
          onClick={() => onChange(icon)}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
