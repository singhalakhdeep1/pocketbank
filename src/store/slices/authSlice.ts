import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { ApiError, clearSession, refreshSession } from '@/services/api';
import { authService, type LoginRequest, type RegisterRequest } from '@/services/authService';
import { cache } from '@/services/cache/cache.service';
import { KEYS, getItem } from '@/services/secureStorage';
import { logger } from '@/services/structured-logging/structured-logging.service';
import type { User } from '@/types';
import { authenticateWithBiometric } from '@/utils/biometric';

const BIOMETRIC_PREF = 'pb.biometricEnabled';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  /** Session exists but the app is waiting for Face ID / fingerprint before showing data. */
  locked: boolean;
  bootstrapped: boolean;
  loading: boolean;
  error: string | null;
  biometricEnabled: boolean;
  challengeToken: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  locked: false,
  bootstrapped: false,
  loading: false,
  error: null,
  biometricEnabled: false,
  challengeToken: null,
};

const message = (err: unknown, fallback: string) => (err instanceof ApiError || err instanceof Error ? err.message : fallback);

/** On launch: restore the saved session. With biometrics on, stay locked until the user unlocks. */
export const bootstrap = createAsyncThunk('auth/bootstrap', async () => {
  const biometricEnabled = (await AsyncStorage.getItem(BIOMETRIC_PREF)) === 'true';
  const hasSession = Boolean(await getItem(KEYS.refreshToken));
  if (!hasSession) return { biometricEnabled, user: null, locked: false };
  if (biometricEnabled) return { biometricEnabled, user: null, locked: true };
  if (!(await refreshSession())) return { biometricEnabled, user: null, locked: false };
  const user = await authService.getProfile();
  logger.setContext({ userId: user.id });
  return { biometricEnabled, user, locked: false };
});

export const unlockWithBiometric = createAsyncThunk('auth/unlock', async (_, { rejectWithValue }) => {
  if (!(await authenticateWithBiometric('Unlock PocketBank'))) return rejectWithValue('Biometric check was cancelled');
  if (!(await refreshSession())) return rejectWithValue('Your session expired, please sign in with your password');
  const user = await authService.getProfile();
  logger.setContext({ userId: user.id });
  logger.logAuditEvent('BiometricUnlock', 'App unlocked with biometrics');
  return user;
});

export const login = createAsyncThunk('auth/login', async (credentials: LoginRequest, { rejectWithValue }) => {
  try {
    return await authService.login(credentials);
  } catch (err) {
    return rejectWithValue(message(err, 'Login failed'));
  }
});

export const verifyTwoFactor = createAsyncThunk('auth/verify2fa', async (code: string, { getState, rejectWithValue }) => {
  const token = (getState() as { auth: AuthState }).auth.challengeToken;
  if (!token) return rejectWithValue('Start sign-in again');
  try {
    return await authService.verifyTwoFactor(token, code);
  } catch (err) {
    return rejectWithValue(message(err, 'Verification failed'));
  }
});

export const register = createAsyncThunk('auth/register', async (data: RegisterRequest, { rejectWithValue }) => {
  try {
    return await authService.register(data);
  } catch (err) {
    if (err instanceof ApiError && Array.isArray(err.details)) {
      return rejectWithValue((err.details as { message: string }[]).map((d) => d.message).join('\n'));
    }
    return rejectWithValue(message(err, 'Registration failed'));
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  await authService.logout();
  await cache.clearAll();
});

export const refreshProfile = createAsyncThunk('auth/profile', () => authService.getProfile());

export const setBiometricPreference = createAsyncThunk('auth/biometricPref', async (enabled: boolean, { rejectWithValue }) => {
  if (enabled && !(await authenticateWithBiometric('Confirm to enable biometric unlock'))) return rejectWithValue('Biometric check failed');
  await AsyncStorage.setItem(BIOMETRIC_PREF, String(enabled));
  logger.logAuditEvent(enabled ? 'BiometricEnabled' : 'BiometricDisabled', `Biometric unlock ${enabled ? 'enabled' : 'disabled'}`);
  return enabled;
});

/** Forget the session locally (expired refresh token, or user chose "use password instead"). */
export const forgetSession = createAsyncThunk('auth/forget', async () => {
  await clearSession();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    lock: (state) => {
      if (state.biometricEnabled && state.isAuthenticated) state.locked = true;
    },
    sessionExpired: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.locked = false;
      state.error = 'Your session expired, please sign in again';
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    cancelTwoFactor: (state) => {
      state.challengeToken = null;
    },
    /** From the lock screen: go to the password form but keep the saved session for a biometric retry. */
    showPasswordLogin: (state) => {
      state.locked = false;
      state.isAuthenticated = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrap.fulfilled, (state, { payload }) => {
        state.bootstrapped = true;
        state.biometricEnabled = payload.biometricEnabled;
        state.locked = payload.locked;
        state.user = payload.user;
        state.isAuthenticated = Boolean(payload.user) || payload.locked;
      })
      .addCase(bootstrap.rejected, (state) => {
        state.bootstrapped = true;
      })
      .addCase(unlockWithBiometric.fulfilled, (state, { payload }) => {
        state.locked = false;
        state.isAuthenticated = true;
        state.user = payload;
        state.error = null;
      })
      .addCase(unlockWithBiometric.rejected, (state, { payload }) => {
        state.error = (payload as string) ?? 'Unlock failed';
      })
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, { payload }) => {
        state.loading = false;
        if ('twoFactorRequired' in payload) {
          state.challengeToken = payload.challengeToken;
          return;
        }
        state.isAuthenticated = true;
        state.locked = false;
        state.user = payload.user;
      })
      .addCase(login.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload as string;
      })
      .addCase(verifyTwoFactor.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyTwoFactor.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.challengeToken = null;
        state.isAuthenticated = true;
        state.user = payload.user;
      })
      .addCase(verifyTwoFactor.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload as string;
      })
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = payload.user;
      })
      .addCase(register.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload as string;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.locked = false;
      })
      .addCase(forgetSession.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.locked = false;
      })
      .addCase(refreshProfile.fulfilled, (state, { payload }) => {
        state.user = payload;
      })
      .addCase(setBiometricPreference.fulfilled, (state, { payload }) => {
        state.biometricEnabled = payload;
      })
      .addCase(setBiometricPreference.rejected, (state, { payload }) => {
        state.error = (payload as string) ?? 'Could not change biometric setting';
      });
  },
});

export const { clearError, lock, sessionExpired, setUser, cancelTwoFactor, showPasswordLogin } = authSlice.actions;
export default authSlice.reducer;
