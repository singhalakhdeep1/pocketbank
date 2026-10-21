import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Button, HelperText, Snackbar, Text, TextInput } from 'react-native-paper';
import type { AuthScreenProps } from '@/navigation/types';
import { useAppDispatch, useAppSelector } from '@/store';
import { clearError, register } from '@/store/slices/authSlice';
import { colors } from '@/theme';

export default function RegisterScreen({ navigation }: AuthScreenProps<'Register'>) {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.auth);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '' });
  const set = (field: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [field]: value }));

  const passwordOk = form.password.length >= 8 && /[A-Za-z]/.test(form.password) && /\d/.test(form.password);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const valid = passwordOk && emailOk && form.firstName.trim() && form.lastName.trim();

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>A checking and a savings account are opened for you.</Text>
        <TextInput label="First name" value={form.firstName} onChangeText={set('firstName')} mode="outlined" style={styles.input} testID="reg-first" />
        <TextInput label="Last name" value={form.lastName} onChangeText={set('lastName')} mode="outlined" style={styles.input} testID="reg-last" />
        <TextInput label="Email" value={form.email} onChangeText={set('email')} mode="outlined" keyboardType="email-address" autoCapitalize="none" style={styles.input} testID="reg-email" />
        <TextInput label="Phone (optional)" value={form.phone} onChangeText={set('phone')} mode="outlined" keyboardType="phone-pad" style={styles.input} />
        <TextInput label="Password" value={form.password} onChangeText={set('password')} mode="outlined" secureTextEntry style={styles.input} testID="reg-password" />
        <HelperText type={passwordOk || !form.password ? 'info' : 'error'}>At least 8 characters with a letter and a number</HelperText>
        <Button mode="contained" onPress={() => dispatch(register({ ...form, email: form.email.trim() }))} loading={loading} disabled={loading || !valid} style={styles.button} testID="reg-submit">
          Create account
        </Button>
        <Button mode="text" onPress={() => navigation.navigate('Login')} style={{ marginTop: 16 }}>
          Already have an account? Sign in
        </Button>
      </ScrollView>
      <Snackbar visible={Boolean(error)} onDismiss={() => dispatch(clearError())} duration={5000}>
        {error ?? ''}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { fontSize: 30, textAlign: 'center', marginTop: 40, color: colors.primary, fontWeight: 'bold' },
  subtitle: { textAlign: 'center', marginBottom: 24, marginTop: 6, color: colors.muted },
  input: { marginBottom: 12 },
  button: { marginTop: 8 },
});
