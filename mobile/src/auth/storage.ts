import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// The APK uses Android Keystore-backed storage. Browser previews are temporary.
const previewStorage = new Map<string, string>();
export const storage = {
  get: (key: string): Promise<string | null> => Platform.OS === 'web'
    ? Promise.resolve(previewStorage.get(key) ?? null)
    : SecureStore.getItemAsync(key),
  set: (key: string, value: string): Promise<void> => Platform.OS === 'web'
    ? Promise.resolve(void previewStorage.set(key, value))
    : SecureStore.setItemAsync(key, value),
  remove: (key: string): Promise<void> => Platform.OS === 'web'
    ? Promise.resolve(void previewStorage.delete(key))
    : SecureStore.deleteItemAsync(key),
};
