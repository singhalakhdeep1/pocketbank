import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { AccountPicker, Field, Screen, useToast } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import type { MainScreenProps } from '@/navigation/types';
import { bank } from '@/services/bank';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchAccounts } from '@/store/slices/accountsSlice';
import { colors } from '@/theme';
import { money, parseAmount } from '@/utils/format';
import { cardPaymentsSupported, payWithPaymentSheet } from '@/utils/stripePay';

/** Add money with a debit/credit card through Stripe (PaymentSheet on iOS/Android). */
export default function TopUpScreen({ route, navigation }: MainScreenProps<'TopUp'>) {
  const dispatch = useAppDispatch();
  const accounts = useAppSelector((s) => s.accounts.accounts);
  const { data: meta } = useApi(() => bank.meta());
  const [accountId, setAccountId] = useState<string | null>(route.params?.accountId ?? accounts[0]?.id ?? null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const value = parseAmount(amount);

  const topUp = async () => {
    if (!accountId || !value) return;
    setBusy(true);
    try {
      const intent = await bank.topup.intent(accountId, value);
      const sheet = await payWithPaymentSheet(intent.clientSecret, intent.publishableKey);
      if (!sheet.ok) {
        toast.show(sheet.message ?? 'Payment cancelled');
        return;
      }
      // The webhook credits the account; confirm as well in case it has not arrived yet.
      const res = await bank.topup.confirm(intent.paymentIntentId);
      toast.show(res.credited ? `${money(value)} added` : 'Payment processing — it will appear shortly');
      void dispatch(fetchAccounts());
      setTimeout(() => navigation.goBack(), 1200);
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sandbox = async () => {
    if (!accountId || !value) return;
    setBusy(true);
    try {
      await bank.accounts.deposit(accountId, value);
      toast.show(`Sandbox: ${money(value)} added`);
      void dispatch(fetchAccounts());
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen testID="topup">
        <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} label="Add money to" />
        <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" testID="topup-amount" />
        <Button mode="contained" icon="credit-card-outline" disabled={!value || busy || !cardPaymentsSupported || !meta?.features.cardTopUps} loading={busy} onPress={topUp}>
          Pay with card
        </Button>
        {!cardPaymentsSupported || !meta?.features.cardTopUps ? (
          <Text style={styles.muted}>{!cardPaymentsSupported ? 'Card payments run in the iOS/Android app.' : 'Card top-ups are not configured on this server.'}</Text>
        ) : null}
        {meta?.features.sandboxDeposits ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={{ fontWeight: '700' }}>Sandbox</Text>
              <Text style={styles.muted}>This server allows test deposits without a card.</Text>
              <Button mode="outlined" icon="flask-outline" onPress={sandbox} disabled={!value || busy} style={{ marginTop: 8 }} testID="topup-sandbox">
                Add test funds
              </Button>
            </Card.Content>
          </Card>
        ) : null}
      </Screen>
      {toast.node}
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.muted, marginTop: 8 },
  card: { marginTop: 20, backgroundColor: colors.surface },
});
