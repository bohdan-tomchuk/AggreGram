# Task ID: 2

**Title:** Set Up NestJS Backend with Core Modules

**Status:** pending

**Dependencies:** 1 ✓

**Priority:** high

**Description:** Initialize NestJS application in apps/api with module structure, TypeORM configuration, environment management, and error handling foundation.

**Details:**

1. Initialize NestJS in apps/api:
```bash
cd apps/api
npnx @nestjs/cli new . --skip-git --package-manager pnpm
```

2. Install dependencies:
```bash
pnpm add @nestjs/config @nestjs/typeorm typeorm pg @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt class-validator class-transformer
pnpm add -D @types/bcrypt @types/passport-jwt
```

3. Create apps/api/src/config/database.config.ts:
```typescript
import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs('database', (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'telegram_crawler',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'telegram_crawler',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
}));
```

4. Create apps/api/src/config/jwt.config.ts:
```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessExpiresIn: '15m',
  refreshExpiresIn: '7d',
}));
```

5. Create apps/api/src/common/filters/http-exception.filter.ts:
```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: typeof exceptionResponse === 'string' ? exceptionResponse : (exceptionResponse as any).message,
    });
  }
}
```

6. Create apps/api/src/common/decorators/current-user.decorator.ts:
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

7. Update apps/api/src/app.module.ts:
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get('database'),
    }),
  ],
})
export class AppModule {}
```

8. Create .env.example:
```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=telegram_crawler
DB_PASSWORD=your_password
DB_NAME=telegram_crawler
JWT_ACCESS_SECRET=your_access_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
NODE_ENV=development
```

**Test Strategy:**

1. Verify NestJS app starts:
```bash
pnpm dev
```
2. Test environment loading with missing .env (should fail gracefully)
3. Unit test HttpExceptionFilter with mock exceptions
4. Unit test CurrentUser decorator with mock ExecutionContext
5. Verify ConfigModule loads all config files
6. Test TypeORM configuration object structure
