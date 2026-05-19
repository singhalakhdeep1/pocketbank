import * as LocalAuthentication from 'expo-local-authentication';

export const checkBiometricSupport = async (): Promise<boolean> => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
};

export const authenticateWithBiometric = async (): Promise<boolean> => {
    try {
        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Authenticate to access SecureBank',
            fallbackLabel: 'Use Passcode',
            disableDeviceFallback: false,
        });
        return result.success;
    } catch (error) {
        console.error('Biometric authentication error:', error);
        return false;
    }
};
