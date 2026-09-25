import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { exerciseEmoji, inferCategoryIconKey, slugifyCategoryName } from '../lib/categoryUtils';
import { invalidate } from '../lib/store';
import { Modal } from './Modal';
import { useToast } from './Toast';
import type { ExerciseCategory } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: (category: ExerciseCategory) => void;
}

export function ExerciseFormModal({ open, onClose, onSaved }: Props) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setError(null);
    setBusy(false);
  }, [open]);

  const previewSlug = name.trim() ? slugifyCategoryName(name) : '';

  async function submit() {
    setError(null);
    if (!name.trim()) return setError('Enter a name for the exercise.');
    setBusy(true);
    try {
      const res = await api.createCategory({
        name: name.trim(),
        description: description.trim(),
      });
      invalidate();
      toast.success(`${res.category.name} added to the board.`);
      onSaved?.(res.category);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add this exercise.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add exercise"
      subtitle="New exercises sync to everyone on the board automatically."
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Add exercise'}
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
            onChange={(e) => setName(e.target.value)}
            placeholder="Assisted Chin-up"
            autoFocus
          />
        </label>
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
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            <span className="text-2xl">
              {exerciseEmoji(inferCategoryIconKey(previewSlug, name.trim()), previewSlug)}
            </span>
            <div className="min-w-0">
              <div className="font-semibold">{name.trim()}</div>
              <div className="text-xs faint">slug: {previewSlug}</div>
            </div>
          </div>
        ) : null}
        <p className="m-0 text-xs faint leading-relaxed">
          Scored like pull-ups and chin-ups — reps with bodyweight-normalized points. Names containing
          “assisted”, “chin”, or “pull” pick the right icon automatically.
        </p>
        {error ? <p className="m-0 text-sm" style={{ color: 'var(--danger)' }}>{error}</p> : null}
      </div>
    </Modal>
  );
}
