import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as SecureStore from 'expo-secure-store';
import { authService, LoginRequest, RegisterRequest } from '@/services/authService';

interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: string;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
    error: string | null;
    biometricEnabled: boolean;
}

const initialState: AuthState = {
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null,
    biometricEnabled: false,
};

export const register = createAsyncThunk(
    'auth/register',
    async (data: RegisterRequest, { rejectWithValue }) => {
        try {
            const response = await authService.register(data);
            await SecureStore.setItemAsync('accessToken', response.accessToken);
            await SecureStore.setItemAsync('refreshToken', response.refreshToken);
            return response;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Registration failed');
        }
    }
);

export const login = createAsyncThunk(
    'auth/login',
    async (credentials: LoginRequest, { rejectWithValue }) => {
        try {
            const response = await authService.login(credentials);
            await SecureStore.setItemAsync('accessToken', response.accessToken);
            await SecureStore.setItemAsync('refreshToken', response.refreshToken);
            return response;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Login failed');
        }
    }
);

export const logout = createAsyncThunk('auth/logout', async () => {
    await authService.logout();
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
});

export const checkAuth = createAsyncThunk('auth/checkAuth', async () => {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token) {
        // Verify token and get user info
        return true;
    }
    return false;
});

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
        setBiometric: (state, action: PayloadAction<boolean>) => {
            state.biometricEnabled = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(register.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(register.fulfilled, (state, action) => {
                state.loading = false;
                state.isAuthenticated = true;
                state.user = action.payload.user;
            })
            .addCase(register.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            .addCase(login.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(login.fulfilled, (state, action) => {
                state.loading = false;
                state.isAuthenticated = true;
                state.user = action.payload.user;
            })
            .addCase(login.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            .addCase(logout.fulfilled, (state) => {
                state.user = null;
                state.isAuthenticated = false;
            });
    },
});

export const { clearError, setBiometric } = authSlice.actions;
export default authSlice.reducer;
