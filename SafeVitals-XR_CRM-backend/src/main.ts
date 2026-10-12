import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 4000;
  const host = configService.get<string>('host') || '0.0.0.0';
  const corsOrigins = configService.get<string[]>('cors.origins') || [
    'http://localhost:3000',
  ];

  // HTTP Security with Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Global API Prefix
  app.setGlobalPrefix('api');

  // CORS setup
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || corsOrigins.includes(origin) || corsOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error(`Origin '${origin}' not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Static Assets for uploaded report files
  const uploadDest = configService.get<string>('upload.dest') || './uploads';
  if (!fs.existsSync(uploadDest)) {
    fs.mkdirSync(uploadDest, { recursive: true });
  }
  app.useStaticAssets(join(process.cwd(), uploadDest), {
    prefix: '/uploads/',
  });

  // Swagger Documentation Setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SafeVitals XR CRM API')
    .setDescription(
      'Production-Ready REST API Backend for SafeVitals XR CRM built with NestJS, MongoDB, and TypeScript.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Health')
    .addTag('Authentication')
    .addTag('Users')
    .addTag('Employees')
    .addTag('Departments')
    .addTag('Teams')
    .addTag('Positions')
    .addTag('Roles')
    .addTag('Permissions')
    .addTag('Attendance')
    .addTag('Leave')
    .addTag('Schedules')
    .addTag('Tasks')
    .addTag('Tickets')
    .addTag('Reports')
    .addTag('Access Requests')
    .addTag('Audit Logs')
    .addTag('Notifications')
    .addTag('Organization Settings')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port, host);
  logger.log(`SafeVitals XR CRM Backend listening on http://${host}:${port}`);
  logger.log(`API Documentation available at http://${host}:${port}/api/docs`);
  logger.log(`Health check available at http://${host}:${port}/api/health`);
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
