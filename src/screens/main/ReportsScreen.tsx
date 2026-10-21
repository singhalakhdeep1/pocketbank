import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, IconButton, SegmentedButtons, Text } from 'react-native-paper';
import { ErrorBanner, Loading, Screen, Section, useToast } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { bank } from '@/services/bank';
import { colors } from '@/theme';
import { saveAndShare } from '@/utils/files';
import { money } from '@/utils/format';

type ReportType = 'monthly' | 'annual' | 'tax';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Report {
  income?: number;
  expenses?: number;
  savings?: number;
  savingsRate?: number;
  dailyAverage?: number;
  transactionCount?: number;
  categoryBreakdown?: { category: string; amount: number; percentage: number }[];
  topMerchants?: { merchant: string; amount: number; count: number }[];
  months?: { label: string; income: number; expenses: number; net: number }[];
  interestIncome?: number;
  capitalGains?: { total: number; gains: number; losses: number; trades: { symbol: string; quantity: number; gain: number }[] };
  potentiallyDeductible?: { total: number };
  disclaimer?: string;
}

export default function ReportsScreen() {
  const now = new Date();
  const [type, setType] = useState<ReportType>('monthly');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const { data: report, error, loading, reload } = useApi(() => bank.reports.get<Report>(type, year, type === 'monthly' ? month : undefined), [type, year, month]);
  const { data: meta } = useApi(() => bank.meta());

  const shift = (delta: number) => {
    if (type !== 'monthly') return setYear((y) => y + delta);
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const exportAs = async (format: 'csv' | 'pdf') => {
    setBusy(format);
    try {
      await saveAndShare(await bank.reports.export(type, format, year, month));
      toast.show(`${format.toUpperCase()} ready`);
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const email = async () => {
    setBusy('email');
    try {
      const res = await bank.reports.email(type, 'pdf', year, month);
      toast.show(`Sent to ${res.to}`);
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const label = type === 'monthly' ? `${MONTHS[month - 1]} ${year}` : type === 'tax' ? `Tax year ${year}` : String(year);

  return (
    <View style={{ flex: 1 }}>
      <Screen testID="reports">
        <SegmentedButtons
          value={type}
          onValueChange={(v) => setType(v as ReportType)}
          buttons={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'annual', label: 'Annual' },
            { value: 'tax', label: 'Tax' },
          ]}
        />
        <View style={styles.period}>
          <IconButton icon="chevron-left" onPress={() => shift(-1)} />
          <Text variant="titleMedium" style={styles.bold} testID="report-period">
            {label}
          </Text>
          <IconButton icon="chevron-right" onPress={() => shift(1)} />
        </View>
        <View style={styles.exports}>
          <Button icon="file-pdf-box" loading={busy === 'pdf'} onPress={() => exportAs('pdf')} testID="report-pdf">
            PDF
          </Button>
          <Button icon="file-delimited-outline" loading={busy === 'csv'} onPress={() => exportAs('csv')} testID="report-csv">
            CSV
          </Button>
          <Button icon="email-outline" loading={busy === 'email'} disabled={!meta?.features.email} onPress={email}>
            Email
          </Button>
        </View>
        <ErrorBanner error={error} onRetry={reload} />
        {loading && !report ? (
          <Loading />
        ) : report ? (
          type === 'tax' ? (
            <>
              <Card style={styles.card}>
                <Card.Content>
                  <Row label="Interest income" value={money(report.interestIncome ?? 0)} />
                  <Row label="Realized capital gains" value={money(report.capitalGains?.total ?? 0)} />
                  <Row label="  gains / losses" value={`${money(report.capitalGains?.gains ?? 0)} / ${money(report.capitalGains?.losses ?? 0)}`} />
                  <Row label="Potentially deductible" value={money(report.potentiallyDeductible?.total ?? 0)} />
                </Card.Content>
              </Card>
              {report.capitalGains?.trades.length ? (
                <Section title="Sales">
                  {report.capitalGains.trades.map((t, i) => (
                    <Row key={i} label={`${t.quantity} ${t.symbol}`} value={money(t.gain)} />
                  ))}
                </Section>
              ) : null}
              <Text style={styles.muted}>{report.disclaimer}</Text>
            </>
          ) : (
            <>
              <Card style={styles.card}>
                <Card.Content>
                  <Row label="Income" value={money(report.income ?? 0)} color={colors.positive} />
                  <Row label="Expenses" value={money(report.expenses ?? 0)} color={colors.negative} />
                  <Row label="Saved" value={`${money(report.savings ?? 0)} (${(report.savingsRate ?? 0).toFixed(0)}%)`} />
                  {report.dailyAverage !== undefined ? <Row label="Daily average spend" value={money(report.dailyAverage)} /> : null}
                  <Row label="Transactions" value={String(report.transactionCount ?? 0)} />
                </Card.Content>
              </Card>
              {report.months ? (
                <Section title="By month">
                  {report.months.map((m) => (
                    <Row key={m.label} label={m.label} value={`${money(m.income)} in · ${money(m.expenses)} out`} />
                  ))}
                </Section>
              ) : null}
              <Section title="Spending by category">
                {report.categoryBreakdown?.map((c) => <Row key={c.category} label={c.category} value={`${money(c.amount)} · ${c.percentage.toFixed(0)}%`} />)}
              </Section>
              {report.topMerchants?.length ? (
                <Section title="Top merchants">
                  {report.topMerchants.map((m) => (
                    <Row key={m.merchant} label={`${m.merchant} (${m.count}×)`} value={money(m.amount)} />
                  ))}
                </Section>
              ) : null}
            </>
          )
        ) : null}
      </Screen>
      {toast.node}
    </View>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.row}>
      <Text>{label}</Text>
      <Text style={[styles.bold, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  period: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  exports: { flexDirection: 'row', justifyContent: 'center' },
  card: { backgroundColor: colors.surface, marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.surfaceAlt },
  bold: { fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 12, marginTop: 12 },
});
