import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Feed } from './feed.entity';

export enum AggregationJobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('aggregation_jobs')
export class AggregationJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  feed_id: string;

  @ManyToOne(() => Feed, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'feed_id' })
  feed: Feed;

  @Column({
    type: 'enum',
    enum: AggregationJobStatus,
    default: AggregationJobStatus.PENDING,
  })
  status: AggregationJobStatus;

  @Column({ type: 'int', default: 0 })
  messages_fetched: number;

  @Column({ type: 'int', default: 0 })
  messages_posted: number;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'timestamp', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
