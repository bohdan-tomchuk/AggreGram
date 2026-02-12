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

@Entity('telegram_connections')
export class TelegramConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'telegram_user_id', type: 'bigint', nullable: true })
  telegramUserId: string | null;

  @Column({ name: 'phone_number', type: 'varchar', nullable: true })
  phoneNumber: string | null;

  @Column({
    name: 'session_status',
    type: 'enum',
    enum: ['active', 'expired', 'revoked'],
    default: 'active',
  })
  sessionStatus: 'active' | 'expired' | 'revoked';

  @Column({ name: 'auth_step', type: 'varchar', default: 'idle' })
  authStep: string;

  @Column({ name: 'last_auth_method', type: 'varchar', nullable: true })
  lastAuthMethod: string | null;

  @Column({ name: 'last_activity_at', type: 'timestamp', nullable: true })
  lastActivityAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
