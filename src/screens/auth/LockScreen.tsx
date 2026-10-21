import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar, Button, Text } from 'react-native-paper';
import { useAppDispatch, useAppSelector } from '@/store';
import { showPasswordLogin, unlockWithBiometric } from '@/store/slices/authSlice';
import { colors } from '@/theme';
import { biometricKind, type BiometricKind } from '@/utils/biometric';

/** Shown on launch / after a minute in the background when biometric unlock is enabled. */
export default function LockScreen() {
  const dispatch = useAppDispatch();
  const error = useAppSelector((s) => s.auth.error);
  const [kind, setKind] = useState<BiometricKind>(null);

  useEffect(() => {
    void biometricKind().then(setKind);
    void dispatch(unlockWithBiometric());
  }, [dispatch]);

  return (
    <View style={styles.container}>
      <Avatar.Icon size={88} icon={kind === 'face' ? 'face-recognition' : 'fingerprint'} style={{ backgroundColor: colors.primary }} />
      <Text variant="headlineSmall" style={styles.title}>
        PocketBank is locked
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button mode="contained" icon={kind === 'face' ? 'face-recognition' : 'fingerprint'} onPress={() => dispatch(unlockWithBiometric())} style={styles.button}>
        {kind === 'face' ? 'Unlock with Face ID' : 'Unlock'}
      </Button>
      <Button onPress={() => dispatch(showPasswordLogin())}>Use password instead</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  title: { marginTop: 20, fontWeight: '700' },
  error: { color: colors.negative, marginTop: 12, textAlign: 'center' },
  button: { marginTop: 24, marginBottom: 8, minWidth: 220 },
});
