import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API base URL. EXPO_PUBLIC_API_URL wins; otherwise, in development the app talks to port 4001 on
 * the machine running Metro (so Expo Go on a phone on the same Wi-Fi reaches the local API).
 */
function resolveApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  if (Platform.OS === 'web') return 'http://localhost:4001/api';
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:4001/api`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:4001/api' : 'http://localhost:4001/api';
}

export const API_URL = resolveApiUrl();
export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
export const EAS_PROJECT_ID: string | undefined =
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
