import React, { useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { AccountPicker, Field, Screen, useToast } from '@/components/ui';
import { bank } from '@/services/bank';
import { useAppSelector } from '@/store';
import { colors } from '@/theme';
import { money, parseAmount } from '@/utils/format';

/** Shows a QR code other PocketBank customers can scan to pay into the chosen account. */
export default function QRReceiveScreen() {
  const accounts = useAppSelector((s) => s.accounts.accounts);
  const [accountId, setAccountId] = useState<string | null>(accounts.find((a) => a.accountType === 'CHECKING')?.id ?? accounts[0]?.id ?? null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [payload, setPayload] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    const t = setTimeout(() => {
      bank.qr
        .receive({ accountId: accountId ?? undefined, amount: parseAmount(amount) ?? undefined, note: note || undefined })
        .then((r) => setPayload(r.payload))
        .catch((e: Error) => toast.show(e.message));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, amount, note]);

  const account = accounts.find((a) => a.id === accountId);
  return (
    <View style={{ flex: 1 }}>
      <Screen testID="qr-receive">
        <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} label="Pay into" />
        <Card style={styles.card}>
          <Card.Content style={styles.qr}>
            {payload ? <QRCode value={payload} size={220} /> : null}
            <Text style={styles.caption}>
              {parseAmount(amount) ? `Request ${money(parseAmount(amount) as number, account?.currency)}` : 'Any amount'} · ·{account?.accountNumber.slice(-4)}
            </Text>
          </Card.Content>
        </Card>
        <Field label="Request a specific amount (optional)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Field label="Note (optional)" value={note} onChangeText={setNote} />
        <View style={styles.row}>
          <Button icon="content-copy" onPress={async () => payload && (await Clipboard.setStringAsync(payload), toast.show('Payment link copied'))} testID="copy-qr">
            Copy link
          </Button>
          <Button icon="share-variant" onPress={() => payload && Share.share({ message: payload })}>
            Share
          </Button>
        </View>
        {payload ? (
          <Text selectable style={styles.payload} testID="qr-payload">
            {payload}
          </Text>
        ) : null}
      </Screen>
      {toast.node}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, marginBottom: 12 },
  qr: { alignItems: 'center', padding: 16 },
  caption: { marginTop: 12, color: colors.muted },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  payload: { color: colors.muted, fontSize: 11, marginTop: 8 },
});
