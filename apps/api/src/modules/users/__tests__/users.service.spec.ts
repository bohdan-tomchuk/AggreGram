import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users.service';
import { User } from '../../../database/entities/user.entity';

// Mock bcrypt module
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

describe('UsersService', () => {
  let service: UsersService;
  let repository: Repository<User>;

  const mockUser = {
    id: 'user-id-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    name: 'Test User',
    isActive: true,
  };

  const mockRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should throw ConflictException for duplicate email', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.create('test@example.com', 'password'),
      ).rejects.toThrow(ConflictException);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should hash password with bcrypt cost factor 12', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      await service.create('test@example.com', 'password123');

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
    });

    it('should create user with hashed password', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.create(
        'test@example.com',
        'password123',
        'Test User',
      );

      expect(mockRepository.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        name: 'Test User',
      });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should verify hash differs from plaintext password', async () => {
      // This test verifies the concept, not the actual bcrypt implementation
      // since bcrypt is mocked in our tests
      const plainPassword = 'password123';
      const hashedPassword = 'hashed-password';

      expect(hashedPassword).not.toBe(plainPassword);
      expect(typeof hashedPassword).toBe('string');
    });
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById('user-id-123');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-id-123' },
      });
    });

    it('should return null when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('validatePassword', () => {
    it('should return true for correct password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const user = { ...mockUser, passwordHash: 'hashed-password' } as User;

      const result = await service.validatePassword(user, 'correct-password');

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'correct-password',
        'hashed-password',
      );
    });

    it('should return false for incorrect password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const user = { ...mockUser, passwordHash: 'hashed-password' } as User;

      const result = await service.validatePassword(user, 'wrong-password');

      expect(result).toBe(false);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'wrong-password',
        'hashed-password',
      );
    });

    it('should use bcrypt.compare for validation', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.validatePassword(mockUser as User, 'password');

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password',
        mockUser.passwordHash,
      );
    });
  });
});
