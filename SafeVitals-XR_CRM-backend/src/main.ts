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

  // Graceful shutdown hooks
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = process.env.PORT
    ? parseInt(process.env.PORT, 10)
    : configService.get<number>('port') || 4000;
  const host = process.env.HOST || configService.get<string>('host') || '0.0.0.0';
  const corsOrigins = configService.get<string[]>('cors.origins') || [
    'http://localhost:3000',
  ];

  // HTTP Security Headers with Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hidePoweredBy: true,
      hsts:
        process.env.NODE_ENV === 'production'
          ? { maxAge: 31536000, includeSubDomains: true, preload: true }
          : false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'"],
        },
      },
    }),
  );

  // Global API Prefix
  app.setGlobalPrefix('api');

  // Explicit CORS setup
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || corsOrigins.includes(origin) || corsOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error(`Origin '${origin}' not permitted by CORS policy`));
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'X-Correlation-ID',
    ],
    exposedHeaders: ['X-Correlation-ID'],
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

process.on('uncaughtException', (err) => {
  const logger = new Logger('UncaughtException');
  logger.error('Fatal uncaught exception:', err.stack || err);
});

process.on('unhandledRejection', (reason) => {
  const logger = new Logger('UnhandledRejection');
  logger.error('Unhandled promise rejection:', reason);
});

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
