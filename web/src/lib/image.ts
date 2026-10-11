const AVATAR_PX = 256;

/**
 * Turns a picked photo into what the board stores: a square, centre-cropped 256 px JPEG data URL
 * (a few tens of KB), so uploads are instant and every list stays light.
 */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Pick an image file.');

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error('That image could not be read. Try a JPG or PNG.');
    }

    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error('That image could not be read. Try a JPG or PNG.');

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_PX;
    canvas.height = AVATAR_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser cannot process images.');
    ctx.fillStyle = '#ffffff'; // transparent PNGs would turn black as JPEG
    ctx.fillRect(0, 0, AVATAR_PX, AVATAR_PX);
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_PX,
      AVATAR_PX,
    );
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
