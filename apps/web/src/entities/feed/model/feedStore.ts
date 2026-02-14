import { defineStore } from 'pinia'
import type { FeedWithDetails, CreateFeedRequest, FeedSource, AddSourceRequest, AggregationJob } from '@aggregram/types'
import { feedApi } from '@entities/feed/api/feedApi'

export const useFeedStore = defineStore('feed', () => {
  const { $api } = useNuxtApp()
  const api = feedApi($api as typeof $fetch)
  const toast = useToast()

  // --- State ---
  const feeds = ref<FeedWithDetails[]>([])
  const loading = ref(false)
  const error = ref('')
  const sourcesLoading = ref(false)
  const channelCreationLoading = ref(false)
  const syncLoading = ref(false)

  // --- Computed ---
  const hasFeeds = computed(() => feeds.value.length > 0)
  const activeFeeds = computed(() => feeds.value.filter(f => f.status === 'active'))
  const pausedFeeds = computed(() => feeds.value.filter(f => f.status === 'paused'))
  const draftFeeds = computed(() => feeds.value.filter(f => f.status === 'draft'))

  // --- Actions ---

  function extractError(e: unknown): string {
    const data = (e as any)?.data
    if (data?.message) {
      return Array.isArray(data.message) ? data.message[0] : data.message
    }
    return 'Something went wrong. Please try again.'
  }

  async function fetchFeeds(): Promise<void> {
    loading.value = true
    error.value = ''

    try {
      const response = await api.getFeeds()
      feeds.value = response.feeds
    } catch (e) {
      error.value = extractError(e)
      console.error('Failed to fetch feeds:', error.value)
    } finally {
      loading.value = false
    }
  }

  async function getFeed(id: string): Promise<FeedWithDetails | null> {
    loading.value = true
    error.value = ''

    try {
      const feed = await api.getFeed(id)
      return feed
    } catch (e) {
      error.value = extractError(e)
      console.error('Failed to fetch feed:', error.value)
      return null
    } finally {
      loading.value = false
    }
  }

  async function createFeed(data: CreateFeedRequest): Promise<FeedWithDetails | null> {
    loading.value = true
    error.value = ''

    try {
      const newFeed = await api.createFeed(data)
      feeds.value.push(newFeed)
      toast.add({
        title: 'Feed created',
        description: `${newFeed.name} has been created successfully.`,
        color: 'success'
      })
      return newFeed
    } catch (e) {
      error.value = extractError(e)
      toast.add({
        title: 'Failed to create feed',
        description: error.value,
        color: 'error'
      })
      return null
    } finally {
      loading.value = false
    }
  }

  async function deleteFeed(id: string): Promise<boolean> {
    loading.value = true
    error.value = ''

    try {
      await api.deleteFeed(id)
      feeds.value = feeds.value.filter(f => f.id !== id)
      toast.add({
        title: 'Feed deleted',
        description: 'Feed has been deleted successfully.',
        color: 'success'
      })
      return true
    } catch (e) {
      error.value = extractError(e)
      toast.add({
        title: 'Failed to delete feed',
        description: error.value,
        color: 'error'
      })
      return false
    } finally {
      loading.value = false
    }
  }

  async function getSources(feedId: string): Promise<FeedSource[]> {
    sourcesLoading.value = true
    error.value = ''

    try {
      const response = await api.getSources(feedId)
      return response.sources
    } catch (e) {
      error.value = extractError(e)
      console.error('Failed to fetch sources:', error.value)
      return []
    } finally {
      sourcesLoading.value = false
    }
  }

  async function addSource(feedId: string, data: AddSourceRequest): Promise<boolean> {
    sourcesLoading.value = true
    error.value = ''

    try {
      const updatedFeed = await api.addSource(feedId, data)
      // Update feed in list
      const index = feeds.value.findIndex(f => f.id === feedId)
      if (index !== -1) {
        feeds.value[index] = updatedFeed
      }
      toast.add({
        title: 'Source added',
        description: `Channel @${data.channelUsername} has been added to your feed.`,
        color: 'success'
      })
      return true
    } catch (e) {
      error.value = extractError(e)
      toast.add({
        title: 'Failed to add source',
        description: error.value,
        color: 'error'
      })
      return false
    } finally {
      sourcesLoading.value = false
    }
  }

  async function removeSource(feedId: string, sourceId: string): Promise<boolean> {
    sourcesLoading.value = true
    error.value = ''

    try {
      await api.removeSource(feedId, sourceId)
      toast.add({
        title: 'Source removed',
        description: 'Channel has been removed from your feed.',
        color: 'success'
      })
      return true
    } catch (e) {
      error.value = extractError(e)
      toast.add({
        title: 'Failed to remove source',
        description: error.value,
        color: 'error'
      })
      return false
    } finally {
      sourcesLoading.value = false
    }
  }

  async function createChannel(feedId: string): Promise<boolean> {
    channelCreationLoading.value = true
    error.value = ''

    try {
      await api.createChannel(feedId)
      toast.add({
        title: 'Channel creation started',
        description: 'Your Telegram channel is being created. This may take up to 30 seconds.',
        color: 'success'
      })
      return true
    } catch (e) {
      error.value = extractError(e)
      toast.add({
        title: 'Failed to create channel',
        description: error.value,
        color: 'error'
      })
      return false
    } finally {
      channelCreationLoading.value = false
    }
  }

  async function syncFeed(feedId: string): Promise<boolean> {
    syncLoading.value = true
    error.value = ''

    try {
      await api.syncFeed(feedId)
      toast.add({
        title: 'Sync started',
        description: 'Feed sync has been triggered. Messages will be fetched shortly.',
        color: 'success'
      })
      return true
    } catch (e) {
      error.value = extractError(e)
      toast.add({
        title: 'Failed to sync feed',
        description: error.value,
        color: 'error'
      })
      return false
    } finally {
      syncLoading.value = false
    }
  }

  async function pauseFeed(feedId: string): Promise<boolean> {
    loading.value = true
    error.value = ''

    try {
      const updatedFeed = await api.pauseFeed(feedId)
      // Update feed in list
      const index = feeds.value.findIndex(f => f.id === feedId)
      if (index !== -1) {
        feeds.value[index] = updatedFeed
      }
      toast.add({
        title: 'Feed paused',
        description: 'Feed aggregation has been paused.',
        color: 'success'
      })
      return true
    } catch (e) {
      error.value = extractError(e)
      toast.add({
        title: 'Failed to pause feed',
        description: error.value,
        color: 'error'
      })
      return false
    } finally {
      loading.value = false
    }
  }

  async function resumeFeed(feedId: string): Promise<boolean> {
    loading.value = true
    error.value = ''

    try {
      const updatedFeed = await api.resumeFeed(feedId)
      // Update feed in list
      const index = feeds.value.findIndex(f => f.id === feedId)
      if (index !== -1) {
        feeds.value[index] = updatedFeed
      }
      toast.add({
        title: 'Feed resumed',
        description: 'Feed aggregation has been resumed.',
        color: 'success'
      })
      return true
    } catch (e) {
      error.value = extractError(e)
      toast.add({
        title: 'Failed to resume feed',
        description: error.value,
        color: 'error'
      })
      return false
    } finally {
      loading.value = false
    }
  }

  async function getJobs(feedId: string): Promise<AggregationJob[]> {
    error.value = ''

    try {
      const response = await api.getJobs(feedId)
      return response.jobs
    } catch (e) {
      error.value = extractError(e)
      console.error('Failed to fetch jobs:', error.value)
      return []
    }
  }

  function reset() {
    feeds.value = []
    loading.value = false
    error.value = ''
    sourcesLoading.value = false
    channelCreationLoading.value = false
    syncLoading.value = false
  }

  return {
    // State
    feeds,
    loading,
    error,
    sourcesLoading,
    channelCreationLoading,
    syncLoading,
    // Computed
    hasFeeds,
    activeFeeds,
    pausedFeeds,
    draftFeeds,
    // Actions
    fetchFeeds,
    getFeed,
    createFeed,
    deleteFeed,
    getSources,
    addSource,
    removeSource,
    createChannel,
    syncFeed,
    pauseFeed,
    resumeFeed,
    getJobs,
    reset,
  }
})
