import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { transactionService, Transaction } from '@/services/transactionService';

interface TransactionsState {
    transactions: Transaction[];
    loading: boolean;
    error: string | null;
}

const initialState: TransactionsState = {
    transactions: [],
    loading: false,
    error: null,
};

export const fetchTransactions = createAsyncThunk(
    'transactions/fetchTransactions',
    async (accountId: string, { rejectWithValue }) => {
        try {
            return await transactionService.getTransactions(accountId);
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch transactions');
        }
    }
);

const transactionsSlice = createSlice({
    name: 'transactions',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchTransactions.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchTransactions.fulfilled, (state, action) => {
                state.loading = false;
                state.transactions = action.payload;
            })
            .addCase(fetchTransactions.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export default transactionsSlice.reducer;
