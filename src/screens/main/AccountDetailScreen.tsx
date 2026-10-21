import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { ConfirmDialog, ErrorBanner, Loading, Screen, Section, TxRow, useToast } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import type { MainScreenProps } from '@/navigation/types';
import { bank } from '@/services/bank';
import { useAppDispatch } from '@/store';
import { fetchAccounts } from '@/store/slices/accountsSlice';
import { colors } from '@/theme';
import { saveAndShare } from '@/utils/files';
import { money, titleCase } from '@/utils/format';

export default function AccountDetailScreen({ route, navigation }: MainScreenProps<'AccountDetail'>) {
  const { accountId } = route.params;
  const dispatch = useAppDispatch();
  const { data, error, loading, refreshing, refresh, reload } = useApi(
    async () => {
      const [account, txs, meta] = await Promise.all([bank.accounts.get(accountId), bank.transactions.list({ accountId, limit: 10 }), bank.meta()]);
      return { account, txs: txs.items, meta };
    },
    [accountId],
  );
  const [busy, setBusy] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const toast = useToast();

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBanner error={error} onRetry={reload} />;
  const { account } = data;

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.show(ok);
      await reload();
      void dispatch(fetchAccounts());
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const now = new Date();
  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={refresh} testID="account-detail">
        <Card style={styles.hero}>
          <Card.Content>
            <Text style={styles.heroLabel}>
              {account.nickname || titleCase(account.accountType)} · {account.accountNumber}
            </Text>
            <Text style={styles.heroValue} testID="account-balance">
              {money(account.balance, account.currency)}
            </Text>
            <Text style={styles.heroLabel}>
              In {money(account.thisMonth.incoming, account.currency)} · Out {money(account.thisMonth.outgoing, account.currency)} this month
            </Text>
            {account.status !== 'ACTIVE' ? <Text style={[styles.heroLabel, { fontWeight: '700' }]}>Status: {account.status}</Text> : null}
          </Card.Content>
        </Card>
        <View style={styles.actions}>
          <Button mode="contained" icon="swap-horizontal" onPress={() => navigation.navigate('Transfer', { fromAccountId: account.id })}>
            Transfer
          </Button>
          <Button mode="contained-tonal" icon="credit-card-plus" onPress={() => navigation.navigate('TopUp', { accountId: account.id })}>
            Add money
          </Button>
        </View>
        <View style={styles.actions}>
          <Button
            mode="outlined"
            icon={account.status === 'FROZEN' ? 'lock-open-variant' : 'snowflake'}
            loading={busy}
            onPress={() => act(() => bank.accounts.update(account.id, { status: account.status === 'FROZEN' ? 'ACTIVE' : 'FROZEN' }), account.status === 'FROZEN' ? 'Account unfrozen' : 'Account frozen')}
            testID="freeze-account"
          >
            {account.status === 'FROZEN' ? 'Unfreeze' : 'Freeze'}
          </Button>
          <Button mode="outlined" icon="file-pdf-box" onPress={() => act(async () => saveAndShare(await bank.accounts.statement(account.id, now.getFullYear(), now.getMonth() + 1)), 'Statement downloaded')}>
            Statement
          </Button>
        </View>
        {data.meta.features.sandboxDeposits ? (
          <Button icon="flask-outline" onPress={() => act(() => bank.accounts.deposit(account.id, 500), 'Sandbox deposit of 500 added')} testID="sandbox-deposit">
            Add 500 sandbox funds
          </Button>
        ) : null}
        <Section title="Recent activity" right={<Text style={styles.link} onPress={() => navigation.navigate('Transactions', { accountId })}>See all</Text>}>
          {data.txs.length ? data.txs.map((t) => <TxRow key={t.id} tx={t} onPress={() => navigation.navigate('TransactionDetail', { transactionId: t.id })} />) : <Text style={styles.muted}>No activity yet</Text>}
        </Section>
        <Button textColor={colors.negative} style={{ marginTop: 16 }} onPress={() => setCloseOpen(true)}>
          Close account
        </Button>
      </Screen>
      <ConfirmDialog
        visible={closeOpen}
        title="Close this account?"
        body="The balance must be zero. Linked cards will be cancelled."
        confirmLabel="Close account"
        onDismiss={() => setCloseOpen(false)}
        loading={busy}
        onConfirm={async () => {
          setCloseOpen(false);
          await act(() => bank.accounts.close(account.id), 'Account closed');
          navigation.goBack();
        }}
      />
      {toast.node}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primary },
  heroLabel: { color: '#dbeafe' },
  heroValue: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginVertical: 6 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  link: { color: colors.primary, fontWeight: '600' },
  muted: { color: colors.muted },
});
