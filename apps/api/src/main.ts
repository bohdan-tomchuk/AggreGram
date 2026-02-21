import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters';
import { QueueService } from './modules/queue/queue.service';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cookie parser
  app.use(cookieParser());

  // Security headers
  app.use(helmet());

  // CORS configuration
  app.enableCors({
    origin: process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : process.env.CORS_ORIGIN,
    credentials: true,
  });

  const apiPrefix = process.env.API_PREFIX || 'api';

  // Global API prefix
  app.setGlobalPrefix(apiPrefix);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AggreGram API')
    .setDescription('Telegram feed aggregation service API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  // Bull Board - queue monitoring UI (must be set up before app.init())
  const bullBoardPath = '/admin/queues';
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(bullBoardPath);

  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret) {
    app.use(bullBoardPath, (req: any, res: any, next: any) => {
      const auth = req.headers['authorization'] || '';
      if (auth === `Bearer ${adminSecret}`) return next();
      res.status(401).json({ message: 'Unauthorized' });
    });
  }

  app.use(bullBoardPath, serverAdapter.getRouter());

  // Trigger lifecycle hooks (onModuleInit) before accessing services
  await app.init();

  const queueService = app.get(QueueService);
  createBullBoard({
    queues: [
      new BullMQAdapter(queueService.getChannelQueue()),
      new BullMQAdapter(queueService.getFetchQueue()),
      new BullMQAdapter(queueService.getPostQueue()),
    ],
    serverAdapter,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}/${apiPrefix}`);
  console.log(`Swagger docs: http://localhost:${port}/${apiPrefix}/docs`);
  console.log(`Bull Board: http://localhost:${port}${bullBoardPath}`);
}

bootstrap();
