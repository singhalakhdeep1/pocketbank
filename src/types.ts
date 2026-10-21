export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: 'CUSTOMER' | 'ADMIN';
  twoFactorEnabled: boolean;
  language: string;
  notifications: { transactions: boolean; security: boolean; budget: boolean };
  pushRegistered: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  user: User;
}

export type LoginResponse = AuthResponse | { twoFactorRequired: true; challengeToken: string };

export interface Account {
  id: string;
  accountNumber: string;
  accountType: 'SAVINGS' | 'CHECKING' | 'BUSINESS';
  nickname?: string | null;
  balance: number;
  currency: string;
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
  interestRate: number;
  createdAt: string;
}

export interface AccountDetail extends Account {
  thisMonth: { incoming: number; outgoing: number };
  cardCount: number;
}

export interface Transaction {
  id: string;
  accountId: string;
  direction: 'CREDIT' | 'DEBIT';
  type: string;
  amount: number;
  signedAmount: number;
  balanceAfter: number;
  currency: string;
  description: string;
  merchant?: string | null;
  category: string;
  notes?: string | null;
  tags: string[];
  status: string;
  reference: string;
  counterparty?: string | null;
  cardId?: string | null;
  hasReceipt: boolean;
  fxRate?: number | null;
  createdAt: string;
  related?: Transaction[];
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface Card {
  id: string;
  accountId: string;
  kind: 'PHYSICAL' | 'VIRTUAL';
  network: 'VISA' | 'MASTERCARD';
  type: 'DEBIT' | 'CREDIT';
  last4: string;
  maskedNumber: string;
  expiry: string;
  cardholder: string;
  label?: string | null;
  status: 'INACTIVE' | 'ACTIVE' | 'FROZEN' | 'CANCELLED';
  dailyLimit: number;
  monthlyLimit: number;
  onlineEnabled: boolean;
  contactlessEnabled: boolean;
  spentToday: number;
  spentThisMonth: number;
  availableBalance: number;
  currency: string;
  accountNumber: string;
}

export interface Bill {
  id: string;
  accountId?: string | null;
  name: string;
  payee: string;
  category: string;
  amount: number;
  dueDate: string;
  recurrence: 'NONE' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  autoPay: boolean;
  lastPaidAt?: string | null;
}

export interface Budget {
  id: string;
  name: string;
  icon: string;
  color: string;
  limit: number;
  effectiveLimit: number;
  rolledOver: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  period: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  periodStart: string;
  periodEnd: string;
  rollover: boolean;
  alertThreshold: number;
  dailyAllowance: number;
  isOverBudget: boolean;
}

export interface Dashboard {
  totalBalance: number;
  balancesByCurrency: Record<string, number>;
  investmentsValue: number;
  cryptoValue: number;
  netWorth: number;
  activeAccounts: number;
  activeCards: number;
  month: { income: number; expenses: number; net: number };
  healthScore: number;
  unreadNotifications: number;
  recentTransactions: Transaction[];
  upcomingBills: Bill[];
  budgetsOverLimit: string[];
}

export interface Spending {
  range: 'week' | 'month' | 'year';
  totalSpent: number;
  budget: number;
  previousPeriodSpent: number;
  changeVsPrevious: number | null;
  categories: { name: string; amount: number; percentage: number; color: string }[];
  monthlyTrend: { month: string; amount: number; income: number }[];
}

export interface Holding {
  id: string;
  symbol: string;
  name: string;
  assetType: 'STOCK' | 'ETF' | 'MUTUAL_FUND' | 'BOND' | 'CRYPTO';
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  value: number;
  invested: number;
  gain: number;
  gainPercent: number;
  dayChange: number;
  dayChangePercent: number;
  priceSource: string;
}

export interface Portfolio {
  holdings: Holding[];
  totals: { value: number; invested: number; gain: number; gainPercent: number; dayChange: number };
  allocation: { type: string; value: number; percentage: number }[];
  performance: { date: string; value: number; invested: number }[];
}

export interface Quote {
  symbol: string;
  name: string;
  assetType: Holding['assetType'];
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  source: 'coinbase' | 'alphavantage' | 'simulated';
  stale?: boolean;
}

export interface Instrument {
  symbol: string;
  name: string;
  assetType: Holding['assetType'];
}

export interface SplitBill {
  id: string;
  title: string;
  totalAmount: number;
  currency: string;
  status: 'PENDING' | 'SETTLED';
  createdBy: string;
  isCreator: boolean;
  createdAt: string;
  myShare: { amount: number; paid: boolean } | null;
  participants: { id: string; userId?: string | null; name: string; email?: string | null; amount: number; paid: boolean }[];
}

export interface Location {
  id: string;
  name: string;
  type: 'atm' | 'branch';
  address: string;
  hours: string;
  services: string[];
  coordinates: { lat: number; lng: number };
  distance: number;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface Payee {
  id: string;
  name: string;
  accountNumber: string;
}

export interface ScheduledPayment {
  id: string;
  kind: 'TRANSFER' | 'P2P' | 'BILL';
  fromAccountId: string;
  toAccountNumber?: string | null;
  billId?: string | null;
  amount: number;
  description: string;
  frequency: 'NONE' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  nextRunAt: string;
  active: boolean;
  runCount: number;
  lastError?: string | null;
}

export interface CryptoWallet {
  id: string;
  address: string;
  label: string;
}

export interface CryptoTx {
  id: string;
  hash: string;
  toAddress: string;
  valueWei: string;
  status: string;
  createdAt: string;
}

export interface Meta {
  features: { cardTopUps: boolean; onChainCrypto: boolean; liveStockQuotes: boolean; email: boolean; sandboxDeposits: boolean };
  currencies: string[];
}
