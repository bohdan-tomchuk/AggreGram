import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { FeedSource } from './feed-source.entity';
import { FeedChannel } from './feed-channel.entity';

export enum FeedStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ERROR = 'error',
}

@Entity('feeds')
@Index(['userId', 'status'])
export class Feed {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: FeedStatus,
    default: FeedStatus.DRAFT,
  })
  status: FeedStatus;

  @Column({ name: 'polling_interval_sec', type: 'int', default: 300 })
  pollingIntervalSec: number;

  @Column({ name: 'fetch_from_date', type: 'timestamp', nullable: true })
  fetchFromDate: Date | null;

  @OneToMany(() => FeedSource, (feedSource) => feedSource.feed)
  feedSources: FeedSource[];

  @OneToOne(() => FeedChannel, (feedChannel) => feedChannel.feed)
  feedChannel: FeedChannel | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
