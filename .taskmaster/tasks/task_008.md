# Task ID: 8

**Title:** Initialize Nuxt 4 Frontend with FSD Architecture

**Status:** pending

**Dependencies:** 1 ✓

**Priority:** high

**Description:** Set up Nuxt 4 application with Feature-Sliced Design structure, Nuxt UI v3, Tailwind CSS 4, Pinia for state management, and configure API client with JWT interceptors.

**Details:**

1. Initialize Nuxt 4 in apps/web:
```bash
cd apps/web
pnpx nuxi@latest init . --package-manager pnpm
```

2. Install dependencies:
```bash
pnpm add @nuxt/ui pinia @pinia/nuxt @vueuse/core
pnpm add -D @nuxtjs/tailwindcss
```

3. Update apps/web/nuxt.config.ts:
```typescript
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@pinia/nuxt'],
  
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001/api',
    },
  },

  typescript: {
    strict: true,
    typeCheck: true,
  },

  compatibilityDate: '2025-01-01',
});
```

4. Create FSD directory structure:
```bash
mkdir -p src/{app/{providers,styles},pages,widgets,features,entities,shared/{api,ui,lib,config}}
```

5. Create apps/web/src/shared/api/client.ts:
```typescript
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
    if (process.client) {
      this.accessToken = sessionStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');
    }
  }

  private saveTokens(tokens: AuthTokens) {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    if (process.client) {
      sessionStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }
  }

  private clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    if (process.client) {
      sessionStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
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
      if (process.client) {
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
```

6. Create apps/web/src/app/providers/api.plugin.ts:
```typescript
import { createApiClient } from '~/shared/api/client';

export default defineNuxtPlugin(() => {
  const api = createApiClient();
  
  return {
    provide: {
      api,
    },
  };
});
```

7. Create apps/web/src/shared/ui/components/UButton.vue (example shared component):
```vue
<template>
  <UButton v-bind="$attrs">
    <slot />
  </UButton>
</template>

<script setup lang="ts">
// Re-export Nuxt UI components for FSD shared layer
</script>
```

8. Create apps/web/src/entities/user/model/store.ts:
```typescript
import { defineStore } from 'pinia';
import type { User } from '@telegram-crawler/types';

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null);
  const isAuthenticated = computed(() => !!user.value);

  const setUser = (newUser: User | null) => {
    user.value = newUser;
  };

  const clearUser = () => {
    user.value = null;
  };

  return {
    user,
    isAuthenticated,
    setUser,
    clearUser,
  };
});
```

9. Create apps/web/src/features/auth/api/index.ts:
```typescript
export const authApi = {
  async login(email: string, password: string) {
    const api = useApi();
    return api.login(email, password);
  },

  async logout() {
    const api = useApi();
    return api.logout();
  },

  async getCurrentUser() {
    const api = useApi();
    return api.request('/auth/me', { method: 'POST' });
  },
};
```

10. Create apps/web/src/app/middleware/auth.global.ts:
```typescript
export default defineNuxtRouteMiddleware((to) => {
  const api = useApi();
  const publicRoutes = ['/auth/login', '/auth/register'];

  if (!api.isAuthenticated() && !publicRoutes.includes(to.path)) {
    return navigateTo('/auth/login');
  }

  if (api.isAuthenticated() && publicRoutes.includes(to.path)) {
    return navigateTo('/');
  }
});
```

11. Update apps/web/package.json to use workspace types:
```json
{
  "dependencies": {
    "@telegram-crawler/types": "workspace:*"
  }
}
```

**Test Strategy:**

1. Verify Nuxt dev server starts:
```bash
pnpm dev
```
2. Test ApiClient:
   - Unit test request method with mock fetch
   - Unit test token refresh flow
   - Unit test 401 handling and redirect
   - Test saveTokens/clearTokens with localStorage mock
3. Test auth middleware:
   - Unauthenticated user redirected to /auth/login
   - Authenticated user can access protected routes
   - Authenticated user redirected from /auth/login to /
4. Test useUserStore:
   - setUser updates user state
   - isAuthenticated computed property
   - clearUser resets state
5. Visual test: Verify Nuxt UI components render correctly
6. E2E test: Navigate to / -> redirected to /auth/login
