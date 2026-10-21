import api, { clearSession, saveSession } from './api';
import { KEYS, getItem } from './secureStorage';
import type { AuthResponse, LoginResponse, User } from '../types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

class AuthService {
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', data, { auth: false });
    await saveSession(response.accessToken, response.refreshToken);
    return response;
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', credentials, { auth: false });
    if ('accessToken' in response) await saveSession(response.accessToken, response.refreshToken);
    return response;
  }

  async verifyTwoFactor(challengeToken: string, code: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login/2fa', { challengeToken, code }, { auth: false });
    await saveSession(response.accessToken, response.refreshToken);
    return response;
  }

  async logout(): Promise<void> {
    const refreshToken = await getItem(KEYS.refreshToken);
    await api.post('/auth/logout', { refreshToken }, { auth: false }).catch(() => undefined);
    await clearSession();
  }

  async getProfile(): Promise<User> {
    return api.get<User>('/profile');
  }
}

export const authService = new AuthService();
