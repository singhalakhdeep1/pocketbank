import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type TabParamList = {
  Dashboard: undefined;
  Accounts: undefined;
  Payments: undefined;
  Cards: undefined;
  More: undefined;
};

export type MainStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  AccountDetail: { accountId: string };
  Transactions: { accountId?: string; category?: string } | undefined;
  TransactionDetail: { transactionId: string };
  Transfer: { fromAccountId?: string } | undefined;
  P2PTransfers: { accountNumber?: string; amount?: number } | undefined;
  QRScan: undefined;
  QRReceive: undefined;
  TopUp: { accountId?: string } | undefined;
  BillPayments: undefined;
  ScheduledPayments: undefined;
  Budget: undefined;
  BudgetCategories: undefined;
  SpendingAnalytics: undefined;
  Investments: undefined;
  InvestmentTracking: { symbol?: string } | undefined;
  Reports: undefined;
  CryptoWallet: undefined;
  SplitBills: undefined;
  VirtualCard: undefined;
  ATMLocator: undefined;
  Notifications: undefined;
  Profile: undefined;
  Security: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  TwoFactor: undefined;
};

export type MainScreenProps<T extends keyof MainStackParamList> = NativeStackScreenProps<MainStackParamList, T>;
export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<AuthStackParamList, T>;
