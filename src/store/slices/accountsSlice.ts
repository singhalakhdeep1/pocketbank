import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { accountService, type Account } from '@/services/accountService';

interface AccountsState {
  accounts: Account[];
  selectedAccountId: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AccountsState = {
  accounts: [],
  selectedAccountId: null,
  loading: false,
  error: null,
};

export const fetchAccounts = createAsyncThunk('accounts/fetchAccounts', async (_, { rejectWithValue }) => {
  try {
    return await accountService.getAccounts();
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch accounts');
  }
});

const accountsSlice = createSlice({
  name: 'accounts',
  initialState,
  reducers: {
    selectAccount: (state, action: { payload: string | null }) => {
      state.selectedAccountId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAccounts.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAccounts.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.accounts = action.payload;
      })
      .addCase(fetchAccounts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { selectAccount } = accountsSlice.actions;
export default accountsSlice.reducer;
