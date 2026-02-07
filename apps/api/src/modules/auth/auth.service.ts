import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { RefreshToken } from './refresh-token.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async register(email: string, password: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const saltRounds = this.configService.get<number>('auth.bcryptSaltRounds')!;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const user = await this.usersService.create(email, passwordHash);

    return this.generateTokenPair(user);
  }

  async login(user: User) {
    return this.generateTokenPair(user);
  }

  async refreshTokens(rawRefreshToken: string) {
    let payload: { sub: string; email: string; familyId: string };
    try {
      payload = this.jwtService.verify(rawRefreshToken, {
        secret: this.configService.get<string>('auth.jwtRefreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    });

    if (!storedToken) {
      // Token not found — possible theft. Revoke entire family.
      await this.refreshTokenRepository.update(
        { familyId: payload.familyId },
        { isRevoked: true },
      );
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (storedToken.isRevoked) {
      // Revoked token reused — theft detected. Revoke entire family.
      await this.refreshTokenRepository.update(
        { familyId: storedToken.familyId },
        { isRevoked: true },
      );
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke the old token
    storedToken.isRevoked = true;
    await this.refreshTokenRepository.save(storedToken);

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Issue new pair with same family
    return this.generateTokenPair(user, storedToken.familyId);
  }

  async logout(rawRefreshToken: string) {
    if (!rawRefreshToken) return;

    const tokenHash = this.hashToken(rawRefreshToken);
    await this.refreshTokenRepository.update({ tokenHash }, { isRevoked: true });
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
  }

  async generateTokenPair(user: User, familyId?: string) {
    const tokenFamilyId = familyId || crypto.randomUUID();

    const accessPayload = { sub: user.id, email: user.email };
    const refreshPayload = {
      sub: user.id,
      email: user.email,
      familyId: tokenFamilyId,
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.get<string>('auth.jwtAccessSecret')!,
      expiresIn: this.configService.get<string>('auth.jwtAccessExpiresIn')! as any,
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>('auth.jwtRefreshSecret')!,
      expiresIn: this.configService.get<string>('auth.jwtRefreshExpiresIn')! as any,
    });

    // Store refresh token hash
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        tokenHash,
        userId: user.id,
        expiresAt,
        familyId: tokenFamilyId,
      }),
    );

    // Clean up expired tokens for this user (housekeeping)
    await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .where('user_id = :userId', { userId: user.id })
      .andWhere('expires_at < :now', { now: new Date() })
      .execute();

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
