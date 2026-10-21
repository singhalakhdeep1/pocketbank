import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Chip, Dialog, IconButton, Portal, Text, TextInput } from 'react-native-paper';
import { AccountPicker, Empty, ErrorBanner, Loading, Screen, useToast } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { bank } from '@/services/bank';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchAccounts } from '@/store/slices/accountsSlice';
import { colors } from '@/theme';
import { money, parseAmount, shortDate } from '@/utils/format';

export default function SplitBills() {
  const dispatch = useAppDispatch();
  const accounts = useAppSelector((s) => s.accounts.accounts);
  const { data, error, loading, refreshing, refresh, reload } = useApi(() => bank.splits.list());
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [total, setTotal] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [people, setPeople] = useState<string[]>(['']);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (loading && !data) return <Loading />;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.show(ok);
      await reload();
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const filled = people.map((p) => p.trim()).filter(Boolean);
  const create = () =>
    run(async () => {
      await bank.splits.create({
        title: title.trim(),
        totalAmount: parseAmount(total) as number,
        accountId: accountId ?? undefined,
        // Emails link PocketBank customers (who can pay in-app); anything else is tracked by name.
        participants: filled.map((p) => (p.includes('@') ? { email: p } : { name: p })),
      });
      setOpen(false);
      setTitle('');
      setTotal('');
      setPeople(['']);
    }, 'Split created — participants were notified');

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={refresh} testID="splits">
        <ErrorBanner error={error} onRetry={reload} />
        <View style={styles.summary}>
          <View>
            <Text style={styles.label}>You owe</Text>
            <Text style={[styles.big, { color: colors.negative }]}>{money(data?.summary.youOwe ?? 0)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.label}>Owed to you</Text>
            <Text style={[styles.big, { color: colors.positive }]}>{money(data?.summary.owedToYou ?? 0)}</Text>
          </View>
        </View>
        {data?.items.length ? null : <Empty icon="call-split" title="No split bills yet" />}
        {data?.items.map((s) => (
          <Card key={s.id} style={styles.card} testID={`split-${s.title}`}>
            <Card.Title
              title={s.title}
              subtitle={`${shortDate(s.createdAt)} · ${money(s.totalAmount, s.currency)} · ${s.isCreator ? 'you paid' : 'shared with you'}`}
              right={() => <Chip compact style={{ marginRight: 12, backgroundColor: s.status === 'SETTLED' ? '#dcfce7' : '#fef3c7' }}>{s.status === 'SETTLED' ? 'Settled' : 'Pending'}</Chip>}
            />
            <Card.Content>
              {s.participants.map((p) => (
                <View key={p.id} style={styles.person}>
                  <Avatar.Text size={28} label={p.name.charAt(0)} style={{ backgroundColor: p.paid ? colors.positive : colors.surfaceAlt }} />
                  <Text style={{ flex: 1, marginLeft: 8 }}>
                    {p.name}
                    {p.userId ? '' : ' (not on PocketBank)'}
                  </Text>
                  <Text style={styles.bold}>{money(p.amount, s.currency)}</Text>
                  {s.isCreator && !p.paid ? <IconButton icon="check" size={18} onPress={() => run(() => bank.splits.markPaid(s.id, p.id), `${p.name} marked as paid`)} /> : <IconButton icon={p.paid ? 'check-circle' : 'clock-outline'} size={18} iconColor={p.paid ? colors.positive : colors.muted} />}
                </View>
              ))}
            </Card.Content>
            <Card.Actions>
              {s.isCreator && s.status === 'PENDING' ? <Button onPress={() => run(() => bank.splits.remind(s.id), 'Reminders sent')}>Remind</Button> : null}
              {!s.isCreator && s.myShare && !s.myShare.paid ? (
                <Button
                  mode="contained"
                  loading={busy}
                  onPress={() =>
                    run(async () => {
                      await bank.splits.settle(s.id);
                      void dispatch(fetchAccounts());
                    }, 'Your share is paid')
                  }
                  testID={`settle-${s.title}`}
                >
                  Pay my share {money(s.myShare.amount, s.currency)}
                </Button>
              ) : null}
            </Card.Actions>
          </Card>
        ))}
        <Button mode="contained" icon="plus" onPress={() => setOpen(true)} style={{ marginTop: 8 }} testID="new-split">
          New split
        </Button>
      </Screen>
      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)}>
          <Dialog.Title>Split a bill</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 480 }}>
            <View style={{ paddingVertical: 8 }}>
              <TextInput label="What for?" value={title} onChangeText={setTitle} mode="outlined" dense style={styles.input} testID="split-title" />
              <TextInput label="Total amount" value={total} onChangeText={setTotal} keyboardType="decimal-pad" mode="outlined" dense style={styles.input} testID="split-total" />
              <AccountPicker accounts={accounts} value={accountId ?? accounts[0]?.id ?? null} onChange={setAccountId} label="Repayments go to" />
              <Text style={styles.label}>Split evenly with (email of a PocketBank customer, or a name)</Text>
              {people.map((p, i) => (
                <TextInput
                  key={i}
                  value={p}
                  onChangeText={(v) => setPeople(people.map((x, j) => (j === i ? v : x)))}
                  mode="outlined"
                  dense
                  autoCapitalize="none"
                  placeholder="sam@pocketbank.dev or Jordan"
                  style={styles.input}
                  right={people.length > 1 ? <TextInput.Icon icon="close" onPress={() => setPeople(people.filter((_, j) => j !== i))} /> : undefined}
                  testID={`split-person-${i}`}
                />
              ))}
              <Button icon="account-plus" onPress={() => setPeople([...people, ''])}>
                Add person
              </Button>
              {parseAmount(total) && filled.length ? <Text style={styles.label}>Each of {filled.length + 1} pays about {money((parseAmount(total) as number) / (filled.length + 1))}</Text> : null}
            </View>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setOpen(false)}>Cancel</Button>
            <Button mode="contained" loading={busy} disabled={!title.trim() || !parseAmount(total) || filled.length === 0} onPress={create} testID="create-split">
              Create
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      {toast.node}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 12 },
  label: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  big: { fontSize: 22, fontWeight: 'bold' },
  card: { marginBottom: 10, backgroundColor: colors.surface },
  person: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  bold: { fontWeight: '700' },
  input: { marginBottom: 8 },
});
