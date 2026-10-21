import React, { useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, List, Searchbar, SegmentedButtons, Text } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import { AccountPicker, ConfirmDialog, Field, Loading, Screen, Section, useToast } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import type { MainScreenProps } from '@/navigation/types';
import { bank } from '@/services/bank';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchAccounts } from '@/store/slices/accountsSlice';
import { chartConfig, colors } from '@/theme';
import { money, parseAmount, percent, titleCase } from '@/utils/format';

const width = Math.min(Dimensions.get('window').width, 520) - 32;

/** Search instruments, see a live quote + 30-day chart, and buy or sell by quantity or amount. */
export default function InvestmentTracking({ route }: MainScreenProps<'InvestmentTracking'>) {
  const dispatch = useAppDispatch();
  const accounts = useAppSelector((s) => s.accounts.accounts).filter((a) => a.currency === 'USD');
  const [symbol, setSymbol] = useState(route.params?.symbol ?? 'AAPL');
  const [q, setQ] = useState('');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [mode, setMode] = useState<'amount' | 'quantity'>('amount');
  const [value, setValue] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const { data: instruments } = useApi(() => bank.investments.instruments(q), [q]);
  const { data, loading, reload } = useApi(
    async () => {
      const [quote, history, portfolio] = await Promise.all([bank.investments.quote(symbol), bank.investments.history(symbol, 30), bank.investments.portfolio()]);
      return { quote, history, holding: portfolio.holdings.find((h) => h.symbol === symbol) };
    },
    [symbol],
  );

  const n = parseAmount(value);
  const estimate = data && n ? (mode === 'amount' ? n : n * data.quote.price) : 0;
  const source = accountId ?? accounts.find((a) => a.accountType === 'CHECKING')?.id ?? accounts[0]?.id ?? null;

  const trade = async () => {
    if (!n) return;
    setBusy(true);
    try {
      const res = await bank.investments.trade({ symbol, side, accountId: source ?? undefined, ...(mode === 'amount' ? { amount: n } : { quantity: n }) });
      setConfirm(false);
      setValue('');
      toast.show(`${res.side === 'BUY' ? 'Bought' : 'Sold'} ${res.quantity} ${res.symbol} for ${money(res.total)}${res.side === 'SELL' ? ` (gain ${money(res.realizedGain)})` : ''}`);
      void dispatch(fetchAccounts());
      await reload();
    } catch (err) {
      setConfirm(false);
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const points = data?.history.points ?? [];
  const sampled = points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 8)) === 0 || i === points.length - 1);

  return (
    <View style={{ flex: 1 }}>
      <Screen testID="trade">
        <Searchbar placeholder="Search stocks, ETFs, funds, crypto" value={q} onChangeText={setQ} style={{ backgroundColor: colors.surface, marginBottom: 8 }} />
        <View style={styles.chips}>
          {(instruments ?? []).slice(0, q ? 12 : 10).map((i) => (
            <Chip key={i.symbol} selected={i.symbol === symbol} onPress={() => setSymbol(i.symbol)} style={styles.chip} compact testID={`instrument-${i.symbol}`}>
              {i.symbol}
            </Chip>
          ))}
        </View>
        {loading && !data ? (
          <Loading />
        ) : data ? (
          <>
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleLarge" style={styles.bold}>
                  {data.quote.symbol} · {data.quote.name}
                </Text>
                <Text style={styles.price} testID="quote-price">
                  {money(data.quote.price)}
                </Text>
                <Text style={{ color: data.quote.change >= 0 ? colors.positive : colors.negative }}>
                  {percent(data.quote.changePercent, 2)} today · {titleCase(data.quote.assetType)} · {data.quote.source}
                  {data.quote.stale ? ' (last known price)' : ''}
                </Text>
                {data.holding ? (
                  <Text style={styles.muted}>
                    You own {data.holding.quantity} · worth {money(data.holding.value)} · gain {money(data.holding.gain)}
                  </Text>
                ) : null}
              </Card.Content>
            </Card>
            {sampled.length > 1 ? (
              <LineChart
                data={{ labels: sampled.map((p) => p.date.slice(5)), datasets: [{ data: sampled.map((p) => p.close) }] }}
                width={width}
                height={180}
                chartConfig={{ ...chartConfig, decimalPlaces: 2 }}
                bezier
                withDots={false}
                style={{ borderRadius: 12, marginTop: 8 }}
              />
            ) : null}
            <Section title="Place an order">
              <SegmentedButtons value={side} onValueChange={(v) => setSide(v as typeof side)} buttons={[{ value: 'BUY', label: 'Buy' }, { value: 'SELL', label: 'Sell' }]} style={{ marginBottom: 8 }} />
              <SegmentedButtons value={mode} onValueChange={(v) => setMode(v as typeof mode)} buttons={[{ value: 'amount', label: 'By amount ($)' }, { value: 'quantity', label: 'By quantity' }]} style={{ marginBottom: 8 }} />
              <AccountPicker accounts={accounts} value={source} onChange={setAccountId} label={side === 'BUY' ? 'Pay from' : 'Pay into'} />
              <Field label={mode === 'amount' ? 'Amount in USD' : 'Units'} value={value} onChangeText={setValue} keyboardType="decimal-pad" testID="trade-value" />
              {n ? <Text style={styles.muted}>Estimated {money(estimate)} at {money(data.quote.price)}</Text> : null}
              <Button mode="contained" disabled={!n || busy} onPress={() => setConfirm(true)} style={{ marginTop: 8 }} buttonColor={side === 'SELL' ? colors.negative : undefined} testID="trade-submit">
                Review {side === 'BUY' ? 'buy' : 'sell'}
              </Button>
            </Section>
          </>
        ) : null}
        <TradeHistory />
      </Screen>
      <ConfirmDialog
        visible={confirm}
        title={`${side === 'BUY' ? 'Buy' : 'Sell'} ${symbol}`}
        body={`About ${money(estimate)} (${mode === 'amount' ? `${value} USD` : `${value} units`}). Prices move — the executed price may differ slightly.`}
        confirmLabel={side === 'BUY' ? 'Buy' : 'Sell'}
        loading={busy}
        onDismiss={() => setConfirm(false)}
        onConfirm={trade}
      />
      {toast.node}
    </View>
  );
}

function TradeHistory() {
  const { data } = useApi(() => bank.investments.trades());
  if (!data?.length) return null;
  return (
    <Section title="Recent trades">
      {data.slice(0, 8).map((t) => (
        <List.Item key={t.id} title={`${t.side} ${t.quantity} ${t.symbol}`} description={`${new Date(t.createdAt).toLocaleDateString()} @ ${money(t.price)}`} right={() => <Text style={{ alignSelf: 'center', fontWeight: '700' }}>{money(t.total)}</Text>} />
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  chip: { marginRight: 6, marginBottom: 6 },
  card: { backgroundColor: colors.surface },
  bold: { fontWeight: '700' },
  price: { fontSize: 28, fontWeight: 'bold', marginVertical: 4 },
  muted: { color: colors.muted, fontSize: 12, marginTop: 4 },
});
