import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Tokens and wallet keys live in the iOS Keychain / Android Keystore through SecureStore. The web
 * build (used for development and browser testing) has no secure enclave, so it falls back to
 * localStorage.
 */
const web = Platform.OS === 'web';

export async function getItem(key: string): Promise<string | null> {
  if (web) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string, options?: { requireAuthentication?: boolean }): Promise<void> {
  if (web) {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    requireAuthentication: options?.requireAuthentication,
  });
}

export async function deleteItem(key: string): Promise<void> {
  if (web) {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const KEYS = {
  accessToken: 'pb.accessToken',
  refreshToken: 'pb.refreshToken',
  deviceId: 'pb.deviceId',
  walletKey: 'pb.walletPrivateKey',
} as const;
