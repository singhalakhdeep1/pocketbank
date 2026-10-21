import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, List, SegmentedButtons, Text } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { Wallet, Transaction as EthTransaction, isAddress, parseEther } from 'ethers';
import { ConfirmDialog, Empty, ErrorBanner, Field, Loading, Screen, Section, useToast } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import type { MainScreenProps } from '@/navigation/types';
import { bank } from '@/services/bank';
import { KEYS, getItem, setItem } from '@/services/secureStorage';
import { colors } from '@/theme';
import { authenticateWithBiometric, checkBiometricSupport } from '@/utils/biometric';
import { money, percent } from '@/utils/format';

/** Private key access always goes through Face ID / fingerprint when the device has it. */
async function unlockKey(prompt: string): Promise<string | null> {
  if ((await checkBiometricSupport()) && !(await authenticateWithBiometric(prompt))) return null;
  return getItem(KEYS.walletKey);
}

export default function CryptoWalletScreen({ navigation }: MainScreenProps<'CryptoWallet'>) {
  const [tab, setTab] = useState<'market' | 'wallet'>('market');
  const { data: market, error, loading, refreshing, refresh, reload } = useApi(async () => {
    const [prices, portfolio] = await Promise.all([bank.crypto.prices(), bank.investments.portfolio()]);
    return { prices, holdings: portfolio.holdings.filter((h) => h.assetType === 'CRYPTO') };
  });

  if (loading && !market) return <Loading />;
  const custodial = market?.holdings.reduce((s, h) => s + h.value, 0) ?? 0;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} testID="crypto">
      <SegmentedButtons
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
        buttons={[
          { value: 'market', label: 'Market & holdings', icon: 'chart-line' },
          { value: 'wallet', label: 'ETH wallet', icon: 'wallet-outline' },
        ]}
      />
      <ErrorBanner error={error} onRetry={reload} />
      {tab === 'market' ? (
        <>
          <Card style={styles.hero}>
            <Card.Content>
              <Text style={styles.heroLabel}>Crypto held with PocketBank</Text>
              <Text style={styles.heroValue}>{money(custodial)}</Text>
            </Card.Content>
          </Card>
          {market?.holdings.map((h) => (
            <List.Item
              key={h.id}
              title={`${h.quantity} ${h.symbol}`}
              description={`${money(h.value)} · gain ${money(h.gain)} (${percent(h.gainPercent)})`}
              left={(p) => <List.Icon {...p} icon="bitcoin" color="#f59e0b" />}
              onPress={() => navigation.navigate('InvestmentTracking', { symbol: h.symbol })}
              style={styles.item}
            />
          ))}
          <Section title="Live prices">
            {market?.prices.map((p) => (
              <List.Item
                key={p.symbol}
                title={`${p.symbol} · ${p.name}`}
                description={`${p.source}${p.stale ? ' (last known)' : ''}`}
                right={() => (
                  <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                    <Text style={styles.bold}>{money(p.price)}</Text>
                    <Text style={{ color: p.changePercent >= 0 ? colors.positive : colors.negative, fontSize: 12 }}>{percent(p.changePercent, 2)}</Text>
                  </View>
                )}
                onPress={() => navigation.navigate('InvestmentTracking', { symbol: p.symbol })}
                style={styles.item}
                testID={`crypto-${p.symbol}`}
              />
            ))}
          </Section>
        </>
      ) : (
        <EthWallet />
      )}
    </Screen>
  );
}

