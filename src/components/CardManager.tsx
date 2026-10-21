import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, List, Portal, Switch, Text, TextInput } from 'react-native-paper';
import { useApi } from '@/hooks/useApi';
import { bank } from '@/services/bank';
import { useAppSelector } from '@/store';
import { colors } from '@/theme';
import type { Card } from '@/types';
import { authenticateWithBiometric, checkBiometricSupport } from '@/utils/biometric';
import { money, parseAmount } from '@/utils/format';
import { AccountPicker, ChipGroup, ConfirmDialog, Empty, ErrorBanner, Loading, Screen, Section, UsageBar, useToast } from './ui';

const NETWORK_COLOR: Record<Card['network'], string> = { VISA: '#1a1f71', MASTERCARD: '#3a3a3a' };

function CardFace({ card, revealed }: { card: Card; revealed: { cardNumber: string; cvv: string } | null }) {
  return (
    <View style={[styles.face, { backgroundColor: card.status === 'FROZEN' ? '#64748b' : NETWORK_COLOR[card.network] }]} testID={`card-face-${card.last4}`}>
      <View style={styles.faceRow}>
        <Text style={styles.faceType}>{card.label ?? (card.kind === 'VIRTUAL' ? 'Virtual card' : 'Debit card')}</Text>
        <Text style={styles.faceStatus}>{card.status}</Text>
      </View>
      <Text style={styles.faceNumber} testID="card-number">
        {revealed ? revealed.cardNumber : card.maskedNumber}
      </Text>
      <View style={styles.faceRow}>
        <View>
          <Text style={styles.faceLabel}>Cardholder</Text>
          <Text style={styles.faceValue}>{card.cardholder}</Text>
        </View>
        <View>
          <Text style={styles.faceLabel}>Expires</Text>
          <Text style={styles.faceValue}>{card.expiry}</Text>
        </View>
        <View>
          <Text style={styles.faceLabel}>CVV</Text>
          <Text style={styles.faceValue} testID="card-cvv">
            {revealed ? revealed.cvv : '•••'}
          </Text>
        </View>
      </View>
      <Text style={styles.faceNetwork}>{card.network}</Text>
    </View>
  );
}

