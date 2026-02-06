import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet());

  // CORS configuration
  app.enableCors({
    origin: process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : process.env.CORS_ORIGIN,
    credentials: true,
  });

  // Global API prefix
  app.setGlobalPrefix(process.env.API_PREFIX || 'api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}/${process.env.API_PREFIX || 'api'}`);
}

bootstrap();
