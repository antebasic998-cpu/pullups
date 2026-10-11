import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { exerciseEmoji, inferCategoryIconKey, slugifyCategoryName } from '../lib/categoryUtils';
import { invalidate } from '../lib/store';
import { IconPicker } from './IconPicker';
import { Modal } from './Modal';
import { useToast } from './Toast';
import type { ExerciseCategory } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pass an exercise to rename it / change its icon; leave empty to add a new one. */
  category?: ExerciseCategory | null;
  onSaved?: (category: ExerciseCategory) => void;
}

export function ExerciseFormModal({ open, onClose, category, onSaved }: Props) {
  const toast = useToast();
  const editing = Boolean(category);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('💪');
  // While adding, the icon follows the name ("chin" → 🤸) until the user picks one themselves.
  const [iconPicked, setIconPicked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setDescription(category?.description ?? '');
    setIcon(category ? exerciseEmoji(category.iconKey, category.slug) : '💪');
    setIconPicked(Boolean(category));
    setError(null);
    setBusy(false);
  }, [open, category]);

  function onNameChange(value: string) {
    setName(value);
    if (!iconPicked) {
      const slug = slugifyCategoryName(value);
      setIcon(exerciseEmoji(inferCategoryIconKey(slug, value.trim()), slug));
    }
  }

  const previewSlug = !editing && name.trim() ? slugifyCategoryName(name) : '';

  async function submit() {
    setError(null);
    if (!name.trim()) return setError('Enter a name for the exercise.');
    setBusy(true);
    try {
      const input = {
        name: name.trim(),
        description: description.trim(),
        iconKey: icon,
      };
      const res = category ? await api.updateCategory(category.id, input) : await api.createCategory(input);
      invalidate();
      toast.success(editing ? `${res.category.name} updated.` : `${res.category.name} added to the board.`);
      onSaved?.(res.category);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : editing
            ? 'Could not save this exercise.'
            : 'Could not add this exercise.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${category?.name}` : 'Add exercise'}
      subtitle={
        editing
          ? 'Results stay exactly as they are — only the name and icon change, for everyone.'
          : 'New exercises sync to everyone on the board automatically.'
      }
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add exercise'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="field">
          <span className="field-label">Exercise name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Assisted Chin-up"
            autoFocus
          />
        </label>
        <div className="field">
          <span className="field-label">Icon</span>
          <IconPicker
            value={icon}
            onChange={(next) => {
              setIcon(next);
              setIconPicked(true);
            }}
          />
        </div>
        <label className="field">
          <span className="field-label">Description (optional)</span>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Band-assisted, strict form"
          />
        </label>
        {previewSlug ? (
          <div
            className="flex items-center gap-3 rounded-xl border p-3"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface-2)',
            }}
          >
            <span className="text-2xl">{icon}</span>
            <div className="min-w-0">
              <div className="font-semibold">{name.trim()}</div>
              <div className="text-xs faint">slug: {previewSlug}</div>
            </div>
          </div>
        ) : null}
        {error ? (
          <p className="m-0 text-sm" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
