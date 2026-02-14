import type {
  FeedListResponse,
  FeedWithDetails,
  CreateFeedRequest,
  MessageResponse,
  FeedSourcesResponse,
  AddSourceRequest,
  AggregationJobsResponse,
} from '@aggregram/types'

export function feedApi($api: typeof $fetch) {
  return {
    getFeeds() {
      return $api<FeedListResponse>('/feeds')
    },

    getFeed(id: string) {
      return $api<FeedWithDetails>(`/feeds/${id}`)
    },

    createFeed(data: CreateFeedRequest) {
      return $api<FeedWithDetails>('/feeds', {
        method: 'POST',
        body: data,
      })
    },

    updateFeed(id: string, data: Partial<CreateFeedRequest>) {
      return $api<FeedWithDetails>(`/feeds/${id}`, {
        method: 'PATCH',
        body: data,
      })
    },

    deleteFeed(id: string) {
      return $api<MessageResponse>(`/feeds/${id}`, {
        method: 'DELETE',
      })
    },

    getSources(feedId: string) {
      return $api<FeedSourcesResponse>(`/feeds/${feedId}/sources`)
    },

    addSource(feedId: string, data: AddSourceRequest) {
      return $api<FeedWithDetails>(`/feeds/${feedId}/sources`, {
        method: 'POST',
        body: data,
      })
    },

    removeSource(feedId: string, sourceId: string) {
      return $api<void>(`/feeds/${feedId}/sources/${sourceId}`, {
        method: 'DELETE',
      })
    },

    createChannel(feedId: string) {
      return $api<{ jobId: string; message: string }>(`/feeds/${feedId}/channel`, {
        method: 'POST',
      })
    },

    syncFeed(feedId: string) {
      return $api<MessageResponse>(`/feeds/${feedId}/sync`, {
        method: 'POST',
      })
    },

    pauseFeed(feedId: string) {
      return $api<FeedWithDetails>(`/feeds/${feedId}/pause`, {
        method: 'POST',
      })
    },

    resumeFeed(feedId: string) {
      return $api<FeedWithDetails>(`/feeds/${feedId}/resume`, {
        method: 'POST',
      })
    },

    getJobs(feedId: string) {
      return $api<AggregationJobsResponse>(`/feeds/${feedId}/jobs`)
    },
  }
}
