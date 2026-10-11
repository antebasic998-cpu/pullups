import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { pickAvatarPhoto } from '../lib/photo';
import { useTheme } from '../lib/ThemeContext';
import { Avatar } from './Bits';
import { Button } from './Button';

/**
 * Photo field for the athlete form. Nothing is uploaded here: it only reports the staged choice
 * (a local file for a new photo, or removal) and the form saves it together with the athlete.
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
  /** Local file of a newly picked photo, not saved yet. */
  staged: string | null;
  /** The saved photo is going to be removed on save. */
  removed: boolean;
  /** The athlete currently has a saved photo. */
  hasPhoto: boolean;
  onPick: (fileUri: string) => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function choose() {
    setError(null);
    setBusy(true);
    try {
      const uri = await pickAvatarPhoto();
      if (uri) onPick(uri);
    } catch {
      setError('Could not use that photo. Try another one, or restart the app.');
    } finally {
      setBusy(false);
    }
  }

  const showsPhoto = Boolean(staged) || (hasPhoto && !removed);

  return (
    <View style={styles.wrap}>
      <Avatar name={name.trim() || '?'} size={72} userId={removed ? null : userId} url={staged} />
      <View style={styles.actions}>
        <View style={styles.row}>
          <Button label={showsPhoto ? 'Change photo' : 'Add photo'} onPress={choose} small loading={busy} disabled={busy} />
          {showsPhoto ? <Button label="Remove" onPress={onRemove} small disabled={busy} /> : null}
        </View>
        <Text style={{ color: colors.faint, fontSize: 12 }}>Optional. Cropped to a square.</Text>
        {error ? <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  actions: { flex: 1, gap: 8 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
