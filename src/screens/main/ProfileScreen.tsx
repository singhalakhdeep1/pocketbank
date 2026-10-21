import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Divider, List, Switch, Text, TextInput } from 'react-native-paper';
import { Screen, Section, useToast } from '@/components/ui';
import type { MainScreenProps } from '@/navigation/types';
import { bank } from '@/services/bank';
import { useAppDispatch, useAppSelector } from '@/store';
import { logout, setUser } from '@/store/slices/authSlice';
import { colors } from '@/theme';
import { registerForPushNotifications } from '@/utils/notifications';
import { ChipGroup } from '@/components/ui';

const LANGUAGES = ['en', 'es', 'fr', 'de', 'hi'] as const;
const LANGUAGE_NAMES = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', hi: 'हिन्दी' };

export default function ProfileScreen({ navigation }: MainScreenProps<'Profile'>) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', phone: user?.phone ?? '' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (!user) return null;

  const update = async (patch: Parameters<typeof bank.profile.update>[0], ok = 'Saved') => {
    setBusy(true);
    try {
      dispatch(setUser(await bank.profile.update(patch)));
      toast.show(ok);
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const enablePush = async () => {
    const res = await registerForPushNotifications();
    if (res.status === 'registered') {
      dispatch(setUser({ ...user, pushRegistered: true }));
      toast.show('Push notifications on');
    } else toast.show(res.reason);
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen testID="profile">
        <Section title="Personal details" right={<Button compact onPress={() => setEditing((e) => !e)}>{editing ? 'Cancel' : 'Edit'}</Button>}>
          {editing ? (
            <>
              <TextInput label="First name" value={form.firstName} onChangeText={(v) => setForm({ ...form, firstName: v })} mode="outlined" dense style={{ marginBottom: 8 }} />
              <TextInput label="Last name" value={form.lastName} onChangeText={(v) => setForm({ ...form, lastName: v })} mode="outlined" dense style={{ marginBottom: 8 }} />
              <TextInput label="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} mode="outlined" dense keyboardType="phone-pad" testID="profile-phone" />
              <Button mode="contained" loading={busy} style={{ marginTop: 8 }} onPress={() => update({ firstName: form.firstName, lastName: form.lastName, phone: form.phone || null }).then(() => setEditing(false))} testID="profile-save">
                Save
              </Button>
            </>
          ) : (
            <>
              <List.Item title="Name" description={`${user.firstName} ${user.lastName}`} left={(p) => <List.Icon {...p} icon="account" />} />
              <Divider />
              <List.Item title="Email" description={user.email} left={(p) => <List.Icon {...p} icon="email" />} />
              <Divider />
              <List.Item title="Phone" description={user.phone || 'Not provided'} left={(p) => <List.Icon {...p} icon="phone" />} />
            </>
          )}
        </Section>

        <Section title="Notifications">
          <List.Item
            title="Push notifications"
            description={user.pushRegistered ? 'This device receives alerts' : 'Not set up on this device'}
            left={(p) => <List.Icon {...p} icon="bell-ring-outline" />}
            right={() => (user.pushRegistered ? <Text style={{ color: colors.positive, alignSelf: 'center' }}>On</Text> : <Button compact onPress={enablePush}>Enable</Button>)}
          />
          <List.Item title="Transaction alerts" left={(p) => <List.Icon {...p} icon="swap-horizontal" />} right={() => <Switch value={user.notifications.transactions} onValueChange={(v) => update({ notifications: { transactions: v } })} />} />
          <List.Item title="Security alerts" left={(p) => <List.Icon {...p} icon="shield-alert-outline" />} right={() => <Switch value={user.notifications.security} onValueChange={(v) => update({ notifications: { security: v } })} />} />
          <List.Item title="Budget & bill alerts" left={(p) => <List.Icon {...p} icon="wallet-outline" />} right={() => <Switch value={user.notifications.budget} onValueChange={(v) => update({ notifications: { budget: v } })} />} />
        </Section>

        <Section title="Language">
          <ChipGroup options={LANGUAGES} value={(user.language as (typeof LANGUAGES)[number]) ?? 'en'} onChange={(v) => update({ language: v }, 'Language saved')} labels={LANGUAGE_NAMES} />
        </Section>

        <List.Item title="Security settings" description="Biometrics, 2FA, password, sessions" left={(p) => <List.Icon {...p} icon="shield-lock-outline" />} right={(p) => <List.Icon {...p} icon="chevron-right" />} onPress={() => navigation.navigate('Security')} />
        <Button mode="contained" icon="logout" buttonColor={colors.secondary} style={{ marginTop: 20 }} onPress={() => dispatch(logout())}>
          Sign out
        </Button>
      </Screen>
      {toast.node}
    </View>
  );
}
