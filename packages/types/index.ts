export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Channel {
  id: string;
  telegramId: string;
  username?: string;
  title: string;
  description?: string;
  subscriberCount?: number;
  photoUrl?: string;
  topic: string;
  channelType: 'news' | 'personal_blog' | 'official';
  isActive: boolean;
  lastCrawledAt?: Date;
  lastPostId?: string;
  crawlPriority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Post {
  id: string;
  channelId: string;
  telegramPostId: string;
  textContent?: string;
  hasMedia: boolean;
  mediaType?: 'photo' | 'video' | 'document';
  mediaFileId?: string;
  mediaThumbnail?: string;
  views?: number;
  forwards?: number;
  postedAt: Date;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}
