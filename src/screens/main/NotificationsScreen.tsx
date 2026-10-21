import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, List } from 'react-native-paper';
import { Empty, ErrorBanner, Loading, Screen } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { bank } from '@/services/bank';
import { colors } from '@/theme';
import { longDate } from '@/utils/format';

const ICON: Record<string, string> = { transaction: 'swap-horizontal', security: 'shield-alert-outline', budget: 'wallet-outline', bill: 'file-document-outline', investment: 'chart-line', split: 'call-split', system: 'information-outline' };

export default function NotificationsScreen() {
  const { data, setData, error, loading, refreshing, refresh, reload } = useApi(() => bank.notifications.list());
  if (loading && !data) return <Loading />;

  const markAll = async () => {
    await bank.notifications.readAll();
    await reload();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} testID="notifications">
      <ErrorBanner error={error} onRetry={reload} />
      {data?.unreadCount ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Button onPress={markAll} testID="read-all">
            Mark all read ({data.unreadCount})
          </Button>
        </View>
      ) : null}
      {data?.items.length ? null : <Empty icon="bell-outline" title="You're all caught up" />}
      {data?.items.map((n) => (
        <List.Item
          key={n.id}
          title={n.title}
          description={`${n.body}\n${longDate(n.createdAt)}`}
          descriptionNumberOfLines={3}
          titleStyle={{ fontWeight: n.read ? '400' : '700' }}
          left={(p) => <List.Icon {...p} icon={ICON[n.type] ?? 'bell-outline'} color={n.read ? colors.muted : colors.primary} />}
          onPress={async () => {
            if (n.read) return;
            await bank.notifications.read(n.id);
            setData({ items: data.items.map((x) => (x.id === n.id ? { ...x, read: true } : x)), unreadCount: Math.max(0, data.unreadCount - 1) });
          }}
          style={[styles.item, !n.read && styles.unread]}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { backgroundColor: colors.surface, borderRadius: 12, marginBottom: 6 },
  unread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
});
