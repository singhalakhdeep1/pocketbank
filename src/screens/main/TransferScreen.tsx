import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { AccountPicker, ConfirmDialog, Field, Screen, useToast } from '@/components/ui';
import type { MainScreenProps } from '@/navigation/types';
import { bank } from '@/services/bank';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchAccounts } from '@/store/slices/accountsSlice';
import { colors } from '@/theme';
import { accountLabel, money, parseAmount } from '@/utils/format';

/** Move money between the customer's own accounts (converts currency when they differ). */
export default function TransferScreen({ route, navigation }: MainScreenProps<'Transfer'>) {
  const dispatch = useAppDispatch();
  const accounts = useAppSelector((s) => s.accounts.accounts);
  const [from, setFrom] = useState<string | null>(route.params?.fromAccountId ?? null);
  const [to, setTo] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useFocusEffect(
    React.useCallback(() => {
      void dispatch(fetchAccounts());
    }, [dispatch]),
  );

  const source = accounts.find((a) => a.id === (from ?? accounts[0]?.id));
  const target = accounts.find((a) => a.id === to);
  const value = parseAmount(amount);
  const tooMuch = Boolean(value && source && value > source.balance);

  const submit = async () => {
    if (!source || !target || !value) return;
    setBusy(true);
    try {
      const res = await bank.transfers.internal({ fromAccountId: source.id, toAccountId: target.id, amount: value, note: note || undefined });
      setConfirm(false);
      toast.show(res.fxRate !== 1 ? `Sent. ${money(res.creditedAmount, target.currency)} arrived (rate ${res.fxRate.toFixed(4)})` : 'Transfer complete');
      void dispatch(fetchAccounts());
      setTimeout(() => navigation.goBack(), 900);
    } catch (err) {
      setConfirm(false);
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen testID="transfer">
        <AccountPicker accounts={accounts} value={source?.id ?? null} onChange={setFrom} label="From" />
        <AccountPicker accounts={accounts} value={to} onChange={setTo} label="To" filter={(a) => a.id !== source?.id} />
        <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" error={tooMuch ? 'More than the available balance' : null} testID="transfer-amount" />
        <Field label="Note (optional)" value={note} onChangeText={setNote} />
        {source && target && source.currency !== target.currency ? <Text style={styles.muted}>Converted from {source.currency} to {target.currency} at today's rate.</Text> : null}
        <Button mode="contained" disabled={!source || !target || !value || tooMuch} onPress={() => setConfirm(true)} style={{ marginTop: 12 }} testID="transfer-submit">
          Review transfer
        </Button>
      </Screen>
      <ConfirmDialog
        visible={confirm}
        title="Confirm transfer"
        body={source && target && value ? `${money(value, source.currency)}\nfrom ${accountLabel(source)}\nto ${accountLabel(target)}` : ''}
        confirmLabel="Send"
        loading={busy}
        onDismiss={() => setConfirm(false)}
        onConfirm={submit}
      />
      {toast.node}
    </View>
  );
}

const styles = StyleSheet.create({ muted: { color: colors.muted, marginBottom: 8 } });
