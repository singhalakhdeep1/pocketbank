import React, { useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { Button, Chip, List, Menu, Text, TextInput } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { ErrorBanner, Loading, Screen, Section, useToast } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import type { MainScreenProps } from '@/navigation/types';
import { authHeader, buildUrl } from '@/services/api';
import { bank } from '@/services/bank';
import { useAppDispatch } from '@/store';
import { transactionUpdated } from '@/store/slices/transactionsSlice';
import { colors } from '@/theme';
import { longDate, signedMoney, titleCase } from '@/utils/format';

export default function TransactionDetailScreen({ route }: MainScreenProps<'TransactionDetail'>) {
  const { transactionId } = route.params;
  const dispatch = useAppDispatch();
  const { data, setData, error, loading, reload } = useApi(async () => {
    const [tx, categories, headers] = await Promise.all([bank.transactions.get(transactionId), bank.transactions.categories(), authHeader()]);
    return { tx, categories, headers };
  }, [transactionId]);
  const [notes, setNotes] = useState<string | null>(null);
  const [tag, setTag] = useState('');
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBanner error={error} onRetry={reload} />;
  const { tx } = data;

  const save = async (patch: { category?: string; notes?: string | null; tags?: string[] }) => {
    setBusy(true);
    try {
      const updated = await bank.transactions.update(tx.id, patch);
      setData({ ...data, tx: { ...updated, related: tx.related } });
      dispatch(transactionUpdated(updated));
      toast.show('Saved');
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const attachReceipt = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const form = new FormData();
    if (Platform.OS === 'web') {
      form.append('file', await (await fetch(asset.uri)).blob(), asset.fileName ?? 'receipt.jpg');
    } else {
      form.append('file', { uri: asset.uri, name: asset.fileName ?? 'receipt.jpg', type: asset.mimeType ?? 'image/jpeg' } as unknown as Blob);
    }
    setBusy(true);
    try {
      const updated = await bank.transactions.uploadReceipt(tx.id, form);
      setData({ ...data, tx: { ...updated, related: tx.related } });
      toast.show('Receipt attached');
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen testID="tx-detail">
        <Text style={[styles.amount, { color: tx.direction === 'CREDIT' ? colors.positive : colors.text }]}>{signedMoney(tx.signedAmount, tx.currency)}</Text>
        <Text variant="titleMedium" style={styles.center}>
          {tx.description}
        </Text>
        <Text style={[styles.center, styles.muted]}>{longDate(tx.createdAt)}</Text>

        <Section title="Details">
          <List.Item title="Type" description={titleCase(tx.type)} />
          {tx.counterparty ? <List.Item title="Counterparty" description={tx.counterparty} /> : null}
          {tx.merchant ? <List.Item title="Merchant" description={tx.merchant} /> : null}
          <List.Item title="Balance after" description={signedMoney(tx.balanceAfter, tx.currency).replace('+', '')} />
          {tx.fxRate ? <List.Item title="Exchange rate" description={tx.fxRate.toFixed(4)} /> : null}
          <List.Item title="Status" description={tx.status} />
          <List.Item title="Reference" description={tx.reference} descriptionNumberOfLines={2} />
        </Section>

        <Section title="Category">
          <Menu visible={menu} onDismiss={() => setMenu(false)} anchor={<Chip icon="shape-outline" onPress={() => setMenu(true)} testID="tx-detail-category">{tx.category}</Chip>}>
            {data.categories.map((c) => (
              <Menu.Item key={c} title={c} onPress={() => (setMenu(false), void save({ category: c }))} />
            ))}
          </Menu>
        </Section>

        <Section title="Notes & tags">
          <TextInput mode="outlined" multiline value={notes ?? tx.notes ?? ''} onChangeText={setNotes} placeholder="Add a note" testID="tx-notes" />
          <Button disabled={busy || notes === null} onPress={() => save({ notes: notes || null })} style={styles.saveBtn} testID="save-notes">
            Save note
          </Button>
          <View style={styles.tags}>
            {tx.tags.map((t) => (
              <Chip key={t} onClose={() => save({ tags: tx.tags.filter((x) => x !== t) })} style={styles.tag}>
                #{t}
              </Chip>
            ))}
          </View>
          <TextInput
            mode="outlined"
            dense
            value={tag}
            onChangeText={setTag}
            placeholder="Add tag and press enter"
            onSubmitEditing={() => tag.trim() && (void save({ tags: [...tx.tags, tag.trim().toLowerCase()] }), setTag(''))}
            testID="tx-tag"
          />
        </Section>

        <Section title="Receipt">
          {tx.hasReceipt ? (
            <Image source={{ uri: buildUrl(`/transactions/${tx.id}/receipt`), headers: data.headers }} style={styles.receipt} resizeMode="contain" />
          ) : (
            <Text style={styles.muted}>No receipt attached</Text>
          )}
          <Button icon="camera-plus-outline" onPress={attachReceipt} loading={busy} style={styles.saveBtn}>
            {tx.hasReceipt ? 'Replace receipt' : 'Attach receipt'}
          </Button>
        </Section>

        {tx.related?.length ? (
          <Section title="Linked transaction">
            {tx.related.map((r) => (
              <List.Item key={r.id} title={r.description} description={`${r.direction} · ${signedMoney(r.signedAmount, r.currency)}`} />
            ))}
          </Section>
        ) : null}
      </Screen>
      {toast.node}
    </View>
  );
}

const styles = StyleSheet.create({
  amount: { fontSize: 36, fontWeight: 'bold', textAlign: 'center', marginTop: 8 },
  center: { textAlign: 'center' },
  muted: { color: colors.muted },
  saveBtn: { alignSelf: 'flex-end', marginTop: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 6 },
  tag: { marginRight: 6, marginBottom: 6 },
  receipt: { width: '100%', height: 220, borderRadius: 12, backgroundColor: colors.surfaceAlt },
});
