import React from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Badge, Card, IconButton, Text } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ErrorBanner, Loading, Screen, Section, TxRow, UsageBar } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import type { MainStackParamList, TabParamList } from '@/navigation/types';
import { bank } from '@/services/bank';
import { cache } from '@/services/cache/cache.service';
import { useAppSelector } from '@/store';
import { chartConfig, colors } from '@/theme';
import type { Dashboard } from '@/types';
import { money, shortDate } from '@/utils/format';

type Props = CompositeScreenProps<BottomTabScreenProps<TabParamList, 'Dashboard'>, NativeStackScreenProps<MainStackParamList>>;

const width = Math.min(Dimensions.get('window').width, 520) - 32;

async function loadDashboard() {
  const [dash, spending] = await Promise.all([bank.analytics.dashboard(), bank.analytics.spending('month')]);
  await cache.set('dashboard', JSON.stringify({ dash, spending }), 3600);
  return { dash, spending };
}

export default function DashboardScreen({ navigation }: Props) {
  const user = useAppSelector((s) => s.auth.user);
  const { data, error, loading, refreshing, refresh, reload } = useApi(async () => {
    try {
      return await loadDashboard();
    } catch (err) {
      const cached = await cache.get('dashboard', { allowStale: true });
      if (cached) return JSON.parse(cached) as Awaited<ReturnType<typeof loadDashboard>>;
      throw err;
    }
  });

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View>
          <IconButton icon="bell-outline" iconColor="#fff" onPress={() => navigation.navigate('Notifications')} testID="open-notifications" />
          {data?.dash.unreadNotifications ? <Badge style={styles.badge}>{data.dash.unreadNotifications}</Badge> : null}
        </View>
      ),
    });
  }, [navigation, data?.dash.unreadNotifications]);

  if (loading && !data) return <Loading label="Loading your finances…" />;
  const d: Dashboard | undefined = data?.dash;

  const actions = [
    { icon: 'swap-horizontal', label: 'Transfer', go: () => navigation.navigate('Transfer') },
    { icon: 'account-arrow-right', label: 'Send', go: () => navigation.navigate('P2PTransfers') },
    { icon: 'qrcode-scan', label: 'Scan QR', go: () => navigation.navigate('QRScan') },
    { icon: 'file-document-outline', label: 'Pay bill', go: () => navigation.navigate('BillPayments') },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} testID="dashboard">
      <ErrorBanner error={error} onRetry={reload} />
      <View style={styles.hero}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.name}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={styles.heroLabel}>Net worth</Text>
        <Text style={styles.heroValue} testID="net-worth">
          {money(d?.netWorth ?? 0)}
        </Text>
        <View style={styles.heroRow}>
          <Text style={styles.heroSmall}>Cash {money(d?.totalBalance ?? 0)}</Text>
          <Text style={styles.heroSmall}>Investments {money((d?.investmentsValue ?? 0) + (d?.cryptoValue ?? 0))}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        {actions.map((a) => (
          <Pressable key={a.label} onPress={a.go} style={styles.action} testID={`action-${a.label}`}>
            <Avatar.Icon size={48} icon={a.icon} style={{ backgroundColor: colors.surfaceAlt }} color={colors.primary} />
            <Text style={styles.actionText}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.stats}>
        <Card style={styles.stat} onPress={() => navigation.navigate('SpendingAnalytics')}>
          <Card.Content>
            <Text style={styles.statLabel}>Income this month</Text>
            <Text style={[styles.statValue, { color: colors.positive }]}>{money(d?.month.income ?? 0)}</Text>
          </Card.Content>
        </Card>
        <Card style={styles.stat} onPress={() => navigation.navigate('SpendingAnalytics')}>
          <Card.Content>
            <Text style={styles.statLabel}>Spent this month</Text>
            <Text style={[styles.statValue, { color: colors.negative }]}>{money(d?.month.expenses ?? 0)}</Text>
          </Card.Content>
        </Card>
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.rowBetween}>
            <Text variant="titleMedium" style={styles.bold}>
              Financial health
            </Text>
            <Text style={[styles.bold, { color: (d?.healthScore ?? 0) >= 70 ? colors.positive : (d?.healthScore ?? 0) >= 40 ? colors.warning : colors.negative }]}>{d?.healthScore ?? 0}/100</Text>
          </View>
          <UsageBar percent={100 - (d?.healthScore ?? 0)} />
          <Text style={styles.muted}>
            Based on savings rate, budget adherence, emergency fund and bills paid on time.
            {d?.budgetsOverLimit.length ? ` Over budget: ${d.budgetsOverLimit.join(', ')}.` : ''}
          </Text>
        </Card.Content>
      </Card>

      {data?.spending.monthlyTrend.length ? (
        <Section title="Income vs spending">
          <LineChart
            data={{
              labels: data.spending.monthlyTrend.map((m) => m.month),
              datasets: [
                { data: data.spending.monthlyTrend.map((m) => m.income), color: (o = 1) => `rgba(15,157,88,${o})` },
                { data: data.spending.monthlyTrend.map((m) => m.amount), color: (o = 1) => `rgba(217,48,37,${o})` },
              ],
              legend: ['Income', 'Spending'],
            }}
            width={width}
            height={200}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        </Section>
      ) : null}

      {d?.upcomingBills.length ? (
        <Section title="Upcoming bills">
          {d.upcomingBills.map((b) => (
            <Card key={b.id} style={styles.billCard} onPress={() => navigation.navigate('BillPayments')}>
              <Card.Title title={b.name} subtitle={`${b.status === 'OVERDUE' ? 'Overdue · ' : ''}due ${shortDate(b.dueDate)}${b.autoPay ? ' · autopay' : ''}`} right={() => <Text style={styles.billAmount}>{money(b.amount)}</Text>} />
            </Card>
          ))}
        </Section>
      ) : null}

      <Section title="Recent transactions" right={<Text style={styles.link} onPress={() => navigation.navigate('Transactions')}>See all</Text>}>
        {d?.recentTransactions.length ? d.recentTransactions.map((t) => <TxRow key={t.id} tx={t} onPress={() => navigation.navigate('TransactionDetail', { transactionId: t.id })} />) : <Text style={styles.muted}>No transactions yet</Text>}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primary, borderRadius: 16, padding: 20 },
  greeting: { color: '#dbeafe' },
  name: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  heroLabel: { color: '#dbeafe', marginTop: 16 },
  heroValue: { color: '#fff', fontSize: 34, fontWeight: 'bold' },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  heroSmall: { color: '#e0ecff', fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 16 },
  action: { alignItems: 'center' },
  actionText: { marginTop: 6, fontSize: 12, color: colors.text },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, backgroundColor: colors.surface },
  statLabel: { color: colors.muted, fontSize: 12 },
  statValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  card: { marginTop: 12, backgroundColor: colors.surface },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bold: { fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 12 },
  chart: { borderRadius: 12 },
  billCard: { marginBottom: 6, backgroundColor: colors.surface },
  billAmount: { fontWeight: '700', marginRight: 16 },
  link: { color: colors.primary, fontWeight: '600' },
  badge: { position: 'absolute', top: 4, right: 4 },
});
