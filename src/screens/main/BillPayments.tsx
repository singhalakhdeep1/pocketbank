import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Dialog, Portal, Switch, Text, TextInput } from 'react-native-paper';
import { ChipGroup, ConfirmDialog, Empty, ErrorBanner, Loading, Screen, useToast } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { bank } from '@/services/bank';
import { useAppDispatch } from '@/store';
import { fetchAccounts } from '@/store/slices/accountsSlice';
import { colors } from '@/theme';
import type { Bill } from '@/types';
import { money, parseAmount, shortDate } from '@/utils/format';

const CATEGORY_ICON: Record<string, string> = { utilities: '💡', rent: '🏠', insurance: '🛡️', phone: '📱', internet: '🌐', credit_card: '💳', subscription: '📺', other: '📄' };
const CATEGORIES = ['utilities', 'rent', 'insurance', 'phone', 'internet', 'credit_card', 'subscription', 'other'] as const;
const STATUS_COLOR: Record<Bill['status'], string> = { PAID: colors.positive, OVERDUE: colors.negative, PENDING: colors.warning };

export default function BillPayments() {
  const dispatch = useAppDispatch();
  const { data, error, loading, refreshing, refresh, reload } = useApi(() => bank.bills.list());
  const [paying, setPaying] = useState<Bill | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', payee: '', amount: '', due: '', category: 'utilities' as (typeof CATEGORIES)[number], recurrence: 'MONTHLY' as Bill['recurrence'] });
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

  const dueDate = () => {
    const d = form.due ? new Date(form.due) : new Date(Date.now() + 7 * 86_400_000);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={refresh} testID="bills">
        <ErrorBanner error={error} onRetry={reload} />
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Total due</Text>
          <Text style={styles.summaryValue} testID="bills-total">
            {money(data?.summary.totalDue ?? 0)}
          </Text>
          <Text style={styles.summaryLabel}>
            {data?.summary.pendingCount ?? 0} unpaid · {data?.summary.overdueCount ?? 0} overdue · {data?.summary.dueThisWeek ?? 0} due this week
          </Text>
        </View>
        {data?.items.length ? null : <Empty icon="file-document-outline" title="No bills yet" />}
        {data?.items.map((bill) => (
          <Card key={bill.id} style={styles.card} testID={`bill-${bill.name}`}>
            <Card.Title
              title={`${CATEGORY_ICON[bill.category] ?? '📄'}  ${bill.name}`}
              subtitle={`${bill.payee} · ${bill.recurrence === 'NONE' ? 'one-off' : bill.recurrence.toLowerCase()}`}
              right={() => (
                <Chip compact textStyle={{ color: STATUS_COLOR[bill.status], fontWeight: '700' }} style={styles.status}>
                  {bill.status}
                </Chip>
              )}
            />
            <Card.Content style={styles.details}>
              <View>
                <Text style={styles.label}>Amount</Text>
                <Text style={styles.value}>{money(bill.amount)}</Text>
              </View>
              <View>
                <Text style={styles.label}>Due</Text>
                <Text style={styles.value}>{shortDate(bill.dueDate)}</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.label}>Autopay</Text>
                <Switch value={bill.autoPay} onValueChange={(v) => run(() => bank.bills.autopay(bill.id, v), v ? 'Autopay on' : 'Autopay off')} testID={`autopay-${bill.name}`} />
              </View>
            </Card.Content>
            <Card.Actions>
              <Button textColor={colors.muted} onPress={() => run(() => bank.bills.remove(bill.id), 'Bill removed')}>
                Remove
              </Button>
              {bill.status !== 'PAID' ? (
                <Button mode="contained" onPress={() => setPaying(bill)} testID={`pay-${bill.name}`}>
                  Pay now
                </Button>
              ) : null}
            </Card.Actions>
          </Card>
        ))}
        <Button mode="contained" icon="plus" style={{ marginTop: 8 }} onPress={() => setAddOpen(true)} testID="add-bill">
          Add bill
        </Button>
      </Screen>

      <ConfirmDialog
        visible={Boolean(paying)}
        title="Pay bill"
        body={paying ? `${paying.name} · ${money(paying.amount)} to ${paying.payee}` : ''}
        confirmLabel="Pay"
        loading={busy}
        onDismiss={() => setPaying(null)}
        onConfirm={() =>
          paying &&
          run(async () => {
            await bank.bills.pay(paying.id, paying.accountId ?? undefined);
            setPaying(null);
            void dispatch(fetchAccounts());
          }, 'Bill paid')
        }
      />
      <Portal>
        <Dialog visible={addOpen} onDismiss={() => setAddOpen(false)}>
          <Dialog.Title>Add a bill</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 460 }}>
            <View style={{ paddingVertical: 8 }}>
              <TextInput label="Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} mode="outlined" dense style={styles.input} testID="bill-name" />
              <TextInput label="Payee" value={form.payee} onChangeText={(v) => setForm({ ...form, payee: v })} mode="outlined" dense style={styles.input} testID="bill-payee" />
              <TextInput label="Amount" value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v })} keyboardType="decimal-pad" mode="outlined" dense style={styles.input} testID="bill-amount" />
              <TextInput label="Due date (YYYY-MM-DD)" value={form.due} onChangeText={(v) => setForm({ ...form, due: v })} mode="outlined" dense style={styles.input} />
              <ChipGroup options={CATEGORIES} value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
              <ChipGroup options={['NONE', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const} value={form.recurrence} onChange={(v) => setForm({ ...form, recurrence: v })} labels={{ NONE: 'One-off' }} />
            </View>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setAddOpen(false)}>Cancel</Button>
            <Button
              mode="contained"
              loading={busy}
              disabled={!form.name || !form.payee || !parseAmount(form.amount) || !dueDate()}
              onPress={() =>
                run(async () => {
                  await bank.bills.create({ name: form.name, payee: form.payee, amount: parseAmount(form.amount) as number, dueDate: (dueDate() as Date).toISOString(), category: form.category, recurrence: form.recurrence, autoPay: false });
                  setAddOpen(false);
                  setForm({ ...form, name: '', payee: '', amount: '', due: '' });
                }, 'Bill added')
              }
              testID="save-bill"
            >
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      {toast.node}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { backgroundColor: colors.primary, borderRadius: 16, padding: 20, marginBottom: 16 },
  summaryLabel: { color: '#dbeafe' },
  summaryValue: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginVertical: 4 },
  card: { marginBottom: 10, backgroundColor: colors.surface },
  status: { marginRight: 12, backgroundColor: colors.surfaceAlt },
  details: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: colors.muted, fontSize: 12 },
  value: { fontWeight: '700' },
  input: { marginBottom: 8 },
});
