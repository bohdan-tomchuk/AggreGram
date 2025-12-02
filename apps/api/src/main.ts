import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.enableCors();

  // Serve static thumbnails
  app.useStaticAssets(path.join(process.cwd(), 'storage', 'thumbnails'), {
    prefix: '/thumbnails/',
  });

  await app.listen(process.env.PORT ?? 3001);
  console.log(`API running on http://localhost:${process.env.PORT ?? 3001}`);
}
bootstrap();
