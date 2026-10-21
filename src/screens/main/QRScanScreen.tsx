import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { AccountPicker, Field, Screen, useToast } from '@/components/ui';
import type { MainScreenProps } from '@/navigation/types';
import { bank } from '@/services/bank';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchAccounts } from '@/store/slices/accountsSlice';
import { colors } from '@/theme';
import { money, parseAmount } from '@/utils/format';

type Parsed = Awaited<ReturnType<typeof bank.qr.parse>>;

export default function QRScanScreen({ navigation }: MainScreenProps<'QRScan'>) {
  const dispatch = useAppDispatch();
  const accounts = useAppSelector((s) => s.accounts.accounts);
  const [permission, requestPermission] = useCameraPermissions();
  const [payload, setPayload] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const handle = async (data: string) => {
    if (busy || payload) return;
    setPayload(data);
    try {
      const p = await bank.qr.parse(data);
      setParsed(p);
      if (p.amount) setAmount(String(p.amount));
    } catch (err) {
      toast.show((err as Error).message);
      setPayload(null);
    }
  };

  const pay = async () => {
    if (!payload) return;
    setBusy(true);
    try {
      const res = await bank.qr.pay({ payload, fromAccountId: from ?? undefined, amount: parsed?.amount ? undefined : (parseAmount(amount) ?? undefined) });
      toast.show(`Paid ${money(res.amount)} — ${res.status}`);
      void dispatch(fetchAccounts());
      setTimeout(() => navigation.goBack(), 1000);
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen testID="qr-scan">
        {!parsed ? (
          <>
            {permission?.granted ? (
              <View style={styles.cameraBox}>
                <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={payload ? undefined : ({ data }) => void handle(data)} />
                <View style={styles.frame} />
              </View>
            ) : (
              <Card style={styles.card}>
                <Card.Content>
                  <Text style={{ marginBottom: 12 }}>Camera access is needed to scan payment QR codes.</Text>
                  <Button mode="contained" icon="camera" onPress={requestPermission}>
                    Allow camera
                  </Button>
                </Card.Content>
              </Card>
            )}
            <Text style={styles.or}>or paste a PocketBank QR link</Text>
            <Field label="pocketbank://…" value={manual} onChangeText={setManual} autoCapitalize="none" testID="qr-manual" />
            <Button mode="outlined" disabled={!manual} onPress={() => handle(manual.trim())} testID="qr-manual-go">
              Continue
            </Button>
          </>
        ) : (
          <>
            <Card style={styles.card}>
              <Card.Title title={parsed.kind === 'merchant' ? parsed.name : `Pay ${parsed.name}`} subtitle={parsed.kind === 'merchant' ? `Merchant · ${parsed.category}` : `Account ·${parsed.accountNumber.slice(-4)}`} />
              {parsed.kind === 'person' && parsed.note ? (
                <Card.Content>
                  <Text>“{parsed.note}”</Text>
                </Card.Content>
              ) : null}
            </Card>
            <AccountPicker accounts={accounts} value={from ?? accounts.find((a) => a.accountType === 'CHECKING')?.id ?? null} onChange={setFrom} />
            <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" disabled={Boolean(parsed.amount)} testID="qr-amount" />
            <Button mode="contained" icon="check" onPress={pay} loading={busy} disabled={busy || !parseAmount(amount)} testID="qr-pay">
              Pay {parseAmount(amount) ? money(parseAmount(amount) as number, parsed.currency) : ''}
            </Button>
            <Button onPress={() => (setParsed(null), setPayload(null), setAmount(''))} style={{ marginTop: 8 }}>
              Scan again
            </Button>
          </>
        )}
      </Screen>
      {toast.node}
    </View>
  );
}

const styles = StyleSheet.create({
  cameraBox: { height: 320, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  frame: { width: 220, height: 220, borderWidth: 3, borderColor: '#fff', borderRadius: 18 },
  card: { marginBottom: 12, backgroundColor: colors.surface },
  or: { textAlign: 'center', color: colors.muted, marginVertical: 12 },
});
