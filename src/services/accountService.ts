import { bank } from './bank';
import { cache } from './cache/cache.service';
import type { Account } from '../types';

export type { Account };

class AccountService {
  /** Fresh list from the API; the last good copy is cached so the app can show it offline. */
  async getAccounts(): Promise<Account[]> {
    try {
      const accounts = await bank.accounts.list();
      await cache.set('accounts', JSON.stringify(accounts));
      return accounts;
    } catch (err) {
      const cached = await cache.get('accounts', { allowStale: true });
      if (cached) return JSON.parse(cached) as Account[];
      throw err;
    }
  }

  getAccount(id: string) {
    return bank.accounts.get(id);
  }

  createAccount(data: { accountType: Account['accountType']; currency?: string; nickname?: string }) {
    return bank.accounts.create(data);
  }
}

export const accountService = new AccountService();
