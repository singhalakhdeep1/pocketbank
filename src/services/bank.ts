import api, { download } from './api';
import type {
  Account,
  AccountDetail,
  AppNotification,
  Bill,
  Budget,
  Card,
  CryptoTx,
  CryptoWallet,
  Dashboard,
  Instrument,
  Location,
  Meta,
  Page,
  Payee,
  Portfolio,
  Quote,
  ScheduledPayment,
  Spending,
  SplitBill,
  Transaction,
  User,
} from '../types';

export interface TxQuery {
  accountId?: string;
  type?: string;
  direction?: 'CREDIT' | 'DEBIT';
  category?: string;
  tag?: string;
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

export const bank = {
  meta: () => api.get<Meta>('/meta'),

  profile: {
    get: () => api.get<User>('/profile'),
    update: (data: Partial<Pick<User, 'firstName' | 'lastName' | 'phone' | 'language'>> & { notifications?: Partial<User['notifications']> }) => api.patch<User>('/profile', data),
    registerPush: (token: string) => api.post('/profile/push-token', { token }),
    securityLog: () => api.get<{ id: string; eventType: string; description: string; createdAt: string }[]>('/profile/security-log'),
  },

  security: {
    changePassword: (currentPassword: string, newPassword: string) => api.post<{ accessToken: string; refreshToken: string }>('/auth/password', { currentPassword, newPassword }),
    setup2fa: () => api.post<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup'),
    enable2fa: (code: string) => api.post<{ twoFactorEnabled: boolean }>('/auth/2fa/enable', { code }),
    disable2fa: (code: string, password: string) => api.post<{ twoFactorEnabled: boolean }>('/auth/2fa/disable', { code, password }),
    logoutAll: () => api.post<{ revoked: number }>('/auth/logout-all'),
  },

  notifications: {
    list: (unread = false) => api.get<{ items: AppNotification[]; unreadCount: number }>('/notifications', { unread: unread ? 'true' : undefined }),
    read: (id: string) => api.post(`/notifications/${id}/read`),
    readAll: () => api.post('/notifications/read-all'),
  },

  accounts: {
    list: () => api.get<Account[]>('/accounts'),
    get: (id: string) => api.get<AccountDetail>(`/accounts/${id}`),
    create: (data: { accountType: Account['accountType']; currency?: string; nickname?: string }) => api.post<Account>('/accounts', data),
    update: (id: string, data: { nickname?: string | null; status?: 'ACTIVE' | 'FROZEN' }) => api.patch<Account>(`/accounts/${id}`, data),
    close: (id: string) => api.post<Account>(`/accounts/${id}/close`),
    deposit: (id: string, amount: number) => api.post<Transaction>(`/accounts/${id}/deposit`, { amount }, { idempotent: true }),
    statement: (id: string, year: number, month: number) => download(`/accounts/${id}/statement.pdf`, { year, month }),
  },

  transactions: {
    list: (q: TxQuery = {}) => api.get<Page<Transaction>>('/transactions', { ...q }),
    get: (id: string) => api.get<Transaction>(`/transactions/${id}`),
    update: (id: string, data: { category?: string; notes?: string | null; tags?: string[] }) => api.patch<Transaction>(`/transactions/${id}`, data),
    categories: () => api.get<string[]>('/transactions/categories'),
    recurring: () =>
      api.get<{ merchant: string; category: string; averageAmount: number; occurrences: number; frequency: string; nextDueDate: string }[]>('/transactions/recurring'),
    export: (format: 'csv' | 'pdf', q: TxQuery = {}) => download(`/transactions/export/${format}`, { ...q }),
    uploadReceipt: (id: string, form: FormData) => api.post<Transaction>(`/transactions/${id}/receipt`, form),
  },

  transfers: {
    internal: (data: { fromAccountId: string; toAccountId: string; amount: number; note?: string }) =>
      api.post<{ reference: string; fxRate: number; creditedAmount: number }>('/transfers/internal', data, { idempotent: true }),
    p2p: (data: { fromAccountId?: string; toAccount?: string; toEmail?: string; amount: number; note?: string }) =>
      api.post<{ reference: string; recipient: { name: string; accountNumber: string }; fxRate: number }>('/transfers/p2p', data, { idempotent: true }),
    lookup: (q: { accountNumber?: string; email?: string }) => api.get<{ accountNumber: string; name: string; currency: string; isOwnAccount: boolean }>('/transfers/lookup', q),
    payees: () => api.get<Payee[]>('/payees'),
    removePayee: (id: string) => api.delete(`/payees/${id}`),
  },

  scheduled: {
    list: () => api.get<ScheduledPayment[]>('/payments/scheduled'),
    create: (data: {
      kind: ScheduledPayment['kind'];
      fromAccountId: string;
      toAccountNumber?: string;
      billId?: string;
      amount: number;
      description: string;
      frequency: ScheduledPayment['frequency'];
      startDate: string;
    }) => api.post<ScheduledPayment>('/payments/scheduled', data),
    update: (id: string, data: { active?: boolean }) => api.patch<ScheduledPayment>(`/payments/scheduled/${id}`, data),
    remove: (id: string) => api.delete(`/payments/scheduled/${id}`),
  },

  qr: {
    receive: (q: { accountId?: string; amount?: number; note?: string }) => api.get<{ payload: string; accountNumber: string; currency: string }>('/payments/qr/receive', q),
    parse: (payload: string) =>
      api.post<
        | { kind: 'person'; accountNumber: string; name: string; amount: number | null; currency: string; note: string | null }
        | { kind: 'merchant'; merchantId: string; name: string; category: string; amount: number | null; currency: string }
      >('/payments/qr/parse', { payload }),
    pay: (data: { payload: string; fromAccountId?: string; amount?: number; note?: string }) =>
      api.post<{ kind: string; reference: string; status: string; amount: number }>('/payments/qr/pay', data, { idempotent: true }),
  },

  topup: {
    intent: (accountId: string, amount: number) =>
      api.post<{ paymentIntentId: string; clientSecret: string; publishableKey: string | null }>('/payments/topup/intent', { accountId, amount }, { idempotent: true }),
    confirm: (paymentIntentId: string) => api.post<{ status: string; credited: boolean }>('/payments/topup/confirm', { paymentIntentId }),
  },

  cards: {
    list: (kind?: Card['kind']) => api.get<Card[]>('/cards', { kind }),
    get: (id: string) => api.get<Card>(`/cards/${id}`),
    create: (data: { kind: Card['kind']; network: Card['network']; accountId?: string; label?: string; dailyLimit?: number; monthlyLimit?: number }) => api.post<Card>('/cards', data),
    update: (id: string, data: Partial<Pick<Card, 'dailyLimit' | 'monthlyLimit' | 'onlineEnabled' | 'contactlessEnabled' | 'label'>>) => api.patch<Card>(`/cards/${id}`, data),
    activate: (id: string, last4: string) => api.post<Card>(`/cards/${id}/activate`, { last4 }),
    freeze: (id: string) => api.post<Card>(`/cards/${id}/freeze`),
    unfreeze: (id: string) => api.post<Card>(`/cards/${id}/unfreeze`),
    reveal: (id: string, password: string) => api.post<{ cardNumber: string; cvv: string; expiry: string; cardholder: string }>(`/cards/${id}/reveal`, { password }),
    cancel: (id: string) => api.delete(`/cards/${id}`),
  },

  bills: {
    list: () => api.get<{ items: Bill[]; summary: { totalDue: number; pendingCount: number; overdueCount: number; dueThisWeek: number } }>('/bills'),
    create: (data: Omit<Bill, 'id' | 'status' | 'lastPaidAt'>) => api.post<Bill>('/bills', data),
    pay: (id: string, accountId?: string) => api.post<{ bill: Bill; transaction: Transaction }>(`/bills/${id}/pay`, { accountId }, { idempotent: true }),
    autopay: (id: string, enabled: boolean) => api.patch<Bill>(`/bills/${id}/autopay`, { enabled }),
    remove: (id: string) => api.delete(`/bills/${id}`),
  },

  budgets: {
    list: () => api.get<{ items: Budget[]; summary: { totalLimit: number; totalSpent: number; remaining: number; percentUsed: number; overBudgetCount: number } }>('/budgets'),
    create: (data: { name: string; limit: number; icon?: string; period?: Budget['period']; rollover?: boolean; alertThreshold?: number }) => api.post<Budget>('/budgets', data),
    update: (id: string, data: Partial<{ limit: number; rollover: boolean; alertThreshold: number }>) => api.patch<Budget>(`/budgets/${id}`, data),
    remove: (id: string) => api.delete(`/budgets/${id}`),
    transactions: (id: string) => api.get<Transaction[]>(`/budgets/${id}/transactions`),
    insights: () => api.get<{ type: 'warning' | 'success' | 'info'; message: string }[]>('/budgets/insights'),
  },

  analytics: {
    dashboard: () => api.get<Dashboard>('/analytics/dashboard'),
    spending: (range: Spending['range']) => api.get<Spending>('/analytics/spending', { range }),
  },

  investments: {
    portfolio: () => api.get<Portfolio>('/investments/portfolio'),
    instruments: (q = '', type?: string) => api.get<Instrument[]>('/investments/instruments', { q, type }),
    quote: (symbol: string) => api.get<Quote>(`/investments/quotes/${symbol}`),
    history: (symbol: string, days = 30) => api.get<{ source: string; points: { date: string; close: number }[] }>(`/investments/quotes/${symbol}/history`, { days }),
    trade: (data: { symbol: string; side: 'BUY' | 'SELL'; quantity?: number; amount?: number; accountId?: string }) =>
      api.post<{ symbol: string; side: string; quantity: number; price: number; total: number; realizedGain: number }>('/investments/trades', data, { idempotent: true }),
    trades: () => api.get<{ id: string; symbol: string; side: string; quantity: number; price: number; total: number; createdAt: string }[]>('/investments/trades'),
  },

  crypto: {
    prices: (symbols?: string[]) => api.get<Quote[]>('/crypto/prices', { symbols: symbols?.join(',') }),
    status: () => api.get<{ onChainEnabled: boolean }>('/crypto/status'),
    wallets: () => api.get<CryptoWallet[]>('/crypto/wallets'),
    link: (address: string, label?: string) => api.post<CryptoWallet>('/crypto/wallets', { address, label }),
    balance: (id: string) => api.get<{ address: string; eth: number; usd: number; ethPrice: number }>(`/crypto/wallets/${id}/balance`),
    txParams: (id: string, to: string, value: string) =>
      api.get<{ chainId: number; nonce: number; gasLimit: string; maxFeePerGas: string; maxPriorityFeePerGas: string; value: string; estimatedFeeEth: number }>(`/crypto/wallets/${id}/tx-params`, { to, value }),
    broadcast: (id: string, signedTx: string) => api.post<CryptoTx>(`/crypto/wallets/${id}/broadcast`, { signedTx }),
    transactions: (id: string) => api.get<CryptoTx[]>(`/crypto/wallets/${id}/transactions`),
  },

  reports: {
    get: <T = Record<string, unknown>>(type: 'monthly' | 'annual' | 'tax', year: number, month?: number) => api.get<T>(`/reports/${type}`, { year, month }),
    export: (type: 'monthly' | 'annual' | 'tax', format: 'csv' | 'pdf', year: number, month?: number) => download(`/reports/${type}/export/${format}`, { year, month }),
    email: (type: 'monthly' | 'annual' | 'tax', format: 'csv' | 'pdf', year: number, month?: number) => api.post<{ sent: boolean; to: string }>(`/reports/${type}/email`, { format, year, month }),
  },

  splits: {
    list: () => api.get<{ items: SplitBill[]; summary: { youOwe: number; owedToYou: number } }>('/split-bills'),
    create: (data: { title: string; totalAmount: number; accountId?: string; participants: { email?: string; name?: string; amount?: number }[] }) => api.post<SplitBill>('/split-bills', data),
    settle: (id: string, accountId?: string) => api.post<SplitBill>(`/split-bills/${id}/settle`, { accountId }, { idempotent: true }),
    markPaid: (id: string, participantId: string) => api.post<SplitBill>(`/split-bills/${id}/participants/${participantId}/mark-paid`),
    remind: (id: string) => api.post<{ reminded: number }>(`/split-bills/${id}/remind`),
    remove: (id: string) => api.delete(`/split-bills/${id}`),
  },

  atms: (q: { lat: number; lng: number; type?: 'all' | 'atm' | 'branch'; radiusKm?: number }) => api.get<Location[]>('/atms', q),
};
