import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type BiometricKind = 'face' | 'fingerprint' | 'iris' | null;

/** True when the device has Face ID / fingerprint hardware with at least one enrolled biometric. */
export const checkBiometricSupport = async (): Promise<boolean> => {
  if (Platform.OS === 'web') return false;
  const [compatible, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
  return compatible && enrolled;
};

export const biometricKind = async (): Promise<BiometricKind> => {
  if (Platform.OS === 'web') return null;
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'face';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'fingerprint';
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'iris';
  return null;
};

export const authenticateWithBiometric = async (promptMessage = 'Authenticate to access PocketBank'): Promise<boolean> => {
  if (Platform.OS === 'web') return false;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
};
