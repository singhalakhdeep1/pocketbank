import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { accountService, Account } from '@/services/accountService';

interface AccountsState {
    accounts: Account[];
    selectedAccount: Account | null;
    loading: boolean;
    error: string | null;
}

const initialState: AccountsState = {
    accounts: [],
    selectedAccount: null,
    loading: false,
    error: null,
};

export const fetchAccounts = createAsyncThunk(
    'accounts/fetchAccounts',
    async (_, { rejectWithValue }) => {
        try {
            return await accountService.getAccounts();
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch accounts');
        }
    }
);

const accountsSlice = createSlice({
    name: 'accounts',
    initialState,
    reducers: {
        selectAccount: (state, action) => {
            state.selectedAccount = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAccounts.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchAccounts.fulfilled, (state, action) => {
                state.loading = false;
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
