import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Feed } from './feed.entity';

@Entity('feed_channels')
export class FeedChannel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'feed_id', unique: true })
  feedId: string;

  @OneToOne(() => Feed, (feed) => feed.feedChannel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'feed_id' })
  feed: Feed;

  @Column({ name: 'telegram_channel_id', type: 'bigint' })
  telegramChannelId: string;

  @Column({ name: 'invite_link', type: 'varchar' })
  inviteLink: string;

  @Column({ type: 'varchar' })
  title: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
