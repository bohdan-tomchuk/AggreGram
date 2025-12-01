import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { RefreshToken } from '../../../database/entities/refresh-token.entity';

// Mock bcrypt module
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let refreshTokenRepository: Repository<RefreshToken>;

  const mockUser = {
    id: 'user-id-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    isActive: true,
  };

  const mockUsersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    validatePassword: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
    decode: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'jwt.refreshSecret': 'refresh-secret',
        'jwt.refreshExpiresIn': '7d',
      };
      return config[key];
    }),
  };

  const mockRefreshTokenRepository = {
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepository,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    refreshTokenRepository = module.get<Repository<RefreshToken>>(
      getRepositoryToken(RefreshToken),
    );

    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should throw UnauthorizedException for non-existent user', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login('test@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        service.login('test@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(false);

      await expect(
        service.login('test@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockUsersService.validatePassword).toHaveBeenCalledWith(
        mockUser,
        'wrong-password',
      );
    });

    it('should return tokens for valid credentials', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(true);
      mockJwtService.sign.mockReturnValueOnce('access-token');
      mockJwtService.sign.mockReturnValueOnce('refresh-token');
      mockRefreshTokenRepository.save.mockResolvedValue({});

      const result = await service.login('test@example.com', 'password');

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateTokens', () => {
    it('should create valid JWT payload with user ID', async () => {
      mockJwtService.sign.mockReturnValueOnce('access-token');
      mockJwtService.sign.mockReturnValueOnce('refresh-token');
      mockRefreshTokenRepository.save.mockResolvedValue({});

      await service.generateTokens('user-id-123');

      expect(mockJwtService.sign).toHaveBeenCalledWith({ sub: 'user-id-123' });
    });

    it('should save hashed refresh token to database', async () => {
      mockJwtService.sign.mockReturnValueOnce('access-token');
      mockJwtService.sign.mockReturnValueOnce('refresh-token');
      mockRefreshTokenRepository.save.mockResolvedValue({});
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');

      await service.generateTokens('user-id-123');

      expect(bcrypt.hash).toHaveBeenCalledWith('refresh-token', 10);
      expect(mockRefreshTokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-id-123',
          tokenHash: 'hashed-refresh-token',
          expiresAt: expect.any(Date),
        }),
      );
    });

    it('should set refresh token expiry to 7 days', async () => {
      mockJwtService.sign.mockReturnValueOnce('access-token');
      mockJwtService.sign.mockReturnValueOnce('refresh-token');

      const now = new Date();
      const expectedExpiry = new Date(now);
      expectedExpiry.setDate(expectedExpiry.getDate() + 7);

      await service.generateTokens('user-id-123');

      const saveCall = mockRefreshTokenRepository.save.mock.calls[0][0];
      const actualExpiry = saveCall.expiresAt;
      const timeDiff = Math.abs(actualExpiry.getTime() - expectedExpiry.getTime());
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });
  });

  describe('refreshTokens', () => {
    it('should throw UnauthorizedException for invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for token not in database', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-id-123' });
      mockRefreshTokenRepository.find.mockResolvedValue([]);

      await expect(service.refreshTokens('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should revoke old token before issuing new one', async () => {
      const mockToken = {
        id: 'token-id',
        tokenHash: 'hashed-token',
        userId: 'user-id-123',
        isRevoked: false,
      };

      mockJwtService.verify.mockReturnValue({ sub: 'user-id-123' });
      mockRefreshTokenRepository.find.mockResolvedValue([mockToken]);
      mockJwtService.sign.mockReturnValueOnce('new-access-token');
      mockJwtService.sign.mockReturnValueOnce('new-refresh-token');
      mockRefreshTokenRepository.save.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.refreshTokens('old-refresh-token');

      expect(mockRefreshTokenRepository.update).toHaveBeenCalledWith(
        'token-id',
        { isRevoked: true },
      );
    });

    it('should prevent reuse of same token twice', async () => {
      const mockToken = {
        id: 'token-id',
        tokenHash: 'hashed-token',
        userId: 'user-id-123',
        isRevoked: false,
      };

      mockJwtService.verify.mockReturnValue({ sub: 'user-id-123' });
      mockRefreshTokenRepository.find.mockResolvedValue([mockToken]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.refreshTokens('reused-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return new tokens after successful refresh', async () => {
      const mockToken = {
        id: 'token-id',
        tokenHash: 'hashed-token',
        userId: 'user-id-123',
        isRevoked: false,
      };

      mockJwtService.verify.mockReturnValue({ sub: 'user-id-123' });
      mockRefreshTokenRepository.find.mockResolvedValue([mockToken]);
      mockJwtService.sign.mockReturnValueOnce('new-access-token');
      mockJwtService.sign.mockReturnValueOnce('new-refresh-token');
      mockRefreshTokenRepository.save.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.refreshTokens('old-refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });
  });

  describe('logout', () => {
    it('should revoke all user tokens', async () => {
      mockJwtService.decode.mockReturnValue({ sub: 'user-id-123' });

      await service.logout('refresh-token');

      expect(mockRefreshTokenRepository.update).toHaveBeenCalledWith(
        { userId: 'user-id-123', isRevoked: false },
        { isRevoked: true },
      );
    });

    it('should handle invalid token gracefully', async () => {
      mockJwtService.decode.mockReturnValue(null);

      await expect(service.logout('invalid-token')).resolves.not.toThrow();
    });
  });
});
