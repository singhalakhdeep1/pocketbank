import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Chip, SegmentedButtons, Text } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { AccountPicker, ConfirmDialog, Field, Screen, Section, useToast } from '@/components/ui';
import type { MainScreenProps } from '@/navigation/types';
import { bank } from '@/services/bank';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchAccounts } from '@/store/slices/accountsSlice';
import { colors } from '@/theme';
import type { Payee } from '@/types';
import { money, parseAmount } from '@/utils/format';

/** Send money to another PocketBank customer by account number or email. */
export default function P2PTransfers({ route, navigation }: MainScreenProps<'P2PTransfers'>) {
  const dispatch = useAppDispatch();
  const accounts = useAppSelector((s) => s.accounts.accounts);
  const [mode, setMode] = useState<'account' | 'email'>('account');
  const [recipient, setRecipient] = useState(route.params?.accountNumber ?? '');
  const [amount, setAmount] = useState(route.params?.amount ? String(route.params.amount) : '');
  const [note, setNote] = useState('');
  const [from, setFrom] = useState<string | null>(null);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [lookup, setLookup] = useState<{ name: string; isOwnAccount: boolean } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useFocusEffect(
    React.useCallback(() => {
      void dispatch(fetchAccounts());
      void bank.transfers.payees().then(setPayees).catch(() => undefined);
    }, [dispatch]),
  );

  // Show who the money goes to before sending (masked name from the API).
  useEffect(() => {
    setLookup(null);
    setLookupError(null);
    const value = recipient.trim();
    const ready = mode === 'account' ? /^\d{10}$/.test(value) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (!ready) return;
    const t = setTimeout(() => {
      bank.transfers
        .lookup(mode === 'account' ? { accountNumber: value } : { email: value })
        .then((r) => setLookup(r))
        .catch((e: Error) => setLookupError(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [recipient, mode]);

  const source = accounts.find((a) => a.id === (from ?? accounts.find((x) => x.accountType === 'CHECKING')?.id ?? accounts[0]?.id));
  const value = parseAmount(amount);
  const tooMuch = Boolean(value && source && value > source.balance);

  const send = async () => {
    if (!source || !value) return;
    setBusy(true);
    try {
      const res = await bank.transfers.p2p({ fromAccountId: source.id, amount: value, note: note || undefined, ...(mode === 'account' ? { toAccount: recipient.trim() } : { toEmail: recipient.trim() }) });
      setConfirm(false);
      toast.show(`Sent ${money(value, source.currency)} to ${res.recipient.name}`);
      setAmount('');
      setNote('');
      void dispatch(fetchAccounts());
      setTimeout(() => navigation.goBack(), 1000);
    } catch (err) {
      setConfirm(false);
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen testID="p2p">
        <View style={styles.balance}>
          <Text style={styles.balanceLabel}>Available</Text>
          <Text style={styles.balanceValue}>{money(source?.balance ?? 0, source?.currency)}</Text>
        </View>
        <AccountPicker accounts={accounts} value={source?.id ?? null} onChange={setFrom} />
        <SegmentedButtons
          value={mode}
          onValueChange={(v) => (setMode(v as typeof mode), setRecipient(''))}
          buttons={[
            { value: 'account', label: 'Account number', icon: 'pound' },
            { value: 'email', label: 'Email', icon: 'email-outline' },
          ]}
          style={{ marginBottom: 12 }}
        />
        <Field
          label={mode === 'account' ? 'Recipient account number' : 'Recipient email'}
          value={recipient}
          onChangeText={setRecipient}
          keyboardType={mode === 'account' ? 'number-pad' : 'email-address'}
          autoCapitalize="none"
          error={lookupError}
          testID="p2p-recipient"
        />
        {lookup ? (
          <Chip icon={lookup.isOwnAccount ? 'account' : 'check-circle'} style={styles.lookup} testID="p2p-lookup">
            {lookup.isOwnAccount ? 'This is your own account' : `Paying ${lookup.name}`}
          </Chip>
        ) : null}
        <Field label="Amount" value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" error={tooMuch ? 'Insufficient balance' : null} testID="p2p-amount" />
        <View style={styles.quick}>
          {[10, 25, 50, 100].map((v) => (
            <Chip key={v} onPress={() => setAmount(String(v))} style={styles.quickChip}>
              ${v}
            </Chip>
          ))}
        </View>
        <Field label="Note (optional)" value={note} onChangeText={setNote} />

        {payees.length ? (
          <Section title="Recent contacts">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {payees.map((p) => (
                <Button key={p.id} onPress={() => (setMode('account'), setRecipient(p.accountNumber))} style={styles.contact} contentStyle={{ flexDirection: 'column' }} testID={`payee-${p.accountNumber}`}>
                  <Avatar.Text size={40} label={p.name.split(' ').map((s) => s[0]).join('').slice(0, 2)} />
                  {'\n'}
                  {p.name.split(' ')[0]}
                </Button>
              ))}
            </ScrollView>
          </Section>
        ) : null}

        <Button mode="contained" icon="send" style={{ marginTop: 16 }} disabled={!value || !recipient || tooMuch || Boolean(lookupError)} onPress={() => setConfirm(true)} testID="p2p-submit">
          Send money
        </Button>
        <Button icon="qrcode-scan" style={{ marginTop: 8 }} onPress={() => navigation.navigate('QRScan')}>
          Scan a QR code instead
        </Button>
      </Screen>
      <ConfirmDialog
        visible={confirm}
        title="Send money?"
        body={`${money(value ?? 0, source?.currency)} to ${lookup?.name ?? recipient}${note ? `\n“${note}”` : ''}`}
        confirmLabel="Send"
        loading={busy}
        onDismiss={() => setConfirm(false)}
        onConfirm={send}
      />
      {toast.node}
    </View>
  );
}

const styles = StyleSheet.create({
  balance: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, marginBottom: 12 },
  balanceLabel: { color: '#dbeafe' },
  balanceValue: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  lookup: { alignSelf: 'flex-start', marginBottom: 8 },
  quick: { flexDirection: 'row', marginBottom: 8 },
  quickChip: { marginRight: 8 },
  contact: { marginRight: 4 },
});
