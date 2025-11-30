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
