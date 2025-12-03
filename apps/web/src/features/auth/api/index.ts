import { useApi } from '~/shared/api/client';

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
