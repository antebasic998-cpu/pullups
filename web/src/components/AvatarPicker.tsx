import { useRef, useState } from 'react';
import { fileToAvatarDataUrl } from '../lib/image';
import { Avatar } from './Bits';

/**
 * Photo field for the athlete form. Nothing is uploaded here: it only reports the staged choice
 * (a new photo as a data URL, or `null` to remove) and the form saves it together with the athlete.
 */
export function AvatarPicker({
  name,
  userId,
  staged,
  removed,
  hasPhoto,
  onPick,
  onRemove,
}: {
  name: string;
  userId?: string | null;
  /** Newly picked photo, not saved yet. */
  staged: string | null;
  /** The saved photo is going to be removed on save. */
  removed: boolean;
  /** The athlete currently has a saved photo. */
  hasPhoto: boolean;
  onPick: (dataUrl: string) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      onPick(await fileToAvatarDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that photo.');
    }
  }

  const showsPhoto = Boolean(staged) || (hasPhoto && !removed);

  return (
    <div className="photo-pick">
      <Avatar name={name.trim() || '?'} size={72} userId={removed ? null : userId} url={staged} />
      <div className="photo-pick-actions">
        <div className="row">
          <button type="button" className="btn btn-sm" onClick={() => input.current?.click()}>
            {showsPhoto ? 'Change photo' : 'Add photo'}
          </button>
          {showsPhoto ? (
            <button type="button" className="btn btn-sm" onClick={onRemove}>
              Remove
            </button>
          ) : null}
        </div>
        <span className="hint">Optional. Cropped to a square.</span>
        {error ? (
          <span className="error-text" style={{ margin: 0 }}>
            {error}
          </span>
        ) : null}
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = ''; // picking the same file again should still fire
          }}
        />
      </div>
    </div>
  );
}
