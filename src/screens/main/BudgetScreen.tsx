import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text } from 'react-native-paper';
import { PieChart } from 'react-native-chart-kit';
import { Empty, ErrorBanner, Loading, Screen, Section, UsageBar } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import type { MainScreenProps } from '@/navigation/types';
import { bank } from '@/services/bank';
import { chartConfig, colors } from '@/theme';
import { money } from '@/utils/format';

const width = Math.min(Dimensions.get('window').width, 520) - 32;

/** Budget overview: total vs limit, spending split by category, per-category status and tips. */
export default function BudgetScreen({ navigation }: MainScreenProps<'Budget'>) {
  const { data, error, loading, refreshing, refresh, reload } = useApi(async () => {
    const [budgets, insights] = await Promise.all([bank.budgets.list(), bank.budgets.insights()]);
    return { ...budgets, insights };
  });

  if (loading && !data) return <Loading />;
  const s = data?.summary;
  const pie = (data?.items ?? [])
    .filter((b) => b.spent > 0)
    .map((b) => ({ name: b.name, population: b.spent, color: b.color, legendFontColor: colors.text, legendFontSize: 12 }));

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} testID="budget">
      <ErrorBanner error={error} onRetry={reload} />
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.bold}>
            This period
          </Text>
          <View style={styles.row}>
            <View>
              <Text style={styles.muted}>Spent</Text>
              <Text style={styles.big}>{money(s?.totalSpent ?? 0)}</Text>
            </View>
            <View>
              <Text style={styles.muted}>Limit</Text>
              <Text style={styles.big}>{money(s?.totalLimit ?? 0)}</Text>
            </View>
            <View>
              <Text style={styles.muted}>Left</Text>
              <Text style={[styles.big, { color: (s?.remaining ?? 0) >= 0 ? colors.positive : colors.negative }]}>{money(s?.remaining ?? 0)}</Text>
            </View>
          </View>
          <UsageBar percent={s?.percentUsed ?? 0} />
          <Text style={styles.muted}>{(s?.percentUsed ?? 0).toFixed(0)}% of budget used</Text>
        </Card.Content>
      </Card>

      {pie.length ? (
        <Section title="Spending by category">
          <PieChart data={pie} width={width} height={200} chartConfig={chartConfig} accessor="population" backgroundColor="transparent" paddingLeft="12" absolute />
        </Section>
      ) : null}

      <Section title="Categories" right={<Button compact onPress={() => navigation.navigate('BudgetCategories')}>Manage</Button>}>
        {data?.items.length ? null : <Empty icon="wallet-outline" title="No budgets yet" action={<Button onPress={() => navigation.navigate('BudgetCategories')}>Create one</Button>} />}
        {data?.items.map((b) => (
          <Card key={b.id} style={styles.card} onPress={() => navigation.navigate('Transactions', { category: b.name })}>
            <Card.Content>
              <View style={styles.row}>
                <Text style={styles.bold}>
                  {b.icon} {b.name}
                </Text>
                <Chip compact style={{ backgroundColor: b.isOverBudget ? '#fee2e2' : '#dcfce7' }}>
                  {b.isOverBudget ? 'Over budget' : 'On track'}
                </Chip>
              </View>
              <Text style={styles.muted}>
                {money(b.spent)} of {money(b.effectiveLimit)}
                {b.rolledOver ? ` (incl. ${money(b.rolledOver)} rolled over)` : ''} · {money(b.dailyAllowance)}/day left
              </Text>
              <UsageBar percent={b.percentUsed} />
            </Card.Content>
          </Card>
        ))}
      </Section>

      {data?.insights.length ? (
        <Section title="Tips">
          {data.insights.map((t, i) => (
            <Text key={i} style={[styles.tip, { color: t.type === 'warning' ? colors.negative : t.type === 'success' ? colors.positive : colors.text }]}>
              • {t.message}
            </Text>
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10, backgroundColor: colors.surface },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  bold: { fontWeight: '700' },
  big: { fontSize: 18, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 12 },
  tip: { marginBottom: 6 },
});
