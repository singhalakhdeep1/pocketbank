import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text } from 'react-native-paper';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { Empty, ErrorBanner, Loading, Screen, Section } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import type { MainScreenProps } from '@/navigation/types';
import { bank } from '@/services/bank';
import { chartConfig, colors } from '@/theme';
import { money, percent, titleCase } from '@/utils/format';

const width = Math.min(Dimensions.get('window').width, 520) - 32;

/** Portfolio overview: value, gain, performance history, allocation and holdings. */
export default function InvestmentsScreen({ navigation }: MainScreenProps<'Investments'>) {
  const { data, error, loading, refreshing, refresh, reload } = useApi(() => bank.investments.portfolio());
  if (loading && !data) return <Loading />;
  const t = data?.totals;
  const perf = (data?.performance ?? []).filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 12)) === 0 || i === arr.length - 1);
  const simulated = data?.holdings.some((h) => h.priceSource === 'simulated');

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} testID="investments">
      <ErrorBanner error={error} onRetry={reload} />
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Portfolio value</Text>
        <Text style={styles.heroValue} testID="portfolio-value">
          {money(t?.value ?? 0)}
        </Text>
        <Text style={{ color: (t?.gain ?? 0) >= 0 ? '#bbf7d0' : '#fecaca', fontWeight: '700' }}>
          {(t?.gain ?? 0) >= 0 ? '▲' : '▼'} {money(Math.abs(t?.gain ?? 0))} ({percent(t?.gainPercent ?? 0, 2)}) all time · {money(t?.dayChange ?? 0)} today
        </Text>
      </View>
      {simulated ? <Text style={styles.note}>Stock prices are simulated (no market-data key on this server). Crypto prices are live from Coinbase.</Text> : null}

      {perf.length > 1 ? (
        <Section title="Performance">
          <LineChart
            data={{ labels: perf.map((p) => p.date.slice(5)), datasets: [{ data: perf.map((p) => p.value) }, { data: perf.map((p) => p.invested), color: (o = 1) => `rgba(107,114,128,${o})` }], legend: ['Value', 'Invested'] }}
            width={width}
            height={200}
            chartConfig={{ ...chartConfig, color: (o = 1) => `rgba(15,157,88,${o})` }}
            bezier
            withDots={false}
            style={{ borderRadius: 12 }}
          />
        </Section>
      ) : null}

      {data?.allocation.length ? (
        <Section title="Asset allocation">
          <PieChart
            data={data.allocation.map((a, i) => ({ name: titleCase(a.type), population: a.value, color: colors.chart[i % colors.chart.length], legendFontColor: colors.text, legendFontSize: 12 }))}
            width={width}
            height={180}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="12"
          />
        </Section>
      ) : null}

      <Section title="Holdings" right={<Button compact icon="swap-vertical" onPress={() => navigation.navigate('InvestmentTracking')}>Trade</Button>}>
        {data?.holdings.length ? null : <Empty icon="chart-line" title="No investments yet" action={<Button onPress={() => navigation.navigate('InvestmentTracking')}>Start investing</Button>} />}
        {data?.holdings.map((h) => (
          <Card key={h.id} style={styles.card} onPress={() => navigation.navigate('InvestmentTracking', { symbol: h.symbol })} testID={`holding-${h.symbol}`}>
            <Card.Content>
              <View style={styles.row}>
                <View>
                  <Text style={styles.bold}>{h.symbol}</Text>
                  <Text style={styles.muted}>{h.name}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.bold}>{money(h.value)}</Text>
                  <Text style={{ color: h.gain >= 0 ? colors.positive : colors.negative, fontSize: 12 }}>
                    {h.gain >= 0 ? '+' : ''}
                    {money(h.gain)} ({percent(h.gainPercent, 2)})
                  </Text>
                </View>
              </View>
              <View style={[styles.row, { marginTop: 6 }]}>
                <Chip compact>{titleCase(h.assetType)}</Chip>
                <Text style={styles.muted}>
                  {h.quantity} @ {money(h.currentPrice)} · avg {money(h.avgPrice)} · today {percent(h.dayChangePercent)}
                </Text>
              </View>
            </Card.Content>
          </Card>
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#065f46', borderRadius: 16, padding: 20 },
  heroLabel: { color: '#d1fae5' },
  heroValue: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginVertical: 4 },
  note: { color: colors.muted, fontSize: 12, marginTop: 8 },
  card: { marginBottom: 8, backgroundColor: colors.surface },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bold: { fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 12 },
});
