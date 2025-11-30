import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Channel } from './channel.entity';

@Entity('posts')
@Index(['channelId', 'postedAt'])
@Index('post_search_idx', { synchronize: false })
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
