import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '@/theme';
import DashboardScreen from '@/screens/main/DashboardScreen';
import AccountsScreen from '@/screens/main/AccountsScreen';
import PaymentsScreen from '@/screens/main/PaymentsScreen';
import CardsScreen from '@/screens/main/CardsScreen';
import MoreScreen from '@/screens/main/MoreScreen';
import AccountDetailScreen from '@/screens/main/AccountDetailScreen';
import TransactionsScreen from '@/screens/main/TransactionsScreen';
import TransactionDetailScreen from '@/screens/main/TransactionDetailScreen';
import TransferScreen from '@/screens/main/TransferScreen';
import P2PTransfers from '@/screens/main/P2PTransfers';
import QRScanScreen from '@/screens/main/QRScanScreen';
import QRReceiveScreen from '@/screens/main/QRReceiveScreen';
import TopUpScreen from '@/screens/main/TopUpScreen';
import BillPayments from '@/screens/main/BillPayments';
import ScheduledPaymentsScreen from '@/screens/main/ScheduledPaymentsScreen';
import BudgetScreen from '@/screens/main/BudgetScreen';
import BudgetCategories from '@/screens/main/BudgetCategories';
import SpendingAnalytics from '@/screens/main/SpendingAnalytics';
import InvestmentsScreen from '@/screens/main/InvestmentsScreen';
import InvestmentTracking from '@/screens/main/InvestmentTracking';
import ReportsScreen from '@/screens/main/ReportsScreen';
import CryptoWalletScreen from '@/screens/main/CryptoWalletScreen';
import SplitBills from '@/screens/main/SplitBills';
import VirtualCard from '@/screens/main/VirtualCard';
import ATMLocator from '@/screens/main/ATMLocator';
import NotificationsScreen from '@/screens/main/NotificationsScreen';
import ProfileScreen from '@/screens/main/ProfileScreen';
import SecurityScreen from '@/screens/main/SecurityScreen';
import type { MainStackParamList, TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

const icons: Record<keyof TabParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Dashboard: ['home', 'home-outline'],
  Accounts: ['wallet', 'wallet-outline'],
  Payments: ['swap-horizontal', 'swap-horizontal-outline'],
  Cards: ['card', 'card-outline'],
  More: ['grid', 'grid-outline'],
};

const header = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: 'bold' as const },
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...header,
        tabBarIcon: ({ focused, color, size }) => <Ionicons name={icons[route.name][focused ? 0 : 1]} size={size} color={color} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: 'gray',
        tabBarButtonTestID: `tab-${route.name}`,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'PocketBank' }} />
      <Tab.Screen name="Accounts" component={AccountsScreen} />
      <Tab.Screen name="Payments" component={PaymentsScreen} />
      <Tab.Screen name="Cards" component={CardsScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={header}>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="AccountDetail" component={AccountDetailScreen} options={{ title: 'Account' }} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} options={{ title: 'Transaction' }} />
      <Stack.Screen name="Transfer" component={TransferScreen} options={{ title: 'Move money' }} />
      <Stack.Screen name="P2PTransfers" component={P2PTransfers} options={{ title: 'Send money' }} />
      <Stack.Screen name="QRScan" component={QRScanScreen} options={{ title: 'Scan to pay' }} />
      <Stack.Screen name="QRReceive" component={QRReceiveScreen} options={{ title: 'Receive money' }} />
      <Stack.Screen name="TopUp" component={TopUpScreen} options={{ title: 'Add money' }} />
      <Stack.Screen name="BillPayments" component={BillPayments} options={{ title: 'Bills' }} />
      <Stack.Screen name="ScheduledPayments" component={ScheduledPaymentsScreen} options={{ title: 'Scheduled payments' }} />
      <Stack.Screen name="Budget" component={BudgetScreen} />
      <Stack.Screen name="BudgetCategories" component={BudgetCategories} options={{ title: 'Budget categories' }} />
      <Stack.Screen name="SpendingAnalytics" component={SpendingAnalytics} options={{ title: 'Spending' }} />
      <Stack.Screen name="Investments" component={InvestmentsScreen} />
      <Stack.Screen name="InvestmentTracking" component={InvestmentTracking} options={{ title: 'Trade' }} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="CryptoWallet" component={CryptoWalletScreen} options={{ title: 'Crypto' }} />
      <Stack.Screen name="SplitBills" component={SplitBills} options={{ title: 'Split bills' }} />
      <Stack.Screen name="VirtualCard" component={VirtualCard} options={{ title: 'Virtual cards' }} />
      <Stack.Screen name="ATMLocator" component={ATMLocator} options={{ title: 'ATMs & branches' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Security" component={SecurityScreen} />
    </Stack.Navigator>
  );
}
