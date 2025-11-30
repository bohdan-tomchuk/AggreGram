# Task ID: 3

**Title:** Create Database Schema and TypeORM Entities

**Status:** pending

**Dependencies:** 2

**Priority:** high

**Description:** Define TypeORM entities for User, Channel, Post, and RefreshToken with proper relationships, indexes, and migrations.

**Details:**

1. Create apps/api/src/database/entities/user.entity.ts:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { RefreshToken } from './refresh-token.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ type: 'enum', enum: ['admin', 'user'], default: 'user' })
  role: 'admin' | 'user';

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => RefreshToken, token => token.user)
  refreshTokens: RefreshToken[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

2. Create apps/api/src/database/entities/refresh-token.entity.ts:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, user => user.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'token_hash' })
  @Index()
  tokenHash: string;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'is_revoked', default: false })
  isRevoked: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

3. Create apps/api/src/database/entities/channel.entity.ts:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { Post } from './post.entity';

@Entity('channels')
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'telegram_id', type: 'bigint', unique: true })
  @Index()
  telegramId: string;

  @Column({ nullable: true, unique: true })
  @Index()
  username?: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'subscriber_count', nullable: true })
  subscriberCount?: number;

  @Column({ name: 'photo_url', nullable: true })
  photoUrl?: string;

  @Column()
  @Index()
  topic: string;

  @Column({ name: 'channel_type', type: 'enum', enum: ['news', 'personal_blog', 'official'] })
  channelType: 'news' | 'personal_blog' | 'official';

  @Column({ name: 'is_active', default: true })
  @Index()
  isActive: boolean;

  @Column({ name: 'last_crawled_at', nullable: true })
  lastCrawledAt?: Date;

  @Column({ name: 'last_post_id', type: 'bigint', nullable: true })
  lastPostId?: string;

  @Column({ name: 'crawl_priority', default: 5 })
  crawlPriority: number;

  @OneToMany(() => Post, post => post.channel)
  posts: Post[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

4. Create apps/api/src/database/entities/post.entity.ts:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Channel } from './channel.entity';

@Entity('posts')
@Index(['channelId', 'postedAt'])
@Index('post_search_idx', { synchronize: false }) // Created in migration
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'channel_id' })
  channelId: string;

  @ManyToOne(() => Channel, channel => channel.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @Column({ name: 'telegram_post_id', type: 'bigint' })
  @Index()
  telegramPostId: string;

  @Column({ name: 'text_content', type: 'text', nullable: true })
  textContent?: string;

  @Column({ name: 'has_media', default: false })
  hasMedia: boolean;

  @Column({ name: 'media_type', type: 'enum', enum: ['photo', 'video', 'document'], nullable: true })
  mediaType?: 'photo' | 'video' | 'document';

  @Column({ name: 'media_file_id', nullable: true })
  mediaFileId?: string;

  @Column({ name: 'media_thumbnail', nullable: true })
  mediaThumbnail?: string;

  @Column({ nullable: true })
  views?: number;

  @Column({ nullable: true })
  forwards?: number;

  @Column({ name: 'posted_at' })
  @Index()
  postedAt: Date;

  @Column({ name: 'is_edited', default: false })
  isEdited: boolean;

  @Column({ name: 'edited_at', nullable: true })
  editedAt?: Date;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @Column({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

5. Create migration:
```bash
pnpm typeorm migration:generate -n InitialSchema
```

6. Add full-text search index in migration:
```typescript
await queryRunner.query(`
  ALTER TABLE posts ADD COLUMN search_vector tsvector;
  CREATE INDEX post_search_idx ON posts USING gin(search_vector);
  CREATE OR REPLACE FUNCTION posts_search_vector_update() RETURNS trigger AS $$
  BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.text_content, ''));
    RETURN NEW;
  END
  $$ LANGUAGE plpgsql;
  CREATE TRIGGER posts_search_vector_update_trigger
  BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION posts_search_vector_update();
`);
```

**Test Strategy:**

1. Run migrations:
```bash
pnpm typeorm migration:run
```
2. Verify all tables created in PostgreSQL
3. Test entity relationships with repository operations
4. Verify indexes exist using:
```sql
SELECT * FROM pg_indexes WHERE tablename IN ('users', 'channels', 'posts', 'refresh_tokens');
```
5. Test full-text search trigger:
```sql
INSERT INTO posts (channel_id, telegram_post_id, text_content, posted_at) VALUES (...); SELECT search_vector FROM posts WHERE id = ...;
```
6. Unit test entity validation rules
