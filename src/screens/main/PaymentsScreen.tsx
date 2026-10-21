import React from 'react';
import { StyleSheet } from 'react-native';
import { List } from 'react-native-paper';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen, Section } from '@/components/ui';
import type { MainStackParamList, TabParamList } from '@/navigation/types';
import { colors } from '@/theme';

type Props = CompositeScreenProps<BottomTabScreenProps<TabParamList, 'Payments'>, NativeStackScreenProps<MainStackParamList>>;

const groups: { title: string; items: { icon: string; title: string; description: string; route: keyof MainStackParamList }[] }[] = [
  {
    title: 'Move money',
    items: [
      { icon: 'swap-horizontal', title: 'Between my accounts', description: 'Instant, any currency', route: 'Transfer' },
      { icon: 'account-arrow-right', title: 'Send to someone', description: 'By account number or email', route: 'P2PTransfers' },
      { icon: 'call-split', title: 'Split a bill', description: 'Share costs with friends', route: 'SplitBills' },
    ],
  },
  {
    title: 'QR',
    items: [
      { icon: 'qrcode-scan', title: 'Scan to pay', description: 'Pay a person or a shop', route: 'QRScan' },
      { icon: 'qrcode', title: 'Receive', description: 'Show your QR code', route: 'QRReceive' },
    ],
  },
  {
    title: 'Bills & scheduling',
    items: [
      { icon: 'file-document-outline', title: 'Bills', description: 'Pay now or set autopay', route: 'BillPayments' },
      { icon: 'calendar-clock', title: 'Scheduled & recurring', description: 'Future and repeating payments', route: 'ScheduledPayments' },
      { icon: 'credit-card-plus', title: 'Add money', description: 'Top up with a card', route: 'TopUp' },
    ],
  },
];

export default function PaymentsScreen({ navigation }: Props) {
  return (
    <Screen testID="payments">
      {groups.map((g) => (
        <Section key={g.title} title={g.title}>
          {g.items.map((i) => (
            <List.Item
              key={i.route}
              title={i.title}
              description={i.description}
              left={(p) => <List.Icon {...p} icon={i.icon} color={colors.primary} />}
              right={(p) => <List.Icon {...p} icon="chevron-right" />}
              onPress={() => navigation.navigate(i.route as never)}
              style={styles.item}
              testID={`pay-${i.route}`}
            />
          ))}
        </Section>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({ item: { backgroundColor: colors.surface, borderRadius: 12, marginBottom: 6 } });
