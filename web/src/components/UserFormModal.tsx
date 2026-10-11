import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { AvatarPicker } from './AvatarPicker';
import { Modal } from './Modal';
import { useAvatarUrl } from '../lib/avatars';
import { useToast } from './Toast';
import { invalidate } from '../lib/store';
import { todayISO } from '../lib/format';
import type { UserSummary } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  user?: UserSummary | null;
  onSaved?: (user: UserSummary) => void;
}

export function UserFormModal({ open, onClose, user, onSaved }: Props) {
  const toast = useToast();
  const editing = Boolean(user);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [pb, setPb] = useState('');
  const [pbDate, setPbDate] = useState(todayISO());
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const savedPhoto = useAvatarUrl(user?.id);

  useEffect(() => {
    if (!open) return;
    setPhoto(null);
    setPhotoRemoved(false);
    setError(null);
    setBusy(false);
    setName(user?.name ?? '');
    setAge(user?.age ? String(user.age) : '');
    setWeight(user ? String(user.weightKg) : '');
    setNote(user?.note ?? '');
    setPb('');
    setPbDate(todayISO());
  }, [open, user]);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError('Please enter a name.');
    if (!weight.trim()) return setError('Please enter a bodyweight in kilograms.');

    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        age: age || null,
        weightKg: weight.replace(',', '.'),
        note: note.trim(),
      };
      const res =
        editing && user
          ? await api.updateUser(user.id, payload)
          : await api.createUser({
              ...payload,
              pbAbsolute: pb || null,
              pbDate,
            });
      // The photo goes up after the athlete exists. If only the photo fails, the athlete is still saved.
      let photoFailed = false;
      try {
        if (photo) await api.uploadAvatar(res.user.id, photo);
        else if (photoRemoved && savedPhoto) await api.deleteAvatar(res.user.id);
      } catch {
        photoFailed = true;
      }
      invalidate();
      if (photoFailed) {
        toast.error(`${payload.name} was saved, but the photo could not be uploaded. Try again from Edit.`);
      } else {
        toast.success(editing ? `${payload.name} updated.` : `${payload.name} joined the board.`);
      }
      onSaved?.(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${user?.name}` : 'Add an athlete'}
      subtitle={
        editing
          ? 'Bodyweight on your profile is used for new logs only — past results keep the weight from that day.'
          : 'Name, age and bodyweight are all the board needs to score fairly.'
      }
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add athlete'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <AvatarPicker
          name={name}
          userId={user?.id}
          staged={photo}
          removed={photoRemoved}
          hasPhoto={Boolean(savedPhoto)}
          onPick={(dataUrl) => {
            setPhoto(dataUrl);
            setPhotoRemoved(false);
          }}
          onRemove={() => {
            setPhoto(null);
            setPhotoRemoved(true);
          }}
        />

        <div className="field">
          <label className="label" htmlFor="uf-name">
            Full name
          </label>
          <input
            id="uf-name"
            className="input"
            value={name}
            autoFocus
            placeholder="e.g. Marta Kowalska"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label className="label" htmlFor="uf-age">
              Age
            </label>
            <input
              id="uf-age"
              className="input num"
              value={age}
              inputMode="numeric"
              placeholder="29"
              onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, ''))}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="uf-weight">
              Bodyweight (kg)
            </label>
            <input
              id="uf-weight"
              className="input num"
              value={weight}
              inputMode="decimal"
              placeholder="72.5"
              onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, ''))}
            />
          </div>
        </div>

        {!editing ? (
          <div
            className="rounded-xl border p-3.5"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface-2)',
            }}
          >
            <p className="m-0 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              Already have a personal best from the office whiteboard? Optional — record it now so the leaderboard is
              complete from day one.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="field">
                <label className="label" htmlFor="uf-pb">
                  Reps (PB)
                </label>
                <input
                  id="uf-pb"
                  className="input num"
                  value={pb}
                  inputMode="numeric"
                  placeholder="optional"
                  onChange={(e) => setPb(e.target.value.replace(/[^\d]/g, ''))}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="uf-pbdate">
                  Date set
                </label>
                <input
                  id="uf-pbdate"
                  type="date"
                  className="input num"
                  value={pbDate}
                  max={todayISO()}
                  onChange={(e) => setPbDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="field">
          <label className="label" htmlFor="uf-note">
            Note (optional)
          </label>
          <input
            id="uf-note"
            className="input"
            value={note}
            placeholder="Runs the morning run club"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error ? <p className="error-text m-0">{error}</p> : null}
      </div>
    </Modal>
  );
}
