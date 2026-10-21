import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, Snackbar, Text, TextInput } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { AuthScreenProps } from '@/navigation/types';
import { KEYS, getItem } from '@/services/secureStorage';
import { useAppDispatch, useAppSelector } from '@/store';
import { clearError, login, unlockWithBiometric } from '@/store/slices/authSlice';
import { colors } from '@/theme';
import { biometricKind, checkBiometricSupport } from '@/utils/biometric';

export default function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const dispatch = useAppDispatch();
  const { loading, error, challengeToken, biometricEnabled } = useAppSelector((state) => state.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      // "Unlock with Face ID" is offered when a saved session exists and biometric unlock is on.
      void (async () => {
        const [supported, session, kind] = await Promise.all([checkBiometricSupport(), getItem(KEYS.refreshToken), biometricKind()]);
        setBiometricLabel(supported && session && biometricEnabled ? (kind === 'face' ? 'Unlock with Face ID' : 'Unlock with fingerprint') : null);
      })();
    }, [biometricEnabled]),
  );

  useEffect(() => {
    if (challengeToken) navigation.navigate('TwoFactor');
  }, [challengeToken, navigation]);

  const submit = () => dispatch(login({ email: email.trim(), password }));

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <Text style={styles.logo}>PocketBank</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        <TextInput label="Email" value={email} onChangeText={setEmail} mode="outlined" keyboardType="email-address" autoCapitalize="none" autoComplete="email" style={styles.input} testID="login-email" />
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          secureTextEntry={!showPassword}
          autoComplete="password"
          right={<TextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword((v) => !v)} />}
          onSubmitEditing={submit}
          style={styles.input}
          testID="login-password"
        />
        <Button mode="contained" onPress={submit} loading={loading} disabled={loading || !email || !password} style={styles.button} testID="login-submit">
          Sign in
        </Button>
        {biometricLabel ? (
          <Button mode="outlined" icon="fingerprint" onPress={() => dispatch(unlockWithBiometric())} style={styles.button}>
            {biometricLabel}
          </Button>
        ) : null}
        <Button mode="text" onPress={() => navigation.navigate('Register')} style={{ marginTop: 16 }} testID="go-register">
          Don't have an account? Sign up
        </Button>
      </View>
      <Snackbar visible={Boolean(error)} onDismiss={() => dispatch(clearError())} duration={4000}>
        {error ?? ''}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', padding: 24, maxWidth: 480, width: '100%', alignSelf: 'center' },
  logo: { fontSize: 34, textAlign: 'center', marginBottom: 6, color: colors.primary, fontWeight: 'bold' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 28, color: colors.muted },
  input: { marginBottom: 14 },
  button: { marginTop: 8 },
});
