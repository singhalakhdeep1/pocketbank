import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChipGroup, ErrorBanner, Screen, useToast } from '@/components/ui';
import type { MainStackParamList, TabParamList } from '@/navigation/types';
import { accountService } from '@/services/accountService';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchAccounts } from '@/store/slices/accountsSlice';
import { colors } from '@/theme';
import { money, titleCase } from '@/utils/format';

type Props = CompositeScreenProps<BottomTabScreenProps<TabParamList, 'Accounts'>, NativeStackScreenProps<MainStackParamList>>;

const TYPES = ['CHECKING', 'SAVINGS', 'BUSINESS'] as const;
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'] as const;

export default function AccountsScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const { accounts, loading, error } = useAppSelector((state) => state.accounts);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<(typeof TYPES)[number]>('SAVINGS');
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>('USD');
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useFocusEffect(
    React.useCallback(() => {
      void dispatch(fetchAccounts());
    }, [dispatch]),
  );

  const totals = accounts.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.currency]: (acc[a.currency] ?? 0) + a.balance }), {});

  const create = async () => {
    setSaving(true);
    try {
      await accountService.createAccount({ accountType: type, currency, nickname: nickname || undefined });
      setOpen(false);
      setNickname('');
      toast.show('Account opened');
      void dispatch(fetchAccounts());
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={loading} onRefresh={() => dispatch(fetchAccounts())} testID="accounts">
        <ErrorBanner error={error} onRetry={() => dispatch(fetchAccounts())} />
        <View style={styles.totals}>
          {Object.entries(totals).map(([cur, total]) => (
            <Chip key={cur} icon="cash" style={styles.totalChip}>
              {money(total, cur)}
            </Chip>
          ))}
        </View>
        {accounts.map((item) => (
          <Card key={item.id} style={styles.card} onPress={() => navigation.navigate('AccountDetail', { accountId: item.id })} testID={`account-${item.accountNumber}`}>
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleMedium" style={styles.bold}>
                  {item.nickname || titleCase(item.accountType)}
                </Text>
                <Chip compact style={{ backgroundColor: item.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2' }}>
                  {item.status}
                </Chip>
              </View>
              <Text style={styles.muted}>
                {titleCase(item.accountType)} · {item.accountNumber}
                {item.interestRate ? ` · ${(item.interestRate * 100).toFixed(2)}% APY` : ''}
              </Text>
              <Text style={styles.balance}>{money(item.balance, item.currency)}</Text>
            </Card.Content>
            <Card.Actions>
              <Button onPress={() => navigation.navigate('Transactions', { accountId: item.id })}>History</Button>
              <Button onPress={() => navigation.navigate('Transfer', { fromAccountId: item.id })}>Transfer</Button>
            </Card.Actions>
          </Card>
        ))}
        <Button mode="contained" icon="plus" style={{ marginTop: 8 }} onPress={() => setOpen(true)} testID="open-account">
          Open new account
        </Button>
      </Screen>
      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)}>
          <Dialog.Title>Open an account</Dialog.Title>
          <Dialog.Content>
            <ChipGroup options={TYPES} value={type} onChange={setType} labels={{ CHECKING: 'Checking', SAVINGS: 'Savings', BUSINESS: 'Business' }} />
            <ChipGroup options={CURRENCIES} value={currency} onChange={setCurrency} />
            <TextInput label="Nickname (optional)" value={nickname} onChangeText={setNickname} mode="outlined" />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOpen(false)}>Cancel</Button>
            <Button mode="contained" loading={saving} onPress={create} testID="create-account">
              Open
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      {toast.node}
    </View>
  );
}

const styles = StyleSheet.create({
  totals: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  totalChip: { marginRight: 8, marginBottom: 8 },
  card: { marginBottom: 10, backgroundColor: colors.surface },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bold: { fontWeight: '700' },
  muted: { color: colors.muted, marginTop: 2 },
  balance: { fontSize: 26, fontWeight: 'bold', marginTop: 8 },
});