export function CardManager({ kind }: { kind: Card['kind'] }) {
  const accounts = useAppSelector((s) => s.accounts.accounts);
  const { data: cards, error, loading, refreshing, refresh, reload, setData } = useApi(() => bank.cards.list(kind), [kind]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ cardNumber: string; cvv: string } | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [daily, setDaily] = useState('');
  const [monthly, setMonthly] = useState('');
  const [activateOpen, setActivateOpen] = useState(false);
  const [last4, setLast4] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [network, setNetwork] = useState<Card['network']>('VISA');
  const [label, setLabel] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (loading && !cards) return <Loading />;
  const card = cards?.find((c) => c.id === selectedId) ?? cards?.[0] ?? null;

  const replace = (updated: Card) => setData((list) => (list ?? []).map((c) => (c.id === updated.id ? updated : c)));
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.show(ok);
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reveal = async () => {
    if (!card) return;
    // On a phone the full number also needs Face ID / fingerprint.
    if ((await checkBiometricSupport()) && !(await authenticateWithBiometric('Show card details'))) return;
    await run(async () => {
      const details = await bank.cards.reveal(card.id, password);
      setRevealed(details);
      setRevealOpen(false);
      setPassword('');
      setTimeout(() => setRevealed(null), 30_000);
    }, 'Card details shown for 30 seconds');
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={refresh} testID={`cards-${kind}`}>
        <ErrorBanner error={error} onRetry={reload} />
        {!card ? (
          <Empty icon="credit-card-outline" title={kind === 'VIRTUAL' ? 'No virtual cards yet' : 'No cards yet'} />
        ) : (
          <>
            {cards && cards.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {cards.map((c) => (
                  <Button key={c.id} mode={c.id === card.id ? 'contained' : 'outlined'} compact style={{ marginRight: 8 }} onPress={() => (setSelectedId(c.id), setRevealed(null))}>
                    {c.label ?? c.network} ·{c.last4}
                  </Button>
                ))}
              </ScrollView>
            ) : null}
            <CardFace card={card} revealed={revealed} />
            <View style={styles.buttons}>
              {card.status === 'INACTIVE' ? (
                <Button mode="contained" icon="check-decagram" onPress={() => setActivateOpen(true)} testID="activate-card">
                  Activate
                </Button>
              ) : (
                <Button
                  mode="contained-tonal"
                  icon={card.status === 'FROZEN' ? 'lock-open-variant' : 'snowflake'}
                  loading={busy}
                  onPress={() => run(async () => replace(await (card.status === 'FROZEN' ? bank.cards.unfreeze(card.id) : bank.cards.freeze(card.id))), card.status === 'FROZEN' ? 'Card unfrozen' : 'Card frozen')}
                  testID="freeze-card"
                >
                  {card.status === 'FROZEN' ? 'Unfreeze' : 'Freeze'}
                </Button>
              )}
              <Button mode="contained-tonal" icon={revealed ? 'eye-off' : 'eye'} onPress={() => (revealed ? setRevealed(null) : setRevealOpen(true))} testID="reveal-card">
                {revealed ? 'Hide' : 'Show details'}
              </Button>
            </View>
            <Section title="Spending limits" right={<Button compact onPress={() => (setDaily(String(card.dailyLimit)), setMonthly(String(card.monthlyLimit)), setLimitsOpen(true))} testID="edit-limits">Edit</Button>}>
              <Text>
                Today {money(card.spentToday, card.currency)} of {money(card.dailyLimit, card.currency)}
              </Text>
              <UsageBar percent={(card.spentToday / card.dailyLimit) * 100} />
              <Text>
                This month {money(card.spentThisMonth, card.currency)} of {money(card.monthlyLimit, card.currency)}
              </Text>
              <UsageBar percent={(card.spentThisMonth / card.monthlyLimit) * 100} />
              <Text style={styles.muted}>
                Linked account ·{card.accountNumber.slice(-4)} · available {money(card.availableBalance, card.currency)}
              </Text>
            </Section>
            <Section title="Controls">
              <List.Item
                title="Online payments"
                left={(p) => <List.Icon {...p} icon="web" />}
                right={() => <Switch value={card.onlineEnabled} onValueChange={(v) => run(async () => replace(await bank.cards.update(card.id, { onlineEnabled: v })), 'Saved')} />}
                style={styles.item}
              />
              <List.Item
                title="Contactless"
                left={(p) => <List.Icon {...p} icon="contactless-payment" />}
                right={() => <Switch value={card.contactlessEnabled} onValueChange={(v) => run(async () => replace(await bank.cards.update(card.id, { contactlessEnabled: v })), 'Saved')} />}
                style={styles.item}
              />
            </Section>
            <Button textColor={colors.negative} icon="close-circle-outline" style={{ marginTop: 12 }} onPress={() => setCancelOpen(true)}>
              Cancel this card
            </Button>
          </>
        )}
        <Button mode="contained" icon="plus" style={{ marginTop: 16 }} onPress={() => (setAccountId(accounts.find((a) => a.accountType === 'CHECKING')?.id ?? accounts[0]?.id ?? null), setNewOpen(true))} testID="new-card">
          {kind === 'VIRTUAL' ? 'Create virtual card' : 'Order a card'}
        </Button>
      </Screen>

      <Portal>
        <Dialog visible={revealOpen} onDismiss={() => setRevealOpen(false)}>
          <Dialog.Title>Confirm it is you</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Password" secureTextEntry value={password} onChangeText={setPassword} mode="outlined" testID="reveal-password" />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRevealOpen(false)}>Cancel</Button>
            <Button mode="contained" onPress={reveal} loading={busy} disabled={!password} testID="reveal-confirm">
              Show
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={limitsOpen} onDismiss={() => setLimitsOpen(false)}>
          <Dialog.Title>Spending limits</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Daily limit" value={daily} onChangeText={setDaily} keyboardType="decimal-pad" mode="outlined" style={{ marginBottom: 8 }} testID="daily-limit" />
            <TextInput label="Monthly limit" value={monthly} onChangeText={setMonthly} keyboardType="decimal-pad" mode="outlined" />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLimitsOpen(false)}>Cancel</Button>
            <Button
              mode="contained"
              loading={busy}
              onPress={() =>
                card &&
                run(async () => {
                  replace(await bank.cards.update(card.id, { dailyLimit: parseAmount(daily) ?? card.dailyLimit, monthlyLimit: parseAmount(monthly) ?? card.monthlyLimit }));
                  setLimitsOpen(false);
                }, 'Limits updated')
              }
              testID="save-limits"
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={activateOpen} onDismiss={() => setActivateOpen(false)}>
          <Dialog.Title>Activate card</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 8 }}>Enter the last 4 digits printed on the card.</Text>
            <TextInput value={last4} onChangeText={(v) => setLast4(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" mode="outlined" />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setActivateOpen(false)}>Cancel</Button>
            <Button mode="contained" disabled={last4.length !== 4} onPress={() => card && run(async () => (replace(await bank.cards.activate(card.id, last4)), setActivateOpen(false)), 'Card activated')}>
              Activate
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={newOpen} onDismiss={() => setNewOpen(false)}>
          <Dialog.Title>{kind === 'VIRTUAL' ? 'New virtual card' : 'Order a debit card'}</Dialog.Title>
          <Dialog.Content>
            <ChipGroup options={['VISA', 'MASTERCARD'] as const} value={network} onChange={setNetwork} labels={{ VISA: 'Visa', MASTERCARD: 'Mastercard' }} />
            <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} label="Linked account" />
            {kind === 'VIRTUAL' ? <TextInput label="Label (e.g. Subscriptions)" value={label} onChangeText={setLabel} mode="outlined" testID="card-label" /> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setNewOpen(false)}>Cancel</Button>
            <Button
              mode="contained"
              loading={busy}
              onPress={() =>
                run(async () => {
                  const created = await bank.cards.create({ kind, network, accountId: accountId ?? undefined, label: label || undefined });
                  setData((list) => [...(list ?? []), created]);
                  setSelectedId(created.id);
                  setNewOpen(false);
                  setLabel('');
                }, kind === 'VIRTUAL' ? 'Virtual card ready to use' : 'Card ordered — activate it when it arrives')
              }
              testID="create-card"
            >
              Create
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <ConfirmDialog
        visible={cancelOpen}
        title="Cancel card?"
        body="The card stops working immediately. This cannot be undone."
        confirmLabel="Cancel card"
        onDismiss={() => setCancelOpen(false)}
        onConfirm={() =>
          card &&
          run(async () => {
            await bank.cards.cancel(card.id);
            setCancelOpen(false);
            setSelectedId(null);
            await reload();
          }, 'Card cancelled')
        }
      />
      {toast.node}
    </View>
  );
}

const styles = StyleSheet.create({
  face: { borderRadius: 18, padding: 22, minHeight: 190, justifyContent: 'space-between' },
  faceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faceType: { color: '#fff', fontWeight: '700' },
  faceStatus: { color: '#fff', fontSize: 11, fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  faceNumber: { color: '#fff', fontSize: 21, letterSpacing: 2, fontWeight: '700', marginVertical: 18 },
  faceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  faceValue: { color: '#fff', fontWeight: '600' },
  faceNetwork: { color: '#fff', fontWeight: '900', fontStyle: 'italic', alignSelf: 'flex-end', marginTop: 8 },
  buttons: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14 },
  muted: { color: colors.muted, fontSize: 12, marginTop: 4 },
  item: { backgroundColor: colors.surface, borderRadius: 12, marginBottom: 6 },
});
