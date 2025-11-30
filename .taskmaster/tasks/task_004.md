# Task ID: 4

**Title:** Implement Authentication Module with JWT

**Status:** pending

**Dependencies:** 3

**Priority:** high

**Description:** Build complete authentication system with user registration, login, JWT access/refresh tokens, password hashing, and auth guards.

**Details:**

1. Create apps/api/src/modules/users/users.module.ts:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

2. Create apps/api/src/modules/users/users.service.ts:
```typescript
import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(email: string, password: string, name?: string): Promise<User> {
    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');
    
    const passwordHash = await bcrypt.hash(password, 12);
    const user = this.usersRepository.create({ email, passwordHash, name });
    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }
}
```

3. Create apps/api/src/modules/auth/auth.module.ts:
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    TypeOrmModule.forFeature([RefreshToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('jwt.accessSecret'),
        signOptions: { expiresIn: config.get('jwt.accessExpiresIn') },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  controllers: [AuthController],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
```

4. Create apps/api/src/modules/auth/auth.service.ts:
```typescript
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
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');
    
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
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('jwt.refreshSecret'),
      });
      
      const tokens = await this.refreshTokenRepository.find({
        where: { userId: payload.sub, isRevoked: false },
      });
      
      let isValid = false;
      for (const token of tokens) {
        if (await bcrypt.compare(refreshToken, token.tokenHash)) {
          isValid = true;
          await this.refreshTokenRepository.update(token.id, { isRevoked: true });
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
    const payload = this.jwtService.decode(refreshToken) as any;
    if (payload?.sub) {
      await this.refreshTokenRepository.update(
        { userId: payload.sub, isRevoked: false },
        { isRevoked: true },
      );
    }
  }
}
```

5. Create apps/api/src/modules/auth/strategies/jwt.strategy.ts:
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get('jwt.accessSecret'),
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException();
    return user;
  }
}
```

