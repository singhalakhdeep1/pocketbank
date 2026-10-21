import React from 'react';
import { StyleSheet } from 'react-native';
import { Button, List } from 'react-native-paper';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen, Section } from '@/components/ui';
import type { MainStackParamList, TabParamList } from '@/navigation/types';
import { useAppDispatch } from '@/store';
import { logout } from '@/store/slices/authSlice';
import { colors } from '@/theme';

type Props = CompositeScreenProps<BottomTabScreenProps<TabParamList, 'More'>, NativeStackScreenProps<MainStackParamList>>;

const groups: { title: string; items: { icon: string; title: string; route: keyof MainStackParamList }[] }[] = [
  {
    title: 'Money insights',
    items: [
      { icon: 'chart-donut', title: 'Spending analytics', route: 'SpendingAnalytics' },
      { icon: 'wallet-outline', title: 'Budget', route: 'Budget' },
      { icon: 'shape-outline', title: 'Budget categories', route: 'BudgetCategories' },
      { icon: 'file-chart-outline', title: 'Reports & statements', route: 'Reports' },
    ],
  },
  {
    title: 'Wealth',
    items: [
      { icon: 'chart-line', title: 'Investments', route: 'Investments' },
      { icon: 'swap-vertical', title: 'Buy & sell', route: 'InvestmentTracking' },
      { icon: 'bitcoin', title: 'Crypto wallet', route: 'CryptoWallet' },
    ],
  },
  {
    title: 'Services',
    items: [
      { icon: 'map-marker-radius', title: 'ATMs & branches', route: 'ATMLocator' },
      { icon: 'bell-outline', title: 'Notifications', route: 'Notifications' },
      { icon: 'account-circle-outline', title: 'Profile & preferences', route: 'Profile' },
      { icon: 'shield-lock-outline', title: 'Security', route: 'Security' },
    ],
  },
];

export default function MoreScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  return (
    <Screen testID="more">
      {groups.map((g) => (
        <Section key={g.title} title={g.title}>
          {g.items.map((i) => (
            <List.Item
              key={i.route}
              title={i.title}
              left={(p) => <List.Icon {...p} icon={i.icon} color={colors.primary} />}
              right={(p) => <List.Icon {...p} icon="chevron-right" />}
              onPress={() => navigation.navigate(i.route as never)}
              style={styles.item}
              testID={`more-${i.route}`}
            />
          ))}
        </Section>
      ))}
      <Button mode="contained" icon="logout" buttonColor={colors.secondary} style={{ marginTop: 24 }} onPress={() => dispatch(logout())} testID="logout">
        Sign out
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({ item: { backgroundColor: colors.surface, borderRadius: 12, marginBottom: 6 } });
