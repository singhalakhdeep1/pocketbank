import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, Portal, Switch, Text, TextInput } from 'react-native-paper';
import { AccountPicker, ChipGroup, Empty, ErrorBanner, Loading, Screen, useToast } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { bank } from '@/services/bank';
import { useAppSelector } from '@/store';
import { colors } from '@/theme';
import type { ScheduledPayment } from '@/types';
import { longDate, money, parseAmount } from '@/utils/format';

const FREQ = ['NONE', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;

export default function ScheduledPaymentsScreen() {
  const accounts = useAppSelector((s) => s.accounts.accounts);
  const { data, error, loading, refreshing, refresh, reload } = useApi(() => bank.scheduled.list());
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'TRANSFER' | 'P2P'>('P2P');
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [start, setStart] = useState('');
  const [freq, setFreq] = useState<(typeof FREQ)[number]>('MONTHLY');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (loading && !data) return <Loading />;
  const target = kind === 'TRANSFER' ? accounts.find((a) => a.id === to)?.accountNumber : to.trim();
  const startDate = start ? new Date(start) : new Date(Date.now() + 86_400_000);

  const create = async () => {
    setBusy(true);
    try {
      await bank.scheduled.create({
        kind,
        fromAccountId: from ?? accounts[0].id,
        toAccountNumber: target,
        amount: parseAmount(amount) as number,
        description: desc || 'Scheduled payment',
        frequency: freq,
        startDate: startDate.toISOString(),
      });
      setOpen(false);
      toast.show('Payment scheduled');
      await reload();
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (s: ScheduledPayment) => {
    try {
      await bank.scheduled.update(s.id, { active: !s.active });
      await reload();
    } catch (err) {
      toast.show((err as Error).message);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={refresh} testID="scheduled">
        <ErrorBanner error={error} onRetry={reload} />
        {data?.length ? null : <Empty icon="calendar-clock" title="No scheduled payments" />}
        {data?.map((s) => (
          <Card key={s.id} style={styles.card}>
            <Card.Title
              title={s.description}
              subtitle={`${s.kind} · ${s.frequency === 'NONE' ? 'once' : s.frequency.toLowerCase()} · next ${longDate(s.nextRunAt)}`}
              right={() => <Switch value={s.active} onValueChange={() => toggle(s)} style={{ marginRight: 12 }} />}
            />
            <Card.Content>
              <Text style={styles.amount}>{money(s.amount)}</Text>
              <Text style={styles.muted}>
                {s.toAccountNumber ? `To ·${s.toAccountNumber.slice(-4)} · ` : ''}ran {s.runCount}×
              </Text>
              {s.lastError ? <Text style={{ color: colors.negative }}>Last attempt failed: {s.lastError}</Text> : null}
            </Card.Content>
            <Card.Actions>
              <Button textColor={colors.negative} onPress={() => bank.scheduled.remove(s.id).then(reload)}>
                Delete
              </Button>
            </Card.Actions>
          </Card>
        ))}
        <Button mode="contained" icon="plus" onPress={() => setOpen(true)} style={{ marginTop: 8 }} testID="new-scheduled">
          Schedule a payment
        </Button>
      </Screen>
      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)}>
          <Dialog.Title>Schedule a payment</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 480 }}>
            <View style={{ paddingVertical: 8 }}>
              <ChipGroup options={['P2P', 'TRANSFER'] as const} value={kind} onChange={(v) => (setKind(v), setTo(''))} labels={{ P2P: 'To someone', TRANSFER: 'My accounts' }} />
              <AccountPicker accounts={accounts} value={from ?? accounts[0]?.id ?? null} onChange={setFrom} />
              {kind === 'TRANSFER' ? (
                <AccountPicker accounts={accounts} value={to || null} onChange={setTo} label="To" filter={(a) => a.id !== (from ?? accounts[0]?.id)} />
              ) : (
                <TextInput label="Recipient account number" value={to} onChangeText={setTo} keyboardType="number-pad" mode="outlined" dense style={styles.input} />
              )}
              <TextInput label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" mode="outlined" dense style={styles.input} />
              <TextInput label="Description" value={desc} onChangeText={setDesc} mode="outlined" dense style={styles.input} />
              <TextInput label="First payment (YYYY-MM-DD, default tomorrow)" value={start} onChangeText={setStart} mode="outlined" dense style={styles.input} />
              <ChipGroup options={FREQ} value={freq} onChange={setFreq} labels={{ NONE: 'Once' }} />
            </View>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setOpen(false)}>Cancel</Button>
            <Button mode="contained" loading={busy} disabled={!parseAmount(amount) || !target || Number.isNaN(startDate.getTime())} onPress={create}>
              Schedule
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      {toast.node}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10, backgroundColor: colors.surface },
  amount: { fontSize: 20, fontWeight: '700' },
  muted: { color: colors.muted },
  input: { marginBottom: 8 },
});
