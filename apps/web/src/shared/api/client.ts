import type { AuthTokens } from '@telegram-crawler/types';

class ApiClient {
  private baseURL: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.loadTokens();
  }

  private loadTokens() {
    if (import.meta.client) {
      this.accessToken = sessionStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');
    }
  }

  private saveTokens(tokens: AuthTokens) {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    if (import.meta.client) {
      sessionStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }
  }

  private clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    if (import.meta.client) {
      sessionStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    let response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle token refresh
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        headers.Authorization = `Bearer ${this.accessToken}`;
        response = await fetch(`${this.baseURL}${endpoint}`, {
          ...options,
          headers,
        });
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      const tokens = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      }).then(r => r.json());

      this.saveTokens(tokens);
      return true;
    } catch {
      this.clearTokens();
      if (import.meta.client) {
        window.location.href = '/auth/login';
      }
      return false;
    }
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const tokens = await this.request<AuthTokens>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.saveTokens(tokens);
    return tokens;
  }

  async logout() {
    if (this.refreshToken) {
      await this.request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
    }
    this.clearTokens();
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }
}

export const createApiClient = () => {
  const config = useRuntimeConfig();
  return new ApiClient(config.public.apiBase);
};

export const useApi = () => {
  const nuxtApp = useNuxtApp();
  if (!nuxtApp.$api) {
    nuxtApp.$api = createApiClient();
  }
  return nuxtApp.$api as ApiClient;
};
