import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Chip, Menu, Searchbar, Text } from 'react-native-paper';
import { Empty, ErrorBanner, TxRow, useToast } from '@/components/ui';
import type { MainScreenProps } from '@/navigation/types';
import { bank, type TxQuery } from '@/services/bank';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchTransactions } from '@/store/slices/transactionsSlice';
import { colors } from '@/theme';
import { saveAndShare } from '@/utils/files';

const RANGES = { all: undefined, '7d': 7, '30d': 30, '90d': 90 } as const;

export default function TransactionsScreen({ route, navigation }: MainScreenProps<'Transactions'>) {
  const dispatch = useAppDispatch();
  const { transactions, loading, error, nextCursor } = useAppSelector((s) => s.transactions);
  const [q, setQ] = useState('');
  const [direction, setDirection] = useState<TxQuery['direction']>();
  const [category, setCategory] = useState<string | undefined>(route.params?.category);
  const [range, setRange] = useState<keyof typeof RANGES>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [menu, setMenu] = useState(false);
  const toast = useToast();

  const filters: TxQuery = {
    accountId: route.params?.accountId,
    q: q || undefined,
    direction,
    category,
    from: RANGES[range] ? new Date(Date.now() - (RANGES[range] as number) * 86_400_000).toISOString() : undefined,
    limit: 30,
  };
  const key = JSON.stringify(filters);

  useEffect(() => {
    const t = setTimeout(() => void dispatch(fetchTransactions({ filters })), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dispatch]);

  useEffect(() => {
    void bank.transactions.categories().then(setCategories).catch(() => undefined);
  }, []);

  const exportAs = async (format: 'csv' | 'pdf') => {
    try {
      await saveAndShare(await bank.transactions.export(format, { ...filters, limit: undefined }));
      toast.show(`Exported ${format.toUpperCase()}`);
    } catch (err) {
      toast.show((err as Error).message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <Searchbar placeholder="Search merchant, note, account" value={q} onChangeText={setQ} style={styles.search} testID="tx-search" />
        <View style={styles.chips}>
          <Chip selected={!direction} onPress={() => setDirection(undefined)} style={styles.chip}>
            All
          </Chip>
          <Chip selected={direction === 'DEBIT'} onPress={() => setDirection('DEBIT')} style={styles.chip}>
            Money out
          </Chip>
          <Chip selected={direction === 'CREDIT'} onPress={() => setDirection('CREDIT')} style={styles.chip}>
            Money in
          </Chip>
          <Menu visible={menu} onDismiss={() => setMenu(false)} anchor={<Chip icon="shape-outline" onPress={() => setMenu(true)} style={styles.chip} testID="tx-category">{category ?? 'Category'}</Chip>}>
            <Menu.Item title="Any category" onPress={() => (setCategory(undefined), setMenu(false))} />
            {categories.map((c) => (
              <Menu.Item key={c} title={c} onPress={() => (setCategory(c), setMenu(false))} />
            ))}
          </Menu>
          {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
            <Chip key={r} selected={range === r} onPress={() => setRange(r)} style={styles.chip} compact>
              {r === 'all' ? 'Any time' : r}
            </Chip>
          ))}
        </View>
        <View style={styles.exportRow}>
          <Button compact icon="file-delimited-outline" onPress={() => exportAs('csv')} testID="export-csv">
            CSV
          </Button>
          <Button compact icon="file-pdf-box" onPress={() => exportAs('pdf')}>
            PDF
          </Button>
        </View>
      </View>
      <ErrorBanner error={error} onRetry={() => dispatch(fetchTransactions({ filters }))} />
      <FlatList
        testID="tx-list"
        data={transactions}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <TxRow tx={item} onPress={() => navigation.navigate('TransactionDetail', { transactionId: item.id })} />}
        contentContainerStyle={styles.list}
        refreshing={loading && transactions.length === 0}
        onRefresh={() => dispatch(fetchTransactions({ filters }))}
        onEndReachedThreshold={0.4}
        onEndReached={() => nextCursor && !loading && dispatch(fetchTransactions({ more: true }))}
        ListEmptyComponent={loading ? undefined : <Empty icon="receipt" title="No transactions match" />}
        ListFooterComponent={nextCursor ? <Button onPress={() => dispatch(fetchTransactions({ more: true }))} loading={loading}>Load more</Button> : transactions.length ? <Text style={styles.end}>That's everything</Text> : undefined}
      />
      {toast.node}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filters: { padding: 12, paddingBottom: 0 },
  search: { marginBottom: 8, backgroundColor: colors.surface },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { marginRight: 6, marginBottom: 6 },
  exportRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  list: { padding: 12 },
  end: { textAlign: 'center', color: colors.muted, padding: 12 },
});
