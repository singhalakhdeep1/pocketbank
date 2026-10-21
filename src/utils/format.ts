export function money(value: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export const signedMoney = (value: number, currency = 'USD') => `${value > 0 ? '+' : value < 0 ? '−' : ''}${money(Math.abs(value), currency)}`;

export const percent = (value: number, digits = 1) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`;

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const longDate = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export const accountLabel = (a: { nickname?: string | null; accountType: string; accountNumber: string; currency: string }) =>
  `${a.nickname || a.accountType.charAt(0) + a.accountType.slice(1).toLowerCase()} ·${a.accountNumber.slice(-4)} (${a.currency})`;

export const titleCase = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Parses a typed amount ("1,250.50") into a number, or null when it is not a valid amount. */
export function parseAmount(text: string): number | null {
  const n = Number(text.replace(/[,\s$]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export const kindIcon: Record<string, string> = {
  DEPOSIT: 'bank-transfer-in',
  TOPUP: 'credit-card-plus',
  TRANSFER_IN: 'swap-horizontal',
  TRANSFER_OUT: 'swap-horizontal',
  P2P_IN: 'account-arrow-left',
  P2P_OUT: 'account-arrow-right',
  BILL_PAYMENT: 'file-document-outline',
  CARD_PURCHASE: 'credit-card-outline',
  QR_PAYMENT: 'qrcode',
  INVESTMENT_BUY: 'chart-line',
  INVESTMENT_SELL: 'chart-line',
  SPLIT_SETTLEMENT: 'call-split',
  INTEREST: 'percent',
  FEE: 'cash-minus',
  WITHDRAWAL: 'cash',
};
