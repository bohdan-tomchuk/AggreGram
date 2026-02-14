import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Feed } from './feed.entity';
import { SourceChannel } from './source-channel.entity';

@Entity('feed_sources')
@Unique(['feedId', 'sourceChannelId'])
@Index(['feedId'])
export class FeedSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'feed_id' })
  feedId: string;

  @ManyToOne(() => Feed, (feed) => feed.feedSources, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'feed_id' })
  feed: Feed;

  @Column({ name: 'source_channel_id' })
  sourceChannelId: string;

  @ManyToOne(() => SourceChannel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_channel_id' })
  sourceChannel: SourceChannel;

  @Column({ name: 'last_message_id', type: 'bigint', nullable: true })
  lastMessageId: string | null;

  @CreateDateColumn({ name: 'added_at' })
  addedAt: Date;
}
