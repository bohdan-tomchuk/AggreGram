import type { Post } from '@telegram-crawler/types';

interface FeedResponse {
  data: Post[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const postApi = {
  async getFeed(params?: {
    channelId?: string;
    topic?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const api = useApi();
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value) query.append(key, String(value));
    });
    return api.request<FeedResponse>(`/posts?${query.toString()}`);
  },

  async search(q: string, params?: { topic?: string; dateFrom?: string; dateTo?: string; page?: number }) {
    const api = useApi();
    const query = new URLSearchParams({ q });
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value) query.append(key, String(value));
    });
    return api.request<FeedResponse>(`/posts/search?${query.toString()}`);
  },
};
