import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_KEY = '@pullup/unlocked_v1';

export async function isAppUnlocked(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(ACCESS_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function setAppUnlocked(): Promise<void> {
  try {
    await AsyncStorage.setItem(ACCESS_KEY, 'true');
  } catch (err) {
    console.error('Failed to save unlock state:', err);
  }
}

export async function clearAppUnlocked(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACCESS_KEY);
  } catch (err) {
    console.error('Failed to clear unlock state:', err);
  }
}
