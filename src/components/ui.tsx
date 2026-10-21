import React, { useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { ActivityIndicator, Avatar, Banner, Button, Chip, Dialog, HelperText, List, Portal, Snackbar, Text, TextInput } from 'react-native-paper';
import type { Account, Transaction } from '../types';
import { accountLabel, kindIcon, shortDate, signedMoney } from '../utils/format';
import { colors } from '../theme';

export function Screen({ children, refreshing, onRefresh, style, testID }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void; style?: ViewStyle; testID?: string }) {
  return (
    <ScrollView
      testID={testID}
      style={styles.screen}
      contentContainerStyle={[styles.content, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator />
      {label ? <Text style={styles.muted}>{label}</Text> : null}
    </View>
  );
}

export function ErrorBanner({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <Banner visible icon="alert-circle" actions={onRetry ? [{ label: 'Retry', onPress: onRetry }] : []} style={styles.banner}>
      {error}
    </Banner>
  );
}

export function Empty({ icon = 'inbox', title, action }: { icon?: string; title: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Avatar.Icon size={56} icon={icon} style={{ backgroundColor: colors.surfaceAlt }} color={colors.muted} />
      <Text style={[styles.muted, { marginTop: 12 }]}>{title}</Text>
      {action}
    </View>
  );
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          {title}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export function TxRow({ tx, onPress }: { tx: Transaction; onPress?: () => void }) {
  const credit = tx.direction === 'CREDIT';
  return (
    <List.Item
      title={tx.description}
      description={`${tx.category} · ${shortDate(tx.createdAt)}${tx.tags.length ? ` · #${tx.tags.join(' #')}` : ''}`}
      onPress={onPress}
      left={(p) => <List.Icon {...p} icon={kindIcon[tx.type] ?? 'cash'} color={credit ? colors.positive : colors.text} />}
      right={() => <Text style={[styles.amount, { color: credit ? colors.positive : colors.text }]}>{signedMoney(tx.signedAmount, tx.currency)}</Text>}
      style={styles.row}
    />
  );
}

/** Horizontal chips to pick one of the user's accounts. */
export function AccountPicker({ accounts, value, onChange, label = 'From account', filter }: { accounts: Account[]; value: string | null; onChange: (id: string) => void; label?: string; filter?: (a: Account) => boolean }) {
  const list = accounts.filter((a) => a.status === 'ACTIVE' && (!filter || filter(a)));
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {list.map((a) => (
          <Chip key={a.id} selected={value === a.id} onPress={() => onChange(a.id)} style={styles.chip} showSelectedOverlay testID={`account-chip-${a.accountNumber}`}>
            {accountLabel(a)} · {a.balance.toFixed(2)}
          </Chip>
        ))}
      </ScrollView>
    </View>
  );
}

export function ChipGroup<T extends string>({ options, value, onChange, labels }: { options: readonly T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Chip key={o} selected={o === value} onPress={() => onChange(o)} style={styles.chip} showSelectedOverlay>
          {labels?.[o] ?? o}
        </Chip>
      ))}
    </View>
  );
}

export function Field(props: Omit<React.ComponentProps<typeof TextInput>, 'error'> & { error?: string | null }) {
  const { error, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 8 }}>
      <TextInput mode="outlined" style={style} error={Boolean(error)} {...rest} />
      {error ? <HelperText type="error">{error}</HelperText> : null}
    </View>
  );
}

/** Simple feedback toast shared by screens. */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const node = (
    <Snackbar visible={Boolean(msg)} onDismiss={() => setMsg(null)} duration={3000}>
      {msg ?? ''}
    </Snackbar>
  );
  return { show: setMsg, node };
}

export function ConfirmDialog({ visible, title, body, confirmLabel = 'Confirm', onConfirm, onDismiss, loading }: { visible: boolean; title: string; body: ReactNode; confirmLabel?: string; onConfirm: () => void; onDismiss: () => void; loading?: boolean }) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>{typeof body === 'string' ? <Text>{body}</Text> : body}</Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button mode="contained" onPress={onConfirm} loading={loading} disabled={loading} testID="confirm-button">
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

/** Thin progress bar coloured green / amber / red by how much of a limit is used. */
export function UsageBar({ percent }: { percent: number }) {
  const color = percent >= 100 ? colors.negative : percent >= 75 ? colors.warning : colors.positive;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.min(100, Math.max(0, percent))}%`, backgroundColor: color }]} />
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  muted: { color: colors.muted },
  banner: { marginBottom: 12 },
  empty: { alignItems: 'center', padding: 32 },
  section: { marginTop: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontWeight: '700', color: colors.text },
  row: { backgroundColor: colors.surface, borderRadius: 12, marginBottom: 6 },
  amount: { fontWeight: '700', alignSelf: 'center' },
  label: { color: colors.muted, marginBottom: 6, fontSize: 13 },
  chip: { marginRight: 8, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden', marginVertical: 8 },
  barFill: { height: 8, borderRadius: 4 },
});
