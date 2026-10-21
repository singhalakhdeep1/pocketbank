import { bank, type TxQuery } from './bank';
import type { Page, Transaction } from '../types';

export type { Transaction };

class TransactionService {
  getTransactions(query: TxQuery = {}): Promise<Page<Transaction>> {
    return bank.transactions.list({ limit: 30, ...query });
  }

  getAccountTransactions(accountId: string, query: TxQuery = {}) {
    return this.getTransactions({ ...query, accountId });
  }
}

export const transactionService = new TransactionService();
