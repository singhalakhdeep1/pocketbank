import api from './api';

export interface Transaction {
    id: string;
    type: string;
    amount: number;
    currency: string;
    description: string;
    status: string;
    createdAt: string;
}

class TransactionService {
    async getTransactions(accountId: string): Promise<Transaction[]> {
        const response = await api.get(`/accounts/${accountId}/transactions`);
        return response.data;
    }

    async createTransaction(data: {
        accountId: string;
        type: string;
        amount: number;
        description?: string;
    }): Promise<Transaction> {
        const response = await api.post('/transactions', data);
        return response.data;
    }
}

export const transactionService = new TransactionService();
