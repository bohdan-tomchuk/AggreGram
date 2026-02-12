import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

@Entity('user_bots')
export class UserBot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'bot_token', type: 'varchar' })
  botToken: string;

  @Column({ name: 'bot_username', type: 'varchar' })
  botUsername: string;

  @Column({ name: 'bot_telegram_id', type: 'bigint' })
  botTelegramId: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['creating', 'active', 'revoked', 'error'],
    default: 'creating',
  })
  status: 'creating' | 'active' | 'revoked' | 'error';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
