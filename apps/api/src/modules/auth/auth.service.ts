import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive)
      throw new UnauthorizedException('Invalid credentials');

    const isValid = await this.usersService.validatePassword(user, password);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    return this.generateTokens(user.id);
  }

  async generateTokens(userId: string) {
    const payload = { sub: userId };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.refreshSecret'),
      expiresIn: this.configService.get('jwt.refreshExpiresIn'),
    });

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshTokenRepository.save({
      userId,
      tokenHash,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<{ sub: string }>(refreshToken, {
        secret: this.configService.get('jwt.refreshSecret'),
      });

      const tokens = await this.refreshTokenRepository.find({
        where: { userId: payload.sub, isRevoked: false },
      });

      let isValid = false;
      for (const token of tokens) {
        if (await bcrypt.compare(refreshToken, token.tokenHash)) {
          isValid = true;
          await this.refreshTokenRepository.update(token.id, {
            isRevoked: true,
          });
          break;
        }
      }

      if (!isValid) throw new UnauthorizedException();
      return this.generateTokens(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string) {
    const payload = this.jwtService.decode(refreshToken) as {
      sub: string;
    } | null;
    if (payload?.sub) {
      await this.refreshTokenRepository.update(
        { userId: payload.sub, isRevoked: false },
        { isRevoked: true },
      );
    }
  }
}
