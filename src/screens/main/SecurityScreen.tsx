import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, List, Portal, Switch, Text, TextInput } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Screen, Section, useToast } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { saveSession } from '@/services/api';
import { bank } from '@/services/bank';
import { useAppDispatch, useAppSelector } from '@/store';
import { logout, refreshProfile, setBiometricPreference } from '@/store/slices/authSlice';
import { colors } from '@/theme';
import { checkBiometricSupport } from '@/utils/biometric';
import { longDate } from '@/utils/format';

export default function SecurityScreen() {
  const dispatch = useAppDispatch();
  const { user, biometricEnabled } = useAppSelector((s) => s.auth);
  const [bioSupported, setBioSupported] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [disableOpen, setDisableOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { data: log, reload: reloadLog } = useApi(() => bank.profile.securityLog());

  useEffect(() => {
    void checkBiometricSupport().then(setBioSupported);
  }, []);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.show(ok);
      void dispatch(refreshProfile());
      void reloadLog();
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen testID="security">
        <Section title="Sign-in">
          <List.Item
            title="Biometric unlock"
            description={bioSupported ? 'Face ID / fingerprint to open the app and sign transfers' : 'Not available on this device'}
            left={(p) => <List.Icon {...p} icon="fingerprint" />}
            right={() => <Switch disabled={!bioSupported} value={biometricEnabled} onValueChange={(v) => void dispatch(setBiometricPreference(v))} />}
            style={styles.item}
          />
          <List.Item
            title="Two-factor authentication"
            description={user?.twoFactorEnabled ? 'On — codes from your authenticator app' : 'Off'}
            left={(p) => <List.Icon {...p} icon="shield-check" />}
            right={() =>
              user?.twoFactorEnabled ? (
                <Button compact onPress={() => (setCode(''), setCurrent(''), setDisableOpen(true))}>
                  Turn off
                </Button>
              ) : (
                <Button compact onPress={() => run(async () => setSetup(await bank.security.setup2fa()), 'Scan the code in your authenticator app')} testID="setup-2fa">
                  Set up
                </Button>
              )
            }
            style={styles.item}
          />
          <List.Item title="Change password" left={(p) => <List.Icon {...p} icon="lock-reset" />} right={(p) => <List.Icon {...p} icon="chevron-right" />} onPress={() => setPwOpen(true)} style={styles.item} />
          <List.Item
            title="Sign out everywhere"
            description="Ends sessions on all devices"
            left={(p) => <List.Icon {...p} icon="logout-variant" />}
            onPress={() =>
              run(async () => {
                await bank.security.logoutAll();
                await dispatch(logout());
              }, 'All sessions ended')
            }
            style={styles.item}
          />
        </Section>

        {setup ? (
          <Section title="Finish 2FA setup">
            <View style={styles.qr}>
              <QRCode value={setup.otpauthUrl} size={180} />
            </View>
            <Text selectable style={styles.secret} onPress={() => Clipboard.setStringAsync(setup.secret)} testID="totp-secret">
              {setup.secret}
            </Text>
            <TextInput label="6-digit code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" mode="outlined" testID="totp-enable-code" />
            <Button
              mode="contained"
              style={{ marginTop: 8 }}
              disabled={code.length !== 6}
              loading={busy}
              onPress={() =>
                run(async () => {
                  await bank.security.enable2fa(code);
                  setSetup(null);
                  setCode('');
                }, 'Two-factor authentication is on')
              }
              testID="enable-2fa"
            >
              Turn on 2FA
            </Button>
          </Section>
        ) : null}

        <Section title="Recent security activity">
          {log?.map((e) => (
            <List.Item key={e.id} title={e.description} description={longDate(e.createdAt)} left={(p) => <List.Icon {...p} icon="history" />} />
          ))}
        </Section>
      </Screen>

      <Portal>
        <Dialog visible={disableOpen} onDismiss={() => setDisableOpen(false)}>
          <Dialog.Title>Turn off 2FA</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Password" secureTextEntry value={current} onChangeText={setCurrent} mode="outlined" style={{ marginBottom: 8 }} />
            <TextInput label="Authenticator code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" mode="outlined" />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDisableOpen(false)}>Cancel</Button>
            <Button mode="contained" loading={busy} onPress={() => run(async () => (await bank.security.disable2fa(code, current), setDisableOpen(false)), '2FA turned off')}>
              Turn off
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={pwOpen} onDismiss={() => setPwOpen(false)}>
          <Dialog.Title>Change password</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Current password" secureTextEntry value={current} onChangeText={setCurrent} mode="outlined" style={{ marginBottom: 8 }} />
            <TextInput label="New password (8+ chars, letter & number)" secureTextEntry value={next} onChangeText={setNext} mode="outlined" />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPwOpen(false)}>Cancel</Button>
            <Button
              mode="contained"
              loading={busy}
              onPress={() =>
                run(async () => {
                  const tokens = await bank.security.changePassword(current, next);
                  await saveSession(tokens.accessToken, tokens.refreshToken);
                  setPwOpen(false);
                  setCurrent('');
                  setNext('');
                }, 'Password changed; other devices were signed out')
              }
            >
              Change
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      {toast.node}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { backgroundColor: colors.surface, borderRadius: 12, marginBottom: 6 },
  qr: { alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 12 },
  secret: { textAlign: 'center', letterSpacing: 2, color: colors.muted, marginVertical: 10 },
});
