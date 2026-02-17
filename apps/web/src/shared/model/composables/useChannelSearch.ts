import { ref, type Ref } from 'vue';
import type { SourceChannel } from '@aggregram/types';

interface UseChannelLookupReturn {
  query: Ref<string>;
  result: Ref<SourceChannel | null>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  lookup: (username: string) => Promise<void>;
  clear: () => void;
}

/**
 * Composable for looking up a Telegram channel by exact username.
 */
export function useChannelSearch(): UseChannelLookupReturn {
  const query = ref('');
  const result = ref<SourceChannel | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const lookup = async (username: string): Promise<void> => {
    query.value = username;
    error.value = null;

    if (!username || !username.trim()) {
      result.value = null;
      return;
    }

    loading.value = true;

    try {
      const { $api } = useNuxtApp();
      const response = await $api<{ channel: SourceChannel }>(
        '/channels/lookup',
        {
          params: { username: username.trim() },
        }
      );

      result.value = response.channel;
    } catch (err: any) {
      console.error('Channel lookup failed:', err);

      if (err?.statusCode === 404 || err?.status === 404) {
        error.value = 'Channel not found';
      } else if (err?.statusCode === 401 && err?.data?.requiresReauth === true) {
        error.value = 'Your Telegram session has expired. Please reconnect.';

        const { $toast } = useNuxtApp();
        if ($toast) {
          $toast.error('Telegram session expired', {
            description: 'Please reconnect your Telegram account.',
            action: {
              label: 'Reconnect',
              onClick: () => navigateTo('/setup/telegram'),
            },
          });
        } else {
          setTimeout(() => navigateTo('/setup/telegram'), 2000);
        }
      } else {
        error.value = err?.data?.message || 'Failed to look up channel';
      }

      result.value = null;
    } finally {
      loading.value = false;
    }
  };

  const clear = (): void => {
    query.value = '';
    result.value = null;
    error.value = null;
    loading.value = false;
  };

  return {
    query,
    result,
    loading,
    error,
    lookup,
    clear,
  };
}
