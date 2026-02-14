import { ref, type Ref } from 'vue';
import type { SourceChannel } from '@aggregram/types';

interface UseChannelSearchReturn {
  query: Ref<string>;
  results: Ref<SourceChannel[]>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  search: (searchQuery: string) => Promise<void>;
  clear: () => void;
}

/**
 * Composable for searching Telegram channels.
 * Provides debounced search functionality with loading and error states.
 */
export function useChannelSearch(): UseChannelSearchReturn {
  const query = ref('');
  const results = ref<SourceChannel[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  let debounceTimeout: NodeJS.Timeout | null = null;

  const search = async (searchQuery: string): Promise<void> => {
    query.value = searchQuery;
    error.value = null;

    // Clear previous timeout
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    // Don't search for empty or very short queries
    if (!searchQuery || searchQuery.trim().length < 2) {
      results.value = [];
      loading.value = false;
      return;
    }

    // Debounce the search
    debounceTimeout = setTimeout(async () => {
      loading.value = true;

      try {
        const response = await $fetch<{ channels: SourceChannel[]; total: number }>(
          '/api/channels/search',
          {
            params: { q: searchQuery.trim() },
          }
        );

        results.value = response.channels;
      } catch (err: any) {
        console.error('Channel search failed:', err);
        error.value = err?.data?.message || 'Failed to search channels';
        results.value = [];
      } finally {
        loading.value = false;
      }
    }, 300); // 300ms debounce
  };

  const clear = (): void => {
    query.value = '';
    results.value = [];
    error.value = null;
    loading.value = false;

    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
  };

  return {
    query,
    results,
    loading,
    error,
    search,
    clear,
  };
}
