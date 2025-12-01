import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../src/modules/auth/auth.module';
import { UsersModule } from '../src/modules/users/users.module';
import { User } from '../src/database/entities/user.entity';
import { RefreshToken } from '../src/database/entities/refresh-token.entity';
import { UsersService } from '../src/modules/users/users.service';
import databaseConfig from '../src/config/database.config';
import jwtConfig from '../src/config/jwt.config';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let usersService: UsersService;
  let testUser: User;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [databaseConfig, jwtConfig],
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USER || 'test',
          password: process.env.DB_PASSWORD || 'test',
          database: process.env.DB_NAME || 'aggregram_test',
          entities: [User, RefreshToken],
          synchronize: true,
          dropSchema: true,
        }),
        AuthModule,
        UsersModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    usersService = moduleFixture.get<UsersService>(UsersService);

    // Create a test user
    testUser = await usersService.create(
      'test@example.com',
      'Password123!',
      'Test User',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('should return tokens with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(typeof response.body.accessToken).toBe('string');
      expect(typeof response.body.refreshToken).toBe('string');
    });

    it('should return 401 with invalid password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
        })
        .expect(401);
    });

    it('should return 401 with non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        })
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        });
      refreshToken = response.body.refreshToken;
    });

    it('should return new tokens with valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.refreshToken).not.toBe(refreshToken);
    });

    it('should reject reused refresh token', async () => {
      // First refresh - should succeed
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      // Second refresh with same token - should fail
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('should return 401 with invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });

  describe('POST /auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        });
      accessToken = response.body.accessToken;
    });

    it('should return user data with valid access token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', 'test@example.com');
      expect(response.body).toHaveProperty('name', 'Test User');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should return 401 without access token', async () => {
      await request(app.getHttpServer()).post('/auth/me').expect(401);
    });

    it('should return 401 with invalid access token', async () => {
      await request(app.getHttpServer())
        .post('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    let refreshToken: string;
    let accessToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        });
      refreshToken = response.body.refreshToken;
      accessToken = response.body.accessToken;
    });

    it('should revoke refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken })
        .expect(200);

      // Try to use the revoked token
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('should still allow access token to work after logout', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken })
        .expect(200);

      // Access token should still work until it expires
      await request(app.getHttpServer())
        .post('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  describe('Complete authentication flow', () => {
    it('should handle complete flow: login -> access protected route -> refresh -> logout', async () => {
      // Step 1: Login
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        })
        .expect(200);

      const { accessToken, refreshToken } = loginResponse.body;

      // Step 2: Access protected route
      const meResponse = await request(app.getHttpServer())
        .post('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(meResponse.body.email).toBe('test@example.com');

      // Step 3: Refresh token
      const refreshResponse = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const newAccessToken = refreshResponse.body.accessToken;
      const newRefreshToken = refreshResponse.body.refreshToken;

      // Step 4: Use new access token
      await request(app.getHttpServer())
        .post('/auth/me')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      // Step 5: Logout
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: newRefreshToken })
        .expect(200);

      // Step 6: Verify token is revoked
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: newRefreshToken })
        .expect(401);
    });
  });
});
