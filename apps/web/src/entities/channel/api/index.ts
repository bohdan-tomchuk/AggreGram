import type { Channel } from '@telegram-crawler/types';
import { useApi } from '~/shared/api/client';

export const channelApi = {
  async getAll(filters?: { topic?: string; channelType?: string; isActive?: boolean }) {
    const api = useApi();
    const params = new URLSearchParams();
    if (filters?.topic) params.append('topic', filters.topic);
    if (filters?.channelType) params.append('channelType', filters.channelType);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));

    return api.request<Channel[]>(`/channels?${params.toString()}`);
  },

  async create(data: { usernameOrLink: string; topic: string; channelType: string }) {
    const api = useApi();
    return api.request<Channel>('/channels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<Channel>) {
    const api = useApi();
    return api.request<Channel>(`/channels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    const api = useApi();
    return api.request(`/channels/${id}`, { method: 'DELETE' });
  },

  async refresh(id: string) {
    const api = useApi();
    return api.request<Channel>(`/channels/${id}/refresh`, { method: 'POST' });
  },
};
