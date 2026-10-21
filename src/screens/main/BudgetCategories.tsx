import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, IconButton, Portal, Switch, Text, TextInput } from 'react-native-paper';
import { ChipGroup, Empty, ErrorBanner, Loading, Screen, UsageBar, useToast } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { bank } from '@/services/bank';
import { colors } from '@/theme';
import type { Budget } from '@/types';
import { money, parseAmount } from '@/utils/format';

const ICONS = ['🛒', '🍽️', '🚗', '🛍️', '🎬', '💡', '🏠', '💊', '✈️', '🎓', '💰'];
const SUGGESTED = ['Groceries', 'Food & Dining', 'Transport', 'Shopping', 'Entertainment', 'Utilities', 'Health', 'Travel', 'Subscriptions'];

/** Create, edit and delete budget categories (names match transaction categories). */
export default function BudgetCategories() {
  const { data, error, loading, refreshing, refresh, reload } = useApi(() => bank.budgets.list());
  const [editing, setEditing] = useState<Budget | 'new' | null>(null);
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [icon, setIcon] = useState('💰');
  const [period, setPeriod] = useState<Budget['period']>('MONTHLY');
  const [rollover, setRollover] = useState(false);
  const [threshold, setThreshold] = useState('80');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (loading && !data) return <Loading />;

  const openNew = () => {
    setEditing('new');
    setName('');
    setLimit('');
    setIcon('💰');
    setPeriod('MONTHLY');
    setRollover(false);
    setThreshold('80');
  };
  const openEdit = (b: Budget) => {
    setEditing(b);
    setLimit(String(b.limit));
    setRollover(b.rollover);
    setThreshold(String(b.alertThreshold));
  };

  const save = async () => {
    setBusy(true);
    try {
      const value = parseAmount(limit) as number;
      const alertThreshold = Math.min(100, Math.max(10, Number(threshold) || 80));
      if (editing === 'new') await bank.budgets.create({ name: name.trim(), limit: value, icon, period, rollover, alertThreshold });
      else if (editing) await bank.budgets.update(editing.id, { limit: value, rollover, alertThreshold });
      setEditing(null);
      toast.show('Budget saved');
      await reload();
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={refresh} testID="budget-categories">
        <ErrorBanner error={error} onRetry={reload} />
        {data?.items.length ? null : <Empty icon="shape-outline" title="No budget categories yet" />}
        {data?.items.map((b) => (
          <Card key={b.id} style={styles.card} onPress={() => openEdit(b)} testID={`budget-${b.name}`}>
            <Card.Content>
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: b.color }]}>
                  <Text style={{ fontSize: 20 }}>{b.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bold}>{b.name}</Text>
                  <Text style={styles.muted}>
                    Spent {money(b.spent)} · {b.period.toLowerCase()} · alert at {b.alertThreshold}%{b.rollover ? ' · rollover' : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.bold}>{money(b.effectiveLimit)}</Text>
                  <Text style={{ color: b.remaining >= 0 ? colors.positive : colors.negative, fontSize: 12 }}>
                    {b.remaining >= 0 ? `${money(b.remaining)} left` : `${money(-b.remaining)} over`}
                  </Text>
                </View>
                <IconButton icon="delete-outline" onPress={() => bank.budgets.remove(b.id).then(reload)} />
              </View>
              <UsageBar percent={b.percentUsed} />
            </Card.Content>
          </Card>
        ))}
        <Button mode="contained" icon="plus" onPress={openNew} style={{ marginTop: 8 }} testID="add-budget">
          Add category
        </Button>
      </Screen>
      <Portal>
        <Dialog visible={editing !== null} onDismiss={() => setEditing(null)}>
          <Dialog.Title>{editing === 'new' || editing === null ? 'New budget category' : `Edit ${editing.name}`}</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 480 }}>
            <View style={{ paddingVertical: 8 }}>
              {editing === 'new' ? (
                <>
                  <TextInput label="Category name" value={name} onChangeText={setName} mode="outlined" dense style={styles.input} testID="budget-name" />
                  <View style={styles.suggest}>
                    {SUGGESTED.map((s) => (
                      <Button key={s} compact mode="text" onPress={() => setName(s)}>
                        {s}
                      </Button>
                    ))}
                  </View>
                  <View style={styles.suggest}>
                    {ICONS.map((i) => (
                      <Button key={i} compact mode={icon === i ? 'contained-tonal' : 'text'} onPress={() => setIcon(i)}>
                        {i}
                      </Button>
                    ))}
                  </View>
                  <ChipGroup options={['WEEKLY', 'MONTHLY', 'YEARLY'] as const} value={period} onChange={setPeriod} />
                </>
              ) : null}
              <TextInput label="Limit" value={limit} onChangeText={setLimit} keyboardType="decimal-pad" mode="outlined" dense style={styles.input} testID="budget-limit" />
              <TextInput label="Alert at % used" value={threshold} onChangeText={setThreshold} keyboardType="number-pad" mode="outlined" dense style={styles.input} />
              <View style={styles.row}>
                <Text>Roll unused budget into next period</Text>
                <Switch value={rollover} onValueChange={setRollover} />
              </View>
            </View>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setEditing(null)}>Cancel</Button>
            <Button mode="contained" loading={busy} disabled={!parseAmount(limit) || (editing === 'new' && !name.trim())} onPress={save} testID="save-budget">
              Save
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  bold: { fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 12 },
  input: { marginBottom: 8 },
  suggest: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
});
