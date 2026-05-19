import api from './api';

export interface Account {
    id: string;
    accountNumber: string;
    accountType: string;
    balance: number;
    currency: string;
    status: string;
}

class AccountService {
    async getAccounts(): Promise<Account[]> {
        const response = await api.get('/accounts');
        return response.data;
    }

    async getAccount(id: string): Promise<Account> {
        const response = await api.get(`/accounts/${id}`);
        return response.data;
    }

    async createAccount(data: { accountType: string; currency?: string }): Promise<Account> {
        const response = await api.post('/accounts', data);
        return response.data;
    }
}

export const accountService = new AccountService();
