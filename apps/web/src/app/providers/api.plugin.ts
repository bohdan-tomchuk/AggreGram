import { createApiClient } from '~/shared/api/client';

export default defineNuxtPlugin(() => {
  const api = createApiClient();

  return {
    provide: {
      api,
    },
  };
});
