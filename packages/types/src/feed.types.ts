export type FeedStatus = 'draft' | 'active' | 'paused' | 'error';

export interface SourceChannel {
  id: string;
  telegramChannelId: string;
  username: string | null;
  title: string;
  description: string | null;
  subscriberCount: number | null;
  avatarUrl: string | null;
  lastMetadataSync: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedSource {
  id: string;
  feedId: string;
  sourceChannelId: string;
  lastMessageId: string | null;
  addedAt: string;
  channel: SourceChannel;
}

export interface Feed {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  status: FeedStatus;
  pollingIntervalSec: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeedChannel {
  id: string;
  feedId: string;
  telegramChannelId: string;
  inviteLink: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedWithDetails extends Feed {
  feedChannel: FeedChannel | null;
  sourceCount: number;
}

export interface CreateFeedRequest {
  name: string;
  description?: string;
  pollingIntervalSec?: number;
  fetchFromDate?: string;
}

export interface FeedListResponse {
  feeds: FeedWithDetails[];
  total: number;
}

export interface AddSourceRequest {
  channelUsername: string;
}

export interface FeedSourcesResponse {
  sources: FeedSource[];
  total: number;
}

export interface ChannelLookupResponse {
  channel: SourceChannel;
}

export type AggregationJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AggregationJob {
  id: string;
  feedId: string;
  status: AggregationJobStatus;
  messagesFetched: number;
  messagesPosted: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AggregationJobsResponse {
  jobs: AggregationJob[];
  total: number;
}
