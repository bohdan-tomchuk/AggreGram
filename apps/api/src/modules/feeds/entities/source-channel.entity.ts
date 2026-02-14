import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('source_channels')
export class SourceChannel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'telegram_channel_id', type: 'bigint', unique: true })
  telegramChannelId: string;

  @Column({ type: 'varchar', nullable: true })
  username: string | null;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'subscriber_count', type: 'int', nullable: true })
  subscriberCount: number | null;

  @Column({ name: 'avatar_url', type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'last_metadata_sync', type: 'timestamp', nullable: true })
  lastMetadataSync: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
