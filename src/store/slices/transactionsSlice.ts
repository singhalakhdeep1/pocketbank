import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { TxQuery } from '@/services/bank';
import { transactionService, type Transaction } from '@/services/transactionService';

interface TransactionsState {
  transactions: Transaction[];
  filters: TxQuery;
  nextCursor: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: TransactionsState = {
  transactions: [],
  filters: {},
  nextCursor: null,
  loading: false,
  error: null,
};

/** Loads page one for `filters` (replacing the list) or the next page when `more` is set. */
export const fetchTransactions = createAsyncThunk(
  'transactions/fetchTransactions',
  async ({ filters, more }: { filters?: TxQuery; more?: boolean } = {}, { getState, rejectWithValue }) => {
    const state = (getState() as { transactions: TransactionsState }).transactions;
    const active = filters ?? state.filters;
    try {
      const page = await transactionService.getTransactions({ ...active, cursor: more ? (state.nextCursor ?? undefined) : undefined });
      return { page, filters: active, more: Boolean(more) };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch transactions');
    }
  },
);

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    transactionUpdated: (state, action: { payload: Transaction }) => {
      state.transactions = state.transactions.map((t) => (t.id === action.payload.id ? action.payload : t));
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransactions.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchTransactions.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.error = null;
        state.filters = payload.filters;
        state.transactions = payload.more ? [...state.transactions, ...payload.page.items] : payload.page.items;
        state.nextCursor = payload.page.nextCursor;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { transactionUpdated } = transactionsSlice.actions;
export default transactionsSlice.reducer;
