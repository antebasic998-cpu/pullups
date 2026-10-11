import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const AVATAR_PX = 256;

/**
 * Lets the user pick a photo from the gallery and returns a local file URI of a square, centre-cropped
 * 256 px JPEG (a few tens of KB) – exactly what the board stores. Returns null if they back out.
 */
export async function pickAvatarPhoto(): Promise<string | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (picked.canceled || picked.assets.length === 0) return null;

  const asset = picked.assets[0];
  const side = Math.min(asset.width, asset.height);
  const ctx = ImageManipulator.ImageManipulator.manipulate(asset.uri).crop({
    originX: Math.floor((asset.width - side) / 2),
    originY: Math.floor((asset.height - side) / 2),
    width: side,
    height: side,
  });
  const rendered = await ctx.resize({ width: AVATAR_PX, height: AVATAR_PX }).renderAsync();
  const saved = await rendered.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.85 });
  return saved.uri;
}