6. Create apps/api/src/modules/auth/guards/jwt-auth.guard.ts:
```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

7. Create apps/api/src/modules/auth/auth.controller.ts:
```typescript
import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshTokens(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() body: { refreshToken: string }) {
    await this.authService.logout(body.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: User) {
    const { passwordHash, ...userData } = user;
    return userData;
  }
}
```

**Test Strategy:**

1. Integration tests for AuthController endpoints:
   - POST /auth/login with valid credentials returns tokens
   - POST /auth/login with invalid credentials returns 401
   - POST /auth/refresh with valid token returns new tokens
   - POST /auth/logout revokes refresh token
   - POST /auth/me with valid JWT returns user data
2. Unit tests for AuthService:
   - generateTokens creates access and refresh tokens
   - refreshTokens validates and rotates tokens
   - logout revokes all user refresh tokens
3. Unit tests for UsersService:
   - create hashes password with bcrypt cost 12
   - validatePassword correctly compares hashes
4. Test JwtStrategy validates user and rejects inactive users
5. Test JwtAuthGuard blocks requests without valid token
6. E2E test: login -> access protected route -> refresh -> logout -> fail to access

## Subtasks

### 4.1. Create UsersModule and UsersService with bcrypt password hashing

**Status:** pending  
**Dependencies:** None  

Implement the Users module with TypeORM repository integration, user creation with password hashing using bcrypt (cost factor 12), email validation, and user lookup methods.

**Details:**

Create apps/api/src/modules/users/users.module.ts with TypeOrmModule.forFeature([User]). Implement UsersService with: create() method that checks for existing email, hashes password with bcrypt.hash(password, 12), and saves user; findByEmail() and findById() methods using TypeORM repository; validatePassword() using bcrypt.compare(). Handle ConflictException for duplicate emails.

### 4.2. Implement AuthService with JWT token generation logic

**Status:** pending  
**Dependencies:** 4.1  

Build AuthService with login method, JWT access/refresh token generation, and token payload creation. Integrate JwtService and ConfigService for token signing.

**Details:**

Create apps/api/src/modules/auth/auth.service.ts. Implement login() method: validate user exists and isActive, check password with UsersService.validatePassword(), call generateTokens(). Implement generateTokens(): create payload { sub: userId }, sign accessToken with jwtService.sign(), sign refreshToken with custom secret/expiry from config. Store refresh token hash in RefreshToken entity with expiresAt (7 days). Return { accessToken, refreshToken }.

### 4.3. Build JWT refresh token rotation mechanism with revocation

**Status:** pending  
**Dependencies:** 4.2  

Implement secure refresh token rotation that prevents token reuse by revoking old tokens when new ones are issued, with database-backed token validation.

**Details:**

In AuthService, implement refreshTokens() method: verify refresh token with JwtService.verify() using refreshSecret from config, query RefreshToken repository for non-revoked tokens matching userId, iterate and compare token hash with bcrypt.compare(), if match found revoke it (set isRevoked=true), generate new token pair with generateTokens(). Implement logout() method: decode refresh token, revoke all active tokens for that userId. Handle token expiry and invalid token errors.

### 4.4. Create JwtStrategy and integrate with Passport.js

**Status:** pending  
**Dependencies:** 4.1  

Implement Passport JWT strategy for access token validation, user lookup, and request injection. Configure strategy with JWT extraction and secret.

**Details:**

Create apps/api/src/modules/auth/strategies/jwt.strategy.ts extending PassportStrategy(Strategy). Configure constructor: use ExtractJwt.fromAuthHeaderAsBearerToken(), get secretOrKey from ConfigService (jwt.accessSecret). Implement validate(payload): extract userId from payload.sub, fetch user with UsersService.findById(), throw UnauthorizedException if user not found or inactive, return user object (will be attached to request).

### 4.5. Implement JwtAuthGuard for route protection

**Status:** pending  
**Dependencies:** 4.4  

Create authentication guard extending Passport's AuthGuard to protect routes requiring valid JWT access tokens.

**Details:**

Create apps/api/src/modules/auth/guards/jwt-auth.guard.ts as @Injectable() class extending AuthGuard('jwt'). No custom logic needed - delegates to JwtStrategy. Create apps/api/src/common/decorators/current-user.decorator.ts using createParamDecorator to extract user from request.user. Export JwtAuthGuard from AuthModule for use in other modules.

### 4.6. Create AuthModule and AuthController with all endpoints

**Status:** pending  
**Dependencies:** 4.2, 4.3, 4.5  

Build complete authentication controller with login, refresh, logout, and me endpoints. Configure AuthModule with JwtModule, PassportModule, and dependencies.

**Details:**

Create apps/api/src/modules/auth/auth.module.ts: import UsersModule, PassportModule, TypeOrmModule.forFeature([RefreshToken]), JwtModule.registerAsync() with ConfigService for accessSecret/expiresIn. Create AuthController with: POST /auth/login (email, password) returning tokens, POST /auth/refresh (refreshToken) returning new tokens, POST /auth/logout (refreshToken) revoking token, POST /auth/me with @UseGuards(JwtAuthGuard) returning current user (exclude passwordHash). Use @HttpCode(HttpStatus.OK) for POST endpoints.

### 4.7. Write unit tests for token refresh flow and security logic

**Status:** pending  
**Dependencies:** 4.3  

Create comprehensive unit tests for token generation, refresh rotation, revocation logic, and bcrypt operations to ensure security requirements are met.

**Details:**

Create apps/api/src/modules/auth/__tests__/auth.service.spec.ts. Test token refresh flow: verify token rotation revokes old token, prevents token reuse, handles expired tokens, validates token hash comparison. Test security: bcrypt hashing uses cost factor 12, refresh tokens are hashed before storage, token expiry is set correctly (7 days), concurrent refresh requests are handled safely. Mock RefreshToken repository, JwtService, ConfigService.

### 4.8. Create integration tests for complete authentication flows

**Status:** pending  
**Dependencies:** 4.6  

Build end-to-end integration tests covering registration, login, token refresh, logout, and protected route access across the entire authentication system.

**Details:**

Create apps/api/test/auth.e2e-spec.ts. Test complete flows: user registration → login → access protected endpoint → refresh token → access again → logout → verify token invalid. Test error cases: login with wrong password, refresh with invalid token, access protected route without token, access with expired token. Use TestingModule with real database (test container or in-memory), send HTTP requests to controller, verify database state (tokens stored/revoked), verify JWT payload structure.
