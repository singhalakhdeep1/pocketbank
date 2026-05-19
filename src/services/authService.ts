import api from './api';

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

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        phone?: string;
        role: string;
    };
}

class AuthService {
    async register(data: RegisterRequest): Promise<AuthResponse> {
        const response = await api.post('/auth/register', data);
        return response.data;
    }

    async login(credentials: LoginRequest): Promise<AuthResponse> {
        const response = await api.post('/auth/login', credentials);
        return response.data;
    }

    async logout(): Promise<void> {
        await api.post('/auth/logout');
    }

    async getProfile() {
        const response = await api.get('/profile');
        return response.data;
    }
}

export const authService = new AuthService();