/** Self-custody Ethereum wallet: key generated on the device, signing local, API only relays. */
function EthWallet() {
  const { data, loading, reload } = useApi(async () => {
    const [status, wallets] = await Promise.all([bank.crypto.status(), bank.crypto.wallets()]);
    const wallet = wallets[0] ?? null;
    const [balance, txs] = wallet && status.onChainEnabled ? await Promise.all([bank.crypto.balance(wallet.id), bank.crypto.transactions(wallet.id)]) : [null, []];
    return { status, wallet, balance, txs };
  });
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (loading && !data) return <Loading />;
  if (!data?.status.onChainEnabled) return <Empty icon="ethereum" title="On-chain wallets are not enabled on this server (ETHEREUM_RPC_URL)" />;

  const create = async () => {
    setBusy(true);
    try {
      const wallet = Wallet.createRandom();
      await setItem(KEYS.walletKey, wallet.privateKey);
      await bank.crypto.link(wallet.address, 'Phone wallet');
      toast.show('Wallet created — the key never leaves this device');
      await reload();
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const importKey = async () => {
    const key = to.trim();
    try {
      const wallet = new Wallet(key);
      await setItem(KEYS.walletKey, wallet.privateKey);
      await bank.crypto.link(wallet.address, 'Imported wallet');
      setTo('');
      toast.show('Wallet imported');
      await reload();
    } catch {
      toast.show('That is not a valid private key');
    }
  };

  const review = async () => {
    if (!data.wallet) return;
    try {
      const params = await bank.crypto.txParams(data.wallet.id, to.trim(), amount);
      setFee(params.estimatedFeeEth);
      setConfirm(true);
    } catch (err) {
      toast.show((err as Error).message);
    }
  };

  const send = async () => {
    if (!data.wallet) return;
    setBusy(true);
    try {
      const key = await unlockKey('Sign crypto transfer');
      if (!key) return toast.show('Wallet key unavailable on this device');
      const p = await bank.crypto.txParams(data.wallet.id, to.trim(), amount);
      const signer = new Wallet(key);
      const signed = await signer.signTransaction(
        EthTransaction.from({
          type: 2,
          to: to.trim(),
          value: parseEther(amount),
          chainId: p.chainId,
          nonce: p.nonce,
          gasLimit: BigInt(p.gasLimit),
          maxFeePerGas: BigInt(p.maxFeePerGas),
          maxPriorityFeePerGas: BigInt(p.maxPriorityFeePerGas),
        }),
      );
      const tx = await bank.crypto.broadcast(data.wallet.id, signed);
      setConfirm(false);
      setTo('');
      setAmount('');
      toast.show(`Sent · ${tx.hash.slice(0, 12)}…`);
      setTimeout(() => void reload(), 2000);
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!data.wallet) {
    return (
      <View>
        <Empty icon="wallet-plus-outline" title="No wallet yet" />
        <Button mode="contained" icon="plus" onPress={create} loading={busy} testID="create-wallet">
          Create a wallet on this device
        </Button>
        <Field label="…or paste a private key to import" value={to} onChangeText={setTo} autoCapitalize="none" secureTextEntry style={{ marginTop: 16 }} />
        <Button disabled={!to} onPress={importKey}>
          Import
        </Button>
        {toast.node}
      </View>
    );
  }

  return (
    <View>
      <Card style={styles.hero}>
        <Card.Content>
          <Text style={styles.heroLabel}>{data.wallet.label}</Text>
          <Text style={styles.heroValue} testID="eth-balance">
            {data.balance ? `${data.balance.eth.toFixed(4)} ETH` : '—'}
          </Text>
          <Text style={styles.heroLabel}>{data.balance ? `≈ ${money(data.balance.usd)}` : ''}</Text>
          <Chip icon="content-copy" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={async () => (await Clipboard.setStringAsync(data.wallet!.address), toast.show('Address copied'))}>
            {data.wallet.address.slice(0, 8)}…{data.wallet.address.slice(-6)}
          </Chip>
        </Card.Content>
      </Card>
      <Section title="Send ETH">
        <Field label="Recipient address (0x…)" value={to} onChangeText={setTo} autoCapitalize="none" error={to && !isAddress(to.trim()) ? 'Invalid address' : null} testID="eth-to" />
        <Field label="Amount (ETH)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" testID="eth-amount" />
        <Button mode="contained" icon="send" disabled={!isAddress(to.trim()) || !(Number(amount) > 0)} onPress={review} testID="eth-review">
          Review
        </Button>
      </Section>
      <Section title="Activity">
        {data.txs.length ? null : <Text style={styles.muted}>No on-chain transfers yet</Text>}
        {data.txs.map((t) => (
          <List.Item key={t.id} title={`${(Number(t.valueWei) / 1e18).toFixed(4)} ETH → ${t.toAddress.slice(0, 8)}…`} description={`${t.status} · ${t.hash.slice(0, 14)}…`} left={(p) => <List.Icon {...p} icon={t.status === 'confirmed' ? 'check-circle' : t.status === 'failed' ? 'close-circle' : 'clock-outline'} />} />
        ))}
      </Section>
      <ConfirmDialog
        visible={confirm}
        title="Send ETH"
        body={`${amount} ETH to ${to.slice(0, 10)}…\nNetwork fee ≈ ${fee?.toFixed(6) ?? '?'} ETH\nOn-chain transfers cannot be reversed.`}
        confirmLabel="Sign & send"
        loading={busy}
        onDismiss={() => setConfirm(false)}
        onConfirm={send}
      />
      {toast.node}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#1e1b4b', marginVertical: 12 },
  heroLabel: { color: '#c7d2fe' },
  heroValue: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginVertical: 4 },
  item: { backgroundColor: colors.surface, borderRadius: 12, marginBottom: 6 },
  bold: { fontWeight: '700' },
  muted: { color: colors.muted },
});
