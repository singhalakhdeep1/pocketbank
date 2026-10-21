import React, { useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Card, SegmentedButtons, Text } from 'react-native-paper';
import { BarChart } from 'react-native-chart-kit';
import { ErrorBanner, Loading, Screen, Section, UsageBar } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { bank } from '@/services/bank';
import { chartConfig, colors } from '@/theme';
import type { Spending } from '@/types';
import { money, percent } from '@/utils/format';

const width = Math.min(Dimensions.get('window').width, 520) - 32;

export default function SpendingAnalytics() {
  const [range, setRange] = useState<Spending['range']>('month');
  const { data, error, loading, refreshing, refresh, reload } = useApi(
    async () => {
      const [spending, recurring] = await Promise.all([bank.analytics.spending(range), bank.transactions.recurring()]);
      return { spending, recurring };
    },
    [range],
  );

  const s = data?.spending;
  const used = s && s.budget > 0 ? (s.totalSpent / s.budget) * 100 : 0;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} testID="spending">
      <SegmentedButtons
        value={range}
        onValueChange={(v) => setRange(v as Spending['range'])}
        buttons={[
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
          { value: 'year', label: 'Year' },
        ]}
        style={{ marginBottom: 12 }}
      />
      <ErrorBanner error={error} onRetry={reload} />
      {loading && !data ? (
        <Loading />
      ) : s ? (
        <>
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.muted}>Total spent this {range}</Text>
              <Text style={styles.big} testID="spending-total">
                {money(s.totalSpent)}
              </Text>
              {s.budget > 0 ? (
                <>
                  <UsageBar percent={used} />
                  <Text style={styles.muted}>
                    {used.toFixed(0)}% of {money(s.budget)} budget · {s.totalSpent <= s.budget ? `${money(s.budget - s.totalSpent)} left` : `${money(s.totalSpent - s.budget)} over`}
                  </Text>
                </>
              ) : null}
              {s.changeVsPrevious !== null ? (
                <Text style={{ color: s.changeVsPrevious > 0 ? colors.negative : colors.positive, marginTop: 4 }}>{percent(s.changeVsPrevious)} vs previous {range}</Text>
              ) : null}
            </Card.Content>
          </Card>

          <Section title="By category">
            {s.categories.map((c) => (
              <View key={c.name} style={styles.cat}>
                <View style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: c.color }]} />
                  <Text style={{ flex: 1 }}>{c.name}</Text>
                  <Text style={styles.bold}>{money(c.amount)}</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${c.percentage}%`, backgroundColor: c.color }]} />
                </View>
                <Text style={styles.muted}>{c.percentage.toFixed(0)}%</Text>
              </View>
            ))}
          </Section>

          <Section title="6-month trend">
            <BarChart
              data={{ labels: s.monthlyTrend.map((m) => m.month), datasets: [{ data: s.monthlyTrend.map((m) => m.amount) }] }}
              width={width}
              height={200}
              yAxisLabel="$"
              yAxisSuffix=""
              chartConfig={chartConfig}
              style={{ borderRadius: 12 }}
            />
          </Section>

          <Section title="Insights">
            <Text style={styles.insight}>💡 You spent {money(s.totalSpent)} this {range}.</Text>
            <Text style={styles.insight}>📊 Top category: {s.categories[0]?.name ?? 'n/a'}{s.categories[0] ? ` (${s.categories[0].percentage.toFixed(0)}%)` : ''}.</Text>
            {data.recurring.length ? <Text style={styles.insight}>🔁 {data.recurring.length} recurring payments detected: {data.recurring.map((r) => `${r.merchant} ~${money(r.averageAmount)}`).join(', ')}.</Text> : null}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface },
  muted: { color: colors.muted, fontSize: 12 },
  big: { fontSize: 30, fontWeight: 'bold', marginVertical: 4 },
  bold: { fontWeight: '700' },
  cat: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  track: { height: 6, backgroundColor: colors.surfaceAlt, borderRadius: 3, marginTop: 4, overflow: 'hidden' },
  fill: { height: 6 },
  insight: { marginBottom: 6 },
});
