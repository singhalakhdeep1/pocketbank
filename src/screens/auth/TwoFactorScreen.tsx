import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Snackbar, Text, TextInput } from 'react-native-paper';
import type { AuthScreenProps } from '@/navigation/types';
import { useAppDispatch, useAppSelector } from '@/store';
import { cancelTwoFactor, clearError, verifyTwoFactor } from '@/store/slices/authSlice';
import { colors } from '@/theme';

export default function TwoFactorScreen({ navigation }: AuthScreenProps<'TwoFactor'>) {
  const dispatch = useAppDispatch();
  const { loading, error, challengeToken } = useAppSelector((s) => s.auth);
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!challengeToken) navigation.goBack();
  }, [challengeToken, navigation]);

  return (
    <View style={styles.container}>
      <Text variant="titleLarge" style={styles.title}>
        Two-factor authentication
      </Text>
      <Text style={styles.muted}>Enter the 6-digit code from your authenticator app.</Text>
      <TextInput
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        mode="outlined"
        keyboardType="number-pad"
        autoFocus
        style={styles.code}
        placeholder="123456"
        testID="totp-code"
      />
      <Button mode="contained" disabled={code.length !== 6 || loading} loading={loading} onPress={() => dispatch(verifyTwoFactor(code))} testID="totp-submit">
        Verify
      </Button>
      <Button onPress={() => dispatch(cancelTwoFactor())} style={{ marginTop: 12 }}>
        Cancel
      </Button>
      <Snackbar visible={Boolean(error)} onDismiss={() => dispatch(clearError())}>
        {error ?? ''}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.background, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { fontWeight: '700', marginTop: 24 },
  muted: { color: colors.muted, marginVertical: 12 },
  code: { fontSize: 28, letterSpacing: 8, textAlign: 'center', marginBottom: 16 },
});
